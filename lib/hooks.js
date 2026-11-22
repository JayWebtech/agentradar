// Installs / removes Agent Radar hooks for Claude Code, Cursor and (opt-in) Antigravity.
// Used by both the CLI (scripts/install-hooks.js) and the app's menu.
//
// Existing settings are backed up once (*.agentradar-backup) before the first change,
// and only entries containing "agentradar-hook.sh" are ever added or removed.

const fs = require('fs');
const os = require('os');
const path = require('path');

const MARK = 'agentradar-hook.sh';
const HOOK_SOURCE = path.join(__dirname, '..', 'hooks', MARK);
const IS_WIN = process.platform === 'win32';

const CLAUDE_EVENTS = [
  'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'PermissionRequest', 'PermissionDenied', 'Notification', 'Elicitation',
  'Stop', 'StopFailure', 'SessionEnd',
];
const CLAUDE_MATCHED = ['PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PermissionRequest', 'PermissionDenied'];
const CURSOR_EVENTS = ['beforeSubmitPrompt', 'afterFileEdit', 'beforeShellExecution', 'beforeMCPExecution', 'stop'];
const AG_START = '<!-- agentradar:start -->';
const AG_END = '<!-- agentradar:end -->';

function paths(home = os.homedir()) {
  const installDir = path.join(home, '.agentradar');
  return {
    home,
    installDir,
    hookPath: path.join(installDir, MARK),
    claude: path.join(home, '.claude', 'settings.json'),
    cursorDir: path.join(home, '.cursor'),
    cursor: path.join(home, '.cursor', 'hooks.json'),
    gemini: path.join(home, '.gemini', 'GEMINI.md'),
  };
}

