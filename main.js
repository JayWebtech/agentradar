// Agent Radar — main process
// A tiny always-on-top widget that listens for events from coding agents
// (Claude Code, Cursor, Antigravity, or anything that can POST JSON) and
// shows what each session is doing and when it needs you.

const { app, BrowserWindow, ipcMain, screen, Tray, Menu, Notification, nativeImage, dialog } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const hooks = require('./lib/hooks');

const IS_MAC = process.platform === 'darwin';
const IS_LINUX = process.platform === 'linux';

// Linux compositors need this for transparent windows
if (IS_LINUX) app.commandLine.appendSwitch('enable-transparent-visuals');

const PORT = Number(process.env.AGENT_RADAR_PORT || 47321);
const WIDTH = 372; // includes 16px transparent margin for the CSS shadow
const STALE_MS = 15 * 60 * 1000; // a "working" session silent this long is shown as idle
const DONE_TTL_MS = 60 * 60 * 1000; // finished sessions drop off after an hour

let win = null;
let tray = null;
const sessions = new Map(); // key -> session
const pending = new Map();  // key -> { res, id } : a PermissionRequest hook waiting for Approve / Deny
let askSeq = 0;

// Answer a waiting PermissionRequest hook. decision: 'allow' | 'deny' | null (let the agent ask normally)
function resolvePending(key, decision) {
  const p = pending.get(key);
  if (!p) return false;
  pending.delete(key);
  let out = {};
  if (decision === 'allow') out = { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } } };
  if (decision === 'deny') out = { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'deny', message: 'The user denied this from Agent Radar.' } } };
  try { p.res.writeHead(200, { 'content-type': 'application/json' }); p.res.end(JSON.stringify(out)); } catch {}
  const s = sessions.get(key);
  if (s && s.ask && s.ask.id === p.id) s.ask.actionable = false;
  return true;
}

// ---------------------------------------------------------------- settings
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');
let settings = { x: null, y: null, collapsed: false, notifyDone: true, sound: true, askedSetup: false };
function loadSettings() {
  try { Object.assign(settings, JSON.parse(fs.readFileSync(settingsPath(), 'utf8'))); } catch {}
}
function saveSettings() {
  try { fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2)); } catch {}
}

// ---------------------------------------------------------------- helpers
const SOURCE_APPS = {
  claude: null, // Claude Code runs inside whatever launched it; we use the captured bundle id
  cursor: 'com.todesktop.230313mzl4w4u92',
  antigravity: 'com.google.antigravity',
};

function shortPath(p) {
  if (!p) return '';
  const parts = String(p).split('/').filter(Boolean);
  return parts.slice(-2).join('/');
}

function describeTool(name, input = {}) {
  if (!name) return '';
  const file = input.file_path || input.path || input.notebook_path;
  switch (name) {
    case 'Bash': return `Running: ${truncate(input.command, 80)}`;
    case 'Edit':
    case 'MultiEdit': return `Editing ${shortPath(file)}`;
    case 'Write': return `Writing ${shortPath(file)}`;
    case 'Read': return `Reading ${shortPath(file)}`;
    case 'Grep': return `Searching for "${truncate(input.pattern, 40)}"`;
    case 'Glob': return `Finding ${truncate(input.pattern, 40)}`;
    case 'WebFetch': return `Fetching ${truncate(input.url, 60)}`;
    case 'WebSearch': return `Searching the web: ${truncate(input.query, 50)}`;
    case 'Task':
    case 'Agent': return `Sub-agent: ${truncate(input.description, 60)}`;
    case 'TodoWrite': return 'Updating task list';
    default: return name.startsWith('mcp__') ? `Using ${name.split('__').slice(1).join(' › ')}` : `Using ${name}`;
  }
}

