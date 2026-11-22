# Agent Radar

A small always-on-top widget for macOS that shows what your coding agents are doing, and lets you know the moment one of them needs you.

- **Working** (blue, radar sweeping): what the agent is doing right now, like "Editing src/Payment.tsx" or "Running: npm test", plus how long it has been at it.
- **Needs you** (amber, pulsing): the exact thing it's asking, such as a command waiting for approval, a question, or a plan to approve. The widget comes to the front and you also get a macOS notification.
- **Done** (green): the task is finished. Sessions marked Done disappear after an hour.

Click any card (or the notification) to jump straight to the app that agent is running in, whether that's Terminal, iTerm, VS Code, Cursor, Antigravity or the Claude desktop app.

The widget floats above every window and every Space, including full-screen apps. Drag it anywhere and it remembers where you left it. Use the chevron to collapse it to a single line, and the `•••` button for options (sound, notify on finish, launch at login).

## Setup

```bash
npm install
npm start               # launches the widget (menu-bar item + floating card)
npm run install-hooks   # connects Claude Code (+ Cursor if installed)
npm run demo            # optional: plays fake sessions so you can see every state
```

Restart any Claude Code / Cursor sessions that are already open so they pick up the hooks.

### What `install-hooks` changes
- Copies `hooks/agentradar-hook.sh` to `~/.agentradar/`.
- **Claude Code**: adds hook entries to `~/.claude/settings.json`.
- **Cursor**: adds entries to `~/.cursor/hooks.json` (only if `~/.cursor` exists).
- **Antigravity** (opt-in, `npm run install-hooks -- --antigravity`): Antigravity has no hook system, so this adds a short rule to `~/.gemini/GEMINI.md` asking the agent to report its status with the hook script.

Each file is backed up to `*.agentradar-backup` before it's changed, and the installer only adds or removes its own entries. To undo everything, run `npm run uninstall-hooks`.

The hook does nothing that would get in an agent's way. It posts to `127.0.0.1:47321` with a 1-second timeout, always exits 0, and stays silent when the widget isn't running.

## Other agents / scripts

Anything that can run a shell command can report to the widget:

```bash
~/.agentradar/agentradar-hook.sh notify my-agent working "Migrating the database"
~/.agentradar/agentradar-hook.sh notify my-agent needs_input "Approve dropping the users table?"
~/.agentradar/agentradar-hook.sh notify my-agent done "Migration complete"
```

Or POST JSON to `http://127.0.0.1:47321/event` with the header `X-Agent-Source: <name>` and a body of `{ "session_id", "project", "status": "working|needs_input|done|idle", "message" }`.
