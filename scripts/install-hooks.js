#!/usr/bin/env node
// Installs (or removes) Agent Radar hooks for Claude Code and Cursor.
//
//   node scripts/install-hooks.js                 install for every agent found
//   node scripts/install-hooks.js --uninstall     remove everything Agent Radar added
//   node scripts/install-hooks.js --antigravity   also add a rule telling Antigravity to report status
//
// Existing settings are backed up next to the original (*.agentradar-backup) before any change,
// and only entries containing "agentradar-hook.sh" are ever added or removed.

const fs = require('fs');
const os = require('os');
const path = require('path');

const HOME = os.homedir();
const args = new Set(process.argv.slice(2));
const UNINSTALL = args.has('--uninstall');
const MARK = 'agentradar-hook.sh';

const installDir = path.join(HOME, '.agentradar');
const hookPath = path.join(installDir, MARK);

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw new Error(`Could not parse ${file}: ${e.message}`);
  }
}
function writeJson(file, data) {
  if (fs.existsSync(file)) fs.copyFileSync(file, file + '.agentradar-backup');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
const q = (p) => `'${p.replace(/'/g, `'\\''`)}'`;

// ---------------------------------------------------------------- hook script
if (!UNINSTALL) {
  fs.mkdirSync(installDir, { recursive: true });
  fs.copyFileSync(path.join(__dirname, '..', 'hooks', MARK), hookPath);
  fs.chmodSync(hookPath, 0o755);
  console.log(`✓ hook script → ${hookPath}`);
}

// ---------------------------------------------------------------- Claude Code
const CLAUDE_EVENTS = [
  'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'PermissionRequest', 'PermissionDenied', 'Notification', 'Elicitation',
  'Stop', 'StopFailure', 'SessionEnd',
];
(function claude() {
  const file = path.join(HOME, '.claude', 'settings.json');
  if (!fs.existsSync(path.dirname(file))) return console.log('– Claude Code not found, skipped');
  const settings = readJson(file, {});
  settings.hooks = settings.hooks || {};

  // strip any previous Agent Radar entries
  for (const ev of Object.keys(settings.hooks)) {
    settings.hooks[ev] = (settings.hooks[ev] || [])
      .map((m) => ({ ...m, hooks: (m.hooks || []).filter((h) => !String(h.command || '').includes(MARK)) }))
      .filter((m) => m.hooks.length);
    if (!settings.hooks[ev].length) delete settings.hooks[ev];
  }
  if (!UNINSTALL) {
    for (const ev of CLAUDE_EVENTS) {
      const entry = { hooks: [{ type: 'command', command: `${q(hookPath)} claude`, timeout: 3 }] };
      if (['PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PermissionRequest', 'PermissionDenied'].includes(ev)) entry.matcher = '*';
      (settings.hooks[ev] = settings.hooks[ev] || []).push(entry);
    }
  }
  if (!Object.keys(settings.hooks).length) delete settings.hooks;
  writeJson(file, settings);
  console.log(`✓ Claude Code hooks ${UNINSTALL ? 'removed from' : 'added to'} ${file}`);
})();

// ---------------------------------------------------------------- Cursor
const CURSOR_EVENTS = ['beforeSubmitPrompt', 'afterFileEdit', 'beforeShellExecution', 'beforeMCPExecution', 'stop'];
(function cursor() {
  const dir = path.join(HOME, '.cursor');
  if (!fs.existsSync(dir)) return console.log('– Cursor not found, skipped');
  const file = path.join(dir, 'hooks.json');
  const cfg = readJson(file, { version: 1, hooks: {} });
  cfg.version = cfg.version || 1;
  cfg.hooks = cfg.hooks || {};
  for (const ev of Object.keys(cfg.hooks)) {
    cfg.hooks[ev] = cfg.hooks[ev].filter((h) => !String(h.command || '').includes(MARK));
    if (!cfg.hooks[ev].length) delete cfg.hooks[ev];
  }
  if (!UNINSTALL) for (const ev of CURSOR_EVENTS) (cfg.hooks[ev] = cfg.hooks[ev] || []).push({ command: `${q(hookPath)} cursor` });
  writeJson(file, cfg);
  console.log(`✓ Cursor hooks ${UNINSTALL ? 'removed from' : 'added to'} ${file}`);
})();

// ---------------------------------------------------------------- Antigravity (opt-in rule)
const AG_START = '<!-- agentradar:start -->';
const AG_END = '<!-- agentradar:end -->';
(function antigravity() {
  const file = path.join(HOME, '.gemini', 'GEMINI.md');
  let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const had = text.includes(AG_START);
  text = text.replace(new RegExp(`\\n?${AG_START}[\\s\\S]*?${AG_END}\\n?`), '\n');
  if (!UNINSTALL && args.has('--antigravity')) {
    text += `\n${AG_START}
## Agent Radar status reporting
The user watches a desktop widget called Agent Radar. Keep it updated by running these shell commands (they are instant and silent):
- When you start working on a request: \`${hookPath} notify antigravity working "<one-line summary of the task>"\`
- Right before you stop to ask the user anything or wait for approval: \`${hookPath} notify antigravity needs_input "<the question>"\`
- When you have finished the request: \`${hookPath} notify antigravity done "<one-line summary of the result>"\`
${AG_END}\n`;
    fs.mkdirSync(path.dirname(file), { recursive: true });
  } else if (!had) return;
  if (fs.existsSync(file)) fs.copyFileSync(file, file + '.agentradar-backup');
  fs.writeFileSync(file, text.replace(/^\n+/, ''));
  console.log(`✓ Antigravity rule ${UNINSTALL || !args.has('--antigravity') ? 'removed from' : 'added to'} ${file}`);
})();

if (UNINSTALL) {
  fs.rmSync(installDir, { recursive: true, force: true });
  console.log('✓ removed ~/.agentradar');
}
console.log(UNINSTALL ? '\nAgent Radar hooks removed.' : '\nDone. New agent sessions will now report to Agent Radar (restart open sessions to pick up hooks).');