function truncate(s, n) {
  s = String(s ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function projectName(cwd, fallback) {
  if (cwd) return path.basename(String(cwd));
  return fallback || 'session';
}

// ---------------------------------------------------------------- reducer
// Turns a raw hook payload into a session state change.
function applyEvent(source, body, meta) {
  source = (source || body.source || 'agent').toLowerCase();
  const sessionId = body.session_id || body.conversation_id || body.sessionId || body.cwd || body.project || 'default';
  const key = `${source}:${sessionId}`;
  const now = Date.now();

  let s = sessions.get(key);
  if (!s) {
    s = {
      key, source, sessionId,
      project: projectName(body.cwd || (body.workspace_roots || [])[0], body.project),
      status: 'idle', detail: '', prompt: '', ask: null,
      tools: 0, startedAt: now, updatedAt: now,
      bundleId: null,
    };
    sessions.set(key, s);
  }
  if (meta.bundleId) s.bundleId = meta.bundleId;
  if (body.cwd || body.project) s.project = projectName(body.cwd, body.project);
  s.updatedAt = now;

  const prev = s.status;
  const ev = body.hook_event_name || body.event || '';
  // Any new activity means the request was answered elsewhere (e.g. in the terminal)
  if (pending.has(key) && !['PermissionRequest', 'Notification'].includes(ev)) resolvePending(key, null);

  // Generic API: { status: "working" | "needs_input" | "done" | "idle", message }
  if (!ev && body.status) {
    s.status = body.status;
    if (body.status === 'needs_input') s.ask = { title: 'Needs your input', text: body.message || '' };
    else { s.ask = null; s.detail = body.message || s.detail; }
    if (body.status === 'working' && prev !== 'working') s.startedAt = now;
  } else switch (ev) {
    // ---- Claude Code
    case 'SessionStart':
      s.status = 'idle'; s.detail = 'Session started'; break;
    case 'UserPromptSubmit':
    case 'beforeSubmitPrompt': // Cursor
      s.status = 'working'; s.ask = null; s.startedAt = now; s.tools = 0;
      s.prompt = truncate(body.prompt, 120); s.detail = 'Thinking…'; break;
    case 'PreToolUse': {
      const input = body.tool_input || {};
      if (body.tool_name === 'AskUserQuestion') {
        const qs = (input.questions || []).map((q) => q.question).filter(Boolean);
        s.status = 'needs_input';
        s.ask = { title: 'Claude has a question', text: qs.join('\n') || 'Waiting for your answer' };
      } else if (body.tool_name === 'ExitPlanMode') {
        s.status = 'needs_input';
        s.ask = { title: 'Plan ready for your approval', text: truncate(input.plan, 220) };
      } else {
        s.status = 'working'; s.ask = null; s.tools++;
        s.detail = describeTool(body.tool_name, input);
      }
      break;
    }
    case 'PostToolUse':
    case 'PostToolUseFailure':
    case 'PermissionDenied':
      if (s.status === 'needs_input' || s.status === 'idle') { s.status = 'working'; s.ask = null; }
      break;
    case 'Elicitation':
      s.status = 'needs_input';
      s.ask = { title: 'A tool is asking for input', text: truncate(body.message || body.mcp_server_name, 200) };
      break;
    case 'StopFailure':
      s.status = 'done'; s.ask = null; s.finishedAt = now;
      s.detail = `Stopped with an error${body.error ? ': ' + truncate(body.error, 80) : ''}`; break;
    case 'PermissionRequest':
      s.status = 'needs_input';
      s.ask = {
        id: ++askSeq,
        title: `Allow ${toolTitle(body.tool_name)}?`,
        text: permissionText(body.tool_name, body.tool_input),
        actionable: !!meta.actionable,
      };
      break;
    case 'Notification': {
      const msg = body.message || '';
      const type = body.notification_type || '';
      if (type === 'idle_prompt' || /waiting for your input/i.test(msg)) {
        s.status = 'needs_input';
        s.ask = { title: 'Waiting for your reply', text: msg };
      } else if (type === 'permission_prompt' || /permission|approve|confirm/i.test(msg)) {
        s.status = 'needs_input';
        // Keep the richer PermissionRequest text if we already have it
        if (!s.ask || prev !== 'needs_input') s.ask = { title: 'Needs permission', text: msg };
      } else {
        s.detail = msg || s.detail;
      }
      break;
    }
    case 'Stop':
    case 'stop': // Cursor
      s.status = 'done'; s.ask = null; s.finishedAt = now;
      s.detail = body.status === 'aborted' ? 'Stopped' : 'Finished — ready for you'; break;
    case 'SubagentStop':
      break;
    case 'SessionEnd':
      // keep finished work visible as "Done"; drop sessions that ended without finishing anything
      if (prev === 'done') break;
      sessions.delete(key); broadcast(); return s;
    // ---- Cursor
    case 'afterFileEdit':
      s.status = 'working'; s.tools++; s.detail = `Edited ${shortPath(body.file_path)}`; break;
    case 'beforeShellExecution':
      s.status = 'working'; s.tools++; s.detail = `Running: ${truncate(body.command, 80)}`; break;
    case 'beforeMCPExecution':
      s.status = 'working'; s.tools++; s.detail = `Using ${body.tool_name || 'MCP tool'}`; break;
    default:
      if (body.message) s.detail = truncate(body.message, 120);
  }

  if (s.status !== prev || ev === 'PermissionRequest') onStatusChange(s, prev);
  broadcast();
  return s;
}

function toolTitle(name) {
  if (!name) return 'this action';
  if (name.startsWith('mcp__')) return name.split('__').slice(1).join(' › ');
  return { Bash: 'command', Edit: 'edit', MultiEdit: 'edit', Write: 'file write', WebFetch: 'web fetch' }[name] || name;
}
function permissionText(name, input = {}) {
  if (name === 'Bash') return '$ ' + truncate(input.command, 400);
  if (input.file_path) return `${describeTool(name, input)}`;
  if (input.url) return input.url;
  const j = JSON.stringify(input);
  return j && j !== '{}' ? truncate(j, 300) : describeTool(name, input);
}

function onStatusChange(s, prev) {
  if (s.status === 'needs_input') {
    notify(`${label(s.source)} needs you · ${s.project}`, s.ask?.text || s.ask?.title || 'Waiting for input', s);
    if (win) { win.showInactive(); win.moveTop(); }
    if (settings.collapsed && win) win.webContents.send('flash');
  } else if (s.status === 'done' && prev === 'working' && settings.notifyDone) {
    notify(`${label(s.source)} finished · ${s.project}`, s.prompt || 'Task complete', s);
  }
  updateTray();
}

function label(source) {
  return { claude: 'Claude', cursor: 'Cursor', antigravity: 'Antigravity' }[source] || source;
}

function notify(title, body, s) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body: truncate(body, 180), silent: !settings.sound });
  n.on('click', () => focusSession(s.key));
  n.show();
}

