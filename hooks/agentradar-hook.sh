#!/bin/sh
# Agent Radar hook — forwards an agent's hook payload (stdin JSON) to the widget.
#
#   As a hook:   agentradar-hook.sh <source>            (payload on stdin)
#   By hand:     agentradar-hook.sh notify <source> <working|needs_input|done|idle> "message" [project]
#
# It never blocks the agent: 1s timeout, always exits 0, and is silent when the widget isn't running.

PORT="${AGENT_RADAR_PORT:-47321}"
URL="http://127.0.0.1:$PORT/event"

if [ "$1" = "notify" ]; then
  SRC="${2:-agent}"; STATUS="${3:-working}"; MSG="${4:-}"; PROJ="${5:-$(basename "$PWD")}"
  esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' '; }
  BODY="{\"status\":\"$(esc "$STATUS")\",\"message\":\"$(esc "$MSG")\",\"project\":\"$(esc "$PROJ")\",\"cwd\":\"$(esc "$PWD")\"}"
  printf '%s' "$BODY" | curl -s -m 1 -o /dev/null -X POST \
    -H "Content-Type: application/json" -H "X-Agent-Source: $SRC" \
    -H "X-Bundle-Id: ${__CFBundleIdentifier:-}" \
    --data-binary @- "$URL" >/dev/null 2>&1
  exit 0
fi

# Permission request: wait for Approve / Deny in the widget and hand the answer back to the agent.
# If the widget isn't running (or you answer in the agent instead), nothing is printed and the
# agent shows its normal permission prompt.
if [ "$1" = "claude-permission" ]; then
  curl -s -m "${AGENT_RADAR_WAIT:-590}" -X POST \
    -H "Content-Type: application/json" -H "X-Agent-Source: claude" \
    -H "X-Bundle-Id: ${__CFBundleIdentifier:-}" \
    --data-binary @- "http://127.0.0.1:$PORT/permission" 2>/dev/null
  exit 0
fi

SRC="${1:-agent}"
curl -s -m 1 -o /dev/null -X POST \
  -H "Content-Type: application/json" -H "X-Agent-Source: $SRC" \
  -H "X-Bundle-Id: ${__CFBundleIdentifier:-}" \
  --data-binary @- "$URL" >/dev/null 2>&1

# Cursor hooks expect a JSON reply; an empty object / continue keeps default behaviour.
if [ "$SRC" = "cursor" ]; then printf '{"continue":true}\n'; fi
exit 0
