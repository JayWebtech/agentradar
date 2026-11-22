# Agent Radar

A small always-on-top widget for macOS that shows what your coding agents are doing, and lets you know the moment one of them needs you.

- **Working** (blue, radar sweeping): what the agent is doing right now, like "Editing src/Payment.tsx" or "Running: npm test", plus how long it has been at it.
- **Needs you** (amber, pulsing): the exact thing it's asking, such as a command waiting for approval, a question, or a plan to approve. The widget comes to the front and you also get a macOS notification.
- **Done** (green): the task is finished. Sessions marked Done disappear after an hour.

Click any card (or the notification) to jump straight to the app that agent is running in, whether that's Terminal, iTerm, VS Code, Cursor, Antigravity or the Claude desktop app.

### Approve / Deny from the widget (Claude Code)
When Claude Code asks permission for a command, edit or tool, the card shows **Approve** and **Deny** buttons, so you can answer without switching windows.
- **Open ↗** hands the question back to Claude Code so you can answer it there.
- If you answer in Claude Code directly, the buttons go away automatically.
- If you don't answer within 10 minutes, or the widget isn't running, Claude Code shows its usual permission prompt.

Questions and plan approvals still need to be answered in the agent itself. For those, the card shows **Open to respond**.

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

The hooks stay out of an agent's way. They post to `127.0.0.1:47321` with a 1-second timeout, always exit 0, and stay silent when the widget isn't running. The one exception is the permission hook, which waits for your Approve or Deny.

## Other agents / scripts

Anything that can run a shell command can report to the widget:

```bash
~/.agentradar/agentradar-hook.sh notify my-agent working "Migrating the database"
~/.agentradar/agentradar-hook.sh notify my-agent needs_input "Approve dropping the users table?"
~/.agentradar/agentradar-hook.sh notify my-agent done "Migration complete"
```

Or POST JSON to `http://127.0.0.1:47321/event` with the header `X-Agent-Source: <name>` and a body of `{ "session_id", "project", "status": "working|needs_input|done|idle", "message" }`.

## Building the desktop apps

```bash
npm run dist:mac     # → dist/Agent-Radar-<version>-mac-<arch>.dmg / .zip
npm run dist:win     # → .exe installer (build on Windows, or in CI)
npm run dist:linux   # → .AppImage and .deb
```

`npm run icons` regenerates `build/icon.png` and the tray icons from the SVG in `scripts/make-icons.js`.

### CI/CD (GitHub Actions)
`.github/workflows/build.yml` builds the macOS, Windows and Linux apps on GitHub's runners:

| Trigger | What happens |
|---|---|
| Push to `main`, or a pull request | Builds all three; installers are downloadable from the run's **Artifacts** |
| Push a tag like `v0.2.0` | Same, plus uploads them to a **draft GitHub Release** you can review and publish |
| **Run workflow** button | Manual build |

To ship a release:

```bash
npm version patch          # bumps package.json (0.1.0 → 0.1.1) and creates the v0.1.1 tag
git push --follow-tags
```

The tag must match the version in `package.json`, or the workflow stops with an error.

### Code signing (optional)
Without signing, the apps still build and work, but:
- **macOS** says the app "can't be opened" or "is damaged". Right-click → **Open**, or run `xattr -dr com.apple.quarantine "/Applications/Agent Radar.app"` once.
- **Windows** SmartScreen warns about an unknown publisher. Click **More info → Run anyway**.

To sign, add these repository secrets (Settings → Secrets and variables → Actions):

| Secret | For |
|---|---|
| `MAC_CERTIFICATE_P12_BASE64`, `MAC_CERTIFICATE_PASSWORD` | Developer ID Application certificate (`base64 -i cert.p12`) |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | Notarization, which removes the macOS warning entirely |
| `WIN_CERTIFICATE_PFX_BASE64`, `WIN_CERTIFICATE_PASSWORD` | Windows code-signing certificate |

### Platform notes
- **macOS** has every feature.
- **Windows** works, including Claude Code hooks, which run through Git Bash (Claude Code on Windows requires it). Clicking a card doesn't switch to the agent's window yet.
- **Linux** works, but clicking a card doesn't switch windows yet, and "Launch at login" isn't offered. Some desktops need a compositor for the transparent widget.
- In the downloaded app, connect your agents from **••• → Connect agents** (it also offers on first launch). `npm` isn't needed.