function focusSession(key) {
  const s = sessions.get(key);
  if (!s) return;
  // Jumping to the agent's app is macOS-only for now (it uses the app's bundle id)
  if (!IS_MAC) return;
  const bundle = s.bundleId || SOURCE_APPS[s.source];
  if (bundle) execFile('open', ['-b', bundle], () => {});
}

// ---------------------------------------------------------------- broadcast
function snapshot() {
  const now = Date.now();
  for (const [k, s] of sessions) {
    if (s.status === 'done' && now - (s.finishedAt || s.updatedAt) > DONE_TTL_MS) sessions.delete(k);
    else if (s.status === 'working' && now - s.updatedAt > STALE_MS) s.status = 'idle';
  }
  const order = { needs_input: 0, working: 1, done: 2, idle: 3 };
  return [...sessions.values()].sort((a, b) =>
    (order[a.status] - order[b.status]) || (b.updatedAt - a.updatedAt));
}

function broadcast() {
  updateTray();
  if (win && !win.isDestroyed()) win.webContents.send('state', { sessions: snapshot(), now: Date.now(), collapsed: settings.collapsed });
}

// ---------------------------------------------------------------- server
function startServer() {
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, sessions: sessions.size }));
    }
    if (process.env.AGENT_RADAR_DEBUG && req.method === 'GET' && req.url === '/debug/snapshot.png' && win) {
      return win.webContents.capturePage().then((img) => {
        res.writeHead(200, { 'content-type': 'image/png' }); res.end(img.toPNG());
      });
    }
    if (process.env.AGENT_RADAR_DEBUG && req.method === 'GET' && req.url.startsWith('/debug/click') && win) {
      const sel = new URL(req.url, 'http://x').searchParams.get('sel');
      return win.webContents.executeJavaScript(`!!document.querySelector(${JSON.stringify(sel)})?.click() || !!document.querySelector(${JSON.stringify(sel)})`)
        .then((ok) => { res.writeHead(ok ? 200 : 404); res.end(String(ok)); });
    }
    if (req.method === 'POST' && req.url.startsWith('/permission')) return; // handled below
    if (req.method !== 'POST' || !req.url.startsWith('/event')) {
      res.writeHead(404); return res.end();
    }
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 2e6) req.destroy(); });
    req.on('end', () => {
      res.writeHead(204); res.end();
      let body = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch { return; }
      const url = new URL(req.url, 'http://x');
      const source = req.headers['x-agent-source'] || url.searchParams.get('source');
      applyEvent(source, body, { bundleId: req.headers['x-bundle-id'] || null });
    });
  });
  server.requestTimeout = 0;
  server.headersTimeout = 0;
  server.on('request', (req, res) => {
    if (req.method !== 'POST' || !req.url.startsWith('/permission')) return;
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      let body = {};
      try { body = JSON.parse(raw || '{}'); } catch {}
      const source = req.headers['x-agent-source'] || 'claude';
      const s = applyEvent(source, { ...body, hook_event_name: 'PermissionRequest' }, { bundleId: req.headers['x-bundle-id'] || null, actionable: true });
      const key = s.key;
      resolvePending(key, null); // only one outstanding request per session
      pending.set(key, { res, id: s.ask.id });
      // hook was killed (answered in terminal, or timed out) -> stop offering the buttons
      res.on('close', () => {
        const p = pending.get(key);
        if (p && p.res === res) { pending.delete(key); if (s.ask && s.ask.id === p.id) { s.ask.actionable = false; broadcast(); } }
      });
    });
  });
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`Agent Radar: port ${PORT} is busy — is another copy running?`);
      app.quit();
    }
  });
  server.listen(PORT, '127.0.0.1');
}