// The shell command an agent runs. On Windows, agents run hooks through Git Bash, so we call bash
// explicitly with a forward-slash path; on macOS / Linux the script is executable on its own.
function hookCommand(hookPath, arg) {
  if (IS_WIN) return `bash "${hookPath.replace(/\\/g, '/')}" ${arg}`;
  return `'${hookPath.replace(/'/g, `'\\''`)}' ${arg}`;
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw new Error(`Could not parse ${file}: ${e.message}`);
  }
}
function backupOnce(file) {
  if (fs.existsSync(file) && !fs.existsSync(file + '.agentradar-backup')) fs.copyFileSync(file, file + '.agentradar-backup');
}
function writeJson(file, data) {
  backupOnce(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
const ours = (cmd) => String(cmd || '').includes(MARK);

/** @returns {{claude: boolean, cursor: boolean, antigravity: boolean, claudeFound: boolean, cursorFound: boolean}} */
function status(home) {
  const p = paths(home);
  const claude = readJson(p.claude, {});
  const cursor = readJson(p.cursor, {});
  const gem = fs.existsSync(p.gemini) ? fs.readFileSync(p.gemini, 'utf8') : '';
  return {
    claudeFound: fs.existsSync(path.dirname(p.claude)),
    cursorFound: fs.existsSync(p.cursorDir),
    claude: Object.values(claude.hooks || {}).some((ms) => ms.some((m) => (m.hooks || []).some((h) => ours(h.command)))),
    cursor: Object.values(cursor.hooks || {}).some((hs) => hs.some((h) => ours(h.command))),
    antigravity: gem.includes(AG_START),
  };
}

/**
 * @param {{uninstall?: boolean, antigravity?: boolean, home?: string}} opts
 * @returns {string[]} human-readable log lines
 */
function installHooks({ uninstall = false, antigravity = false, home } = {}) {
  const p = paths(home);
  const log = [];

  // ---- hook script (read+write so it also works from inside a packaged app.asar)
  if (!uninstall) {
    fs.mkdirSync(p.installDir, { recursive: true });
    fs.writeFileSync(p.hookPath, fs.readFileSync(HOOK_SOURCE, 'utf8').replace(/\r\n/g, '\n'));
    fs.chmodSync(p.hookPath, 0o755);
    log.push(`✓ hook script → ${p.hookPath}`);
  }

  // ---- Claude Code
  if (fs.existsSync(path.dirname(p.claude))) {
    const settings = readJson(p.claude, {});
    settings.hooks = settings.hooks || {};
    for (const ev of Object.keys(settings.hooks)) {
      settings.hooks[ev] = (settings.hooks[ev] || [])
        .map((m) => ({ ...m, hooks: (m.hooks || []).filter((h) => !ours(h.command)) }))
        .filter((m) => m.hooks.length);
      if (!settings.hooks[ev].length) delete settings.hooks[ev];
    }
    if (!uninstall) {
      for (const ev of CLAUDE_EVENTS) {
        // PermissionRequest waits (up to 10 min) for Approve / Deny in the widget; everything else is fire-and-forget
        const entry = ev === 'PermissionRequest'
          ? { hooks: [{ type: 'command', command: hookCommand(p.hookPath, 'claude-permission'), timeout: 600 }] }
          : { hooks: [{ type: 'command', command: hookCommand(p.hookPath, 'claude'), timeout: 3 }] };
        if (CLAUDE_MATCHED.includes(ev)) entry.matcher = '*';
        (settings.hooks[ev] = settings.hooks[ev] || []).push(entry);
      }
    }
    if (!Object.keys(settings.hooks).length) delete settings.hooks;
    writeJson(p.claude, settings);
    log.push(`✓ Claude Code hooks ${uninstall ? 'removed from' : 'added to'} ${p.claude}`);
  } else log.push('– Claude Code not found, skipped');

  // ---- Cursor
  if (fs.existsSync(p.cursorDir)) {
    const cfg = readJson(p.cursor, { version: 1, hooks: {} });
    cfg.version = cfg.version || 1;
    cfg.hooks = cfg.hooks || {};
    for (const ev of Object.keys(cfg.hooks)) {
      cfg.hooks[ev] = cfg.hooks[ev].filter((h) => !ours(h.command));
      if (!cfg.hooks[ev].length) delete cfg.hooks[ev];
    }
    if (!uninstall) for (const ev of CURSOR_EVENTS) (cfg.hooks[ev] = cfg.hooks[ev] || []).push({ command: hookCommand(p.hookPath, 'cursor') });
    writeJson(p.cursor, cfg);
    log.push(`✓ Cursor hooks ${uninstall ? 'removed from' : 'added to'} ${p.cursor}`);
  } else log.push('– Cursor not found, skipped');

  // ---- Antigravity (opt-in rule; it has no hook system)
  let text = fs.existsSync(p.gemini) ? fs.readFileSync(p.gemini, 'utf8') : '';
  const had = text.includes(AG_START);
  const want = !uninstall && antigravity;
  if (had || want) {
    text = text.replace(new RegExp(`\\n?${AG_START}[\\s\\S]*?${AG_END}\\n?`), '\n');
    if (want) {
      const cmd = (args) => hookCommand(p.hookPath, `notify antigravity ${args}`);
      text += `\n${AG_START}
## Agent Radar status reporting
The user watches a desktop widget called Agent Radar. Keep it updated by running these shell commands (they are instant and silent):
- When you start working on a request: \`${cmd('working "<one-line summary of the task>"')}\`
- Right before you stop to ask the user anything or wait for approval: \`${cmd('needs_input "<the question>"')}\`
- When you have finished the request: \`${cmd('done "<one-line summary of the result>"')}\`
${AG_END}\n`;
    }
    backupOnce(p.gemini);
    fs.mkdirSync(path.dirname(p.gemini), { recursive: true });
    fs.writeFileSync(p.gemini, text.replace(/^\n+/, ''));
    log.push(`✓ Antigravity rule ${want ? 'added to' : 'removed from'} ${p.gemini}`);
  }

  if (uninstall) {
    fs.rmSync(p.installDir, { recursive: true, force: true });
    log.push('✓ removed ~/.agentradar');
  }
  return log;
}

module.exports = { installHooks, status, paths };