// ---------------------------------------------------------------- window
function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const x = settings.x ?? workArea.x + workArea.width - WIDTH;
  const y = settings.y ?? workArea.y;

  win = new BrowserWindow({
    x, y, width: WIDTH, height: 64,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => { win.showInactive(); broadcast(); });
  if (process.env.AGENT_RADAR_DEBUG) {
    win.webContents.on('console-message', (_e, level, message, line, src) => console.log(`[renderer] ${message} (${src}:${line})`));
    win.webContents.on('preload-error', (_e, p, err) => console.log('[preload-error]', p, err));
  }

  let moveTimer;
  win.on('moved', () => {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(() => {
      const [nx, ny] = win.getPosition();
      settings.x = nx; settings.y = ny; saveSettings();
    }, 300);
  });
}

ipcMain.on('resize', (_e, height) => {
  if (!win) return;
  const [w] = win.getSize();
  const h = Math.max(60, Math.min(640, Math.ceil(height)));
  win.setSize(w, h, false);
});
ipcMain.on('focus-session', (_e, key) => focusSession(key));
ipcMain.on('decide', (_e, key, decision) => {
  const s = sessions.get(key);
  if (!resolvePending(key, decision)) return;
  if (s) {
    s.ask = null;
    s.status = 'working';
    s.detail = decision === 'allow' ? 'Approved from Agent Radar' : decision === 'deny' ? 'Denied from Agent Radar' : s.detail;
    if (!decision) focusSession(key);
  }
  broadcast();
});
ipcMain.on('dismiss', (_e, key) => { sessions.delete(key); broadcast(); });
ipcMain.on('clear-done', () => {
  for (const [k, s] of sessions) if (s.status === 'done' || s.status === 'idle') sessions.delete(k);
  broadcast();
});
ipcMain.on('toggle-collapsed', () => {
  settings.collapsed = !settings.collapsed; saveSettings(); broadcast();
});
ipcMain.on('menu', () => buildMenu().popup({ window: win }));

// ---------------------------------------------------------------- tray
function trayIcon() {
  // macOS: black template image that adapts to light/dark menu bars. Windows / Linux: light glyph.
  const img = nativeImage.createFromPath(path.join(__dirname, 'assets', IS_MAC ? 'trayTemplate.png' : 'tray.png'));
  if (IS_MAC) img.setTemplateImage(true);
  return img;
}

function updateTray() {
  if (!tray) return;
  const list = [...sessions.values()];
  const waiting = list.filter((s) => s.status === 'needs_input').length;
  const working = list.filter((s) => s.status === 'working').length;
  if (IS_MAC) tray.setTitle(waiting ? ` ${waiting}` : working ? ` ${working}` : '');
  tray.setToolTip(`Agent Radar — ${working} working, ${waiting} waiting for you`);
}

function buildMenu() {
  const visible = win && win.isVisible();
  return Menu.buildFromTemplate([
    { label: visible ? 'Hide widget' : 'Show widget', click: () => (visible ? win.hide() : win.showInactive()) },
    { label: 'Reset position', click: () => {
      const { workArea } = screen.getPrimaryDisplay();
      win.setPosition(workArea.x + workArea.width - WIDTH, workArea.y);
    } },
    { type: 'separator' },
    { label: 'Notify when a task finishes', type: 'checkbox', checked: settings.notifyDone,
      click: (i) => { settings.notifyDone = i.checked; saveSettings(); } },
    { label: 'Play sound', type: 'checkbox', checked: settings.sound,
      click: (i) => { settings.sound = i.checked; saveSettings(); } },
    ...(IS_LINUX ? [] : [{ label: 'Launch at login', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked }) }]),
    { type: 'separator' },
    { label: 'Connect agents', submenu: connectMenu() },
    { label: 'Clear finished sessions', click: () => ipcMain.emit('clear-done') },
    { type: 'separator' },
    { label: 'Quit Agent Radar', role: 'quit' },
  ]);
}

// ---------------------------------------------------------------- agent hooks
function connectMenu() {
  let st = {};
  try { st = hooks.status(); } catch {}
  const connected = st.claude || st.cursor;
  return [
    { label: connected ? `Connected: ${[st.claude && 'Claude Code', st.cursor && 'Cursor'].filter(Boolean).join(', ')}` : 'Not connected yet', enabled: false },
    { label: connected ? 'Reinstall hooks' : 'Connect Claude Code & Cursor…', click: () => runInstall({}) },
    { label: 'Also report from Antigravity', type: 'checkbox', checked: !!st.antigravity,
      click: (i) => runInstall({ antigravity: i.checked }) },
    { type: 'separator' },
    { label: 'Disconnect all agents', enabled: !!(connected || st.antigravity), click: () => runInstall({ uninstall: true }) },
  ];
}

function runInstall(opts) {
  try {
    const st = hooks.status();
    const log = hooks.installHooks({ antigravity: opts.antigravity ?? st.antigravity, ...opts });
    dialog.showMessageBox({
      type: 'info',
      message: opts.uninstall ? 'Agent Radar disconnected' : 'Agent Radar connected',
      detail: log.join('\n') + (opts.uninstall ? '' : '\n\nRestart any open agent sessions so they pick up the hooks.'),
    });
  } catch (e) {
    dialog.showErrorBox('Agent Radar', `Could not update agent settings:\n${e.message}`);
  }
}

// First launch: offer to connect, since a downloaded app has no `npm run install-hooks`
async function offerSetup() {
  if (settings.askedSetup) return;
  let st;
  try { st = hooks.status(); } catch { return; }
  settings.askedSetup = true; saveSettings();
  if (st.claude || st.cursor || !(st.claudeFound || st.cursorFound)) return;
  const found = [st.claudeFound && 'Claude Code', st.cursorFound && 'Cursor'].filter(Boolean).join(' and ');
  const { response } = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Connect', 'Not now'],
    defaultId: 0, cancelId: 1,
    message: `Connect Agent Radar to ${found}?`,
    detail: `This adds hooks to your ${found} settings so the widget can show progress and approval requests. `
      + 'Your current settings are backed up first, and you can disconnect anytime from the ••• menu → Connect agents.',
  });
  if (response === 0) runInstall({});
}

// ---------------------------------------------------------------- lifecycle
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => win && win.showInactive());
  app.whenReady().then(() => {
    if (IS_MAC) app.dock.hide();
    if (process.platform === 'win32') app.setAppUserModelId('com.agentradar.app'); // needed for notifications
    loadSettings();
    startServer();
    createWindow();
    tray = new Tray(trayIcon());
    tray.on('click', () => tray.popUpContextMenu(buildMenu()));
    updateTray();
    setTimeout(offerSetup, 1500);
    // refresh relative times + staleness
    setInterval(broadcast, 15 * 1000);
  });
  app.on('window-all-closed', (e) => e.preventDefault());
}
