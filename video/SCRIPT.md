# Agent Radar: launch video script

**Length:** 60 seconds · **Format:** 1920×1080 · **Tone:** calm, confident, a little wry. The problem is relatable, so don't oversell it.
**Composition:** `index.html` (each scene below is a `.clip` with matching `data-start` / `data-duration`).

The voiceover (VO) lines are written to fit the scene lengths at a relaxed ~150 words per minute. On-screen text is shorter than the VO on purpose, so the video still works muted (e.g. on social feeds).

---

### Scene 1 · The handoff · 0:00 – 0:07
**Visual:** A desktop. A terminal window where an agent is busily working: lines stream in (`Reading src/checkout…`, `Editing Payment.tsx…`). The window slides aside and a browser window takes over the screen.
**On screen:** "You hand your app to an AI agent…" → "…and go do something else."
**VO:** "You give your coding agent a task. It starts building. So you do what anyone would: you switch to something else."

### Scene 2 · The problem · 0:07 – 0:14
**Visual:** Cut back to the terminal, now stalled on a permission prompt: `Allow command? npm install @stripe/stripe-js  › Yes / No`. A large amber timer counts up: **23:41 waiting**.
**On screen:** "Meanwhile, it's been waiting on you." → "For 23 minutes."
**VO:** "Twenty minutes later you check back… and it's been sitting there the whole time, waiting for you to click 'yes'."

### Scene 3 · Reveal · 0:14 – 0:20
**Visual:** Dark stage. The Agent Radar app icon scales in; its radar sweep turns once and an amber blip appears. The wordmark resolves beside it.
**On screen:** **Agent Radar**: "Your coding agents, always in sight."
**VO:** "Meet Agent Radar. A tiny widget that keeps your coding agents in sight."

### Scene 4 · Live status · 0:20 – 0:30
**Visual:** Desktop with the widget floating top-right (shown large). Three sessions: `checkout-app`, `api-server` (Claude), `marketing-site` (Antigravity). Their details update live (*Reading…, Editing Payment.tsx, Running: npm test*), timers tick, and the progress shimmer runs along the bottom of working cards.
**On screen:** "See every agent, live." · small: "What it's doing · how long · when it's done"
**VO:** "It floats above everything you're doing, and shows every agent session live: what it's working on, how long it's been at it, and when it's done."

### Scene 5 · Needs you · 0:30 – 0:41
**Visual:** `checkout-app` flips to **Needs you**: the card's amber border lights up, the command appears in a code box, and a notification slides in. A cursor glides over and clicks **Approve**. The card returns to *Working · Approved from Agent Radar*.
**On screen:** "Know the moment it needs you." → "Approve or deny without switching windows."
**VO:** "The moment an agent needs you, you'll know. See exactly what it's asking, and approve or deny it right there, without leaving what you're doing."

### Scene 6 · Out of the way · 0:41 – 0:47
**Visual:** The widget collapses smoothly into a slim pill: `api-server · Running: npm test · 2:14 · +2`.
**On screen:** "One line when you need focus."
**VO:** "Need to focus? Collapse it to a single line."

### Scene 7 · Works with · 0:47 – 0:53
**Visual:** Three tiles animate in: Claude Code, Cursor, Antigravity, using the widget's own agent glyphs. Small caption underneath.
**On screen:** "Works with Claude Code, Cursor and Antigravity." · small: "Connects through each agent's own hooks: one click to set up."
**VO:** "It works with Claude Code, Cursor and Antigravity, and connects in one click."

### Scene 8 · Call to action · 0:53 – 1:00
**Visual:** The app icon again, smaller, above the wordmark. Platform row fades in, then the URL.
**On screen:** **Agent Radar** · "Free & open source" · "macOS · Windows · Linux" · `github.com/JayWebtech/agentradar`
**VO:** "Agent Radar. Free, open source, on Mac, Windows and Linux. Stop babysitting your agents."

---

## What Agent Radar looks like (visual reference)

**Overall feel:** a small, dark, frosted-glass card that floats in the top-right corner of the desktop, like a macOS widget. Calm and minimal, with color used only for status.

- **Card:** near-black (`#0E0F13`, ~90% opaque), 20px rounded corners, a hairline white border, soft deep shadow. 340px wide in the real app; show it at 2× in the video.
- **Header:** a small round "radar orb" on the left, then **"Agent Radar"** (semibold) with status counts beneath: "● 1 needs you  ● 1 working  ● 1 done". A chevron and a "•••" button sit on the right.
- **Radar orb:** a ring with a glowing center dot. **Blue** with a rotating sweep while agents work, **amber** with a pulsing ring when one needs you, **green** when everything is done.
- **Session cards** (one per agent task): a rounded colored tile with the agent's glyph (**Claude** = orange starburst, **Cursor** = grey arrow, **Antigravity** = blue orbit), the project name in bold, and a status pill on the right:
  - **Working:** blue pill with a live timer (`2:14`); a gray line under the name ("Claude · Editing Payment.tsx · 9 steps"); a thin blue-to-violet shimmer sliding along the card's bottom edge.
  - **Needs you:** warm amber tint with a glowing amber border that slowly rotates. Shows "Allow command?", the command in a dark monospace box, then a white **Approve** button, a red-tinted **Deny** button and a subtle "Open ↗" link.
  - **Done:** green pill "Done · just now" and a summary line.
- **Collapsed state:** the card shrinks into a single 48px pill: the orb, the project name, and "2:14 · Claude · Running: npm test · +2".
- **Notification:** a macOS-style banner with the app icon: "Claude needs you · checkout-app / $ npm install @stripe/stripe-js".
- **App icon:** a dark rounded square with cyan radar rings, a cyan sweep line, and an amber blip in the upper right.
- **Colors:** working `#66D9FF` → `#7B7CFF` · needs you `#FFB84D` → `#FF7A45` · done `#5EE39A` · deny `#FF6B6B` · Claude `#E08A5F` · Cursor `#B9BCC8` · Antigravity `#7EA6FF` · text `#F4F4F6`.
- **Type:** Inter (SF Pro on Mac) for UI text; JetBrains Mono for timers and commands.

## HTML component (paste into a HyperFrames composition)

HyperFrames compositions are plain HTML, so this snippet renders the real widget in its "needs you" state, with one working card and one done card. Scale it with `transform: scale(2)` on `.ar-island`.

When animating, animate the inner pieces with GSAP rather than CSS keyframes:
- `.ar-orb-sweep`: rotate it while working.
- `.ar-progress-bar`: move it with `xPercent` from −100 to 250.
- `.ar-border`: tween its `--ar-angle` to spin the amber border.

```html
<style>
  .ar-island{width:340px;font:12px/1.4 Inter,-apple-system,sans-serif;color:#f4f4f6;background:radial-gradient(120% 80% at 0 0,rgba(120,140,255,.07),transparent 60%),rgba(14,15,19,.92);border-radius:20px;overflow:hidden;box-shadow:0 0 0 .5px rgba(255,255,255,.14) inset,0 18px 40px -12px rgba(0,0,0,.65)}
  .ar-head{display:flex;align-items:center;gap:11px;height:56px;padding:0 10px 0 14px}
  .ar-orb{position:relative;width:30px;height:30px;border-radius:50%;box-shadow:0 0 0 .5px rgba(255,255,255,.12) inset;--c:#ffb84d}
  .ar-orb-ring{position:absolute;inset:7px;border-radius:50%;box-shadow:0 0 0 1px rgba(255,184,77,.4) inset}
  .ar-orb-core{position:absolute;left:12px;top:12px;width:6px;height:6px;border-radius:50%;background:var(--c);box-shadow:0 0 10px var(--c)}
  .ar-orb-sweep{position:absolute;inset:0;border-radius:50%;opacity:0;background:conic-gradient(transparent 250deg,rgba(102,217,255,.7))}
  .ar-title{flex:1}.ar-title b{font-size:13px;font-weight:600}
  .ar-counts{display:flex;gap:8px;font-size:11px;color:rgba(244,244,246,.62)}
  .ar-counts i{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:5px;background:currentColor}
  .ar-list{display:flex;flex-direction:column;gap:6px;padding:0 8px 8px}
  .ar-card{position:relative;isolation:isolate;display:grid;grid-template-columns:30px 1fr;gap:11px;padding:11px 12px 12px 11px;border-radius:14px;background:rgba(255,255,255,.045);overflow:hidden}
  .ar-tile{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;color:var(--s);background:linear-gradient(145deg,color-mix(in srgb,var(--s) 32%,transparent),color-mix(in srgb,var(--s) 12%,transparent))}
  .ar-tile svg{width:15px;height:15px;fill:currentColor}
  .ar-top{display:flex;align-items:center;gap:8px}.ar-proj{flex:1;font-weight:600;font-size:12.5px}
  .ar-pill{display:inline-flex;align-items:center;gap:5px;height:19px;padding:0 7px;border-radius:999px;font-size:10.5px;font-weight:600;color:var(--c);background:color-mix(in srgb,var(--c) 13%,transparent)}
  .ar-pill i{width:5px;height:5px;border-radius:50%;background:currentColor}
  .mono{font-family:"JetBrains Mono",ui-monospace,monospace}
  .ar-meta{margin-top:3px;font-size:11.5px;color:rgba(244,244,246,.62)}.ar-meta span{color:rgba(244,244,246,.38)}
  .ar-progress{position:absolute;left:0;right:0;bottom:0;height:2px;overflow:hidden}
  .ar-progress-bar{position:absolute;top:0;bottom:0;left:0;width:40%;background:linear-gradient(90deg,transparent,#66d9ff,#7b7cff,transparent)}
  .ar-card.waiting{background:linear-gradient(180deg,rgba(255,184,77,.09),rgba(255,184,77,.03))}
  .ar-border{position:absolute;inset:0;z-index:-1;border-radius:inherit;padding:1px;--ar-angle:0deg;background:conic-gradient(from var(--ar-angle),rgba(255,184,77,.15),#ffb84d,#ff7a45,rgba(255,184,77,.15) 40%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor}
  .ar-ask-title{margin-top:8px;font-weight:600;color:#ffb84d}
  .ar-code{margin-top:6px;padding:8px 10px;border-radius:9px;background:rgba(0,0,0,.38);font-size:11px}
  .ar-actions{display:flex;align-items:center;gap:6px;margin-top:9px}
  .ar-btn{height:27px;padding:0 12px;border-radius:8px;font-size:11.5px;font-weight:600;display:inline-flex;align-items:center}
  .approve{background:#f4f4f6;color:#111}.deny{background:rgba(255,107,107,.12);color:#ff8f8f}.open{margin-left:auto;color:rgba(244,244,246,.38);font-weight:500}
</style>

<div class="ar-island">
  <header class="ar-head">
    <div class="ar-orb"><span class="ar-orb-sweep"></span><span class="ar-orb-ring"></span><span class="ar-orb-core"></span></div>
    <div class="ar-title"><b>Agent Radar</b>
      <div class="ar-counts"><span style="color:#ffb84d;font-weight:600"><i></i>1 needs you</span><span><i style="color:#66d9ff"></i>1 working</span><span><i style="color:#5ee39a"></i>1 done</span></div>
    </div>
    <span style="color:rgba(244,244,246,.38)">⌃ &nbsp;•••</span>
  </header>
  <div class="ar-list">
    <!-- NEEDS YOU -->
    <article class="ar-card waiting">
      <span class="ar-border"></span>
      <div class="ar-tile" style="--s:#e08a5f"><svg viewBox="0 0 16 16"><path d="M8 1.5l1.2 4.1L13 4l-2.4 3.4L14.5 9l-4.1.4L11 13.6 8 10.6l-3 3 .6-4.2L1.5 9l3.9-1.6L3 4l3.8 1.6z"/></svg></div>
      <div>
        <div class="ar-top"><span class="ar-proj">checkout-app</span><span class="ar-pill" style="--c:#ffb84d"><i></i>Waiting <span class="mono">0:12</span></span></div>
        <div class="ar-meta"><span>Claude</span> · Add Apple Pay to the checkout flow</div>
        <div class="ar-ask-title">Allow command?</div>
        <div class="ar-code mono">$ npm install @stripe/stripe-js</div>
        <div class="ar-actions"><span class="ar-btn approve">✓&nbsp; Approve</span><span class="ar-btn deny">Deny</span><span class="ar-btn open">Open ↗</span></div>
      </div>
    </article>
    <!-- WORKING -->
    <article class="ar-card">
      <div class="ar-tile" style="--s:#e08a5f"><svg viewBox="0 0 16 16"><path d="M8 1.5l1.2 4.1L13 4l-2.4 3.4L14.5 9l-4.1.4L11 13.6 8 10.6l-3 3 .6-4.2L1.5 9l3.9-1.6L3 4l3.8 1.6z"/></svg></div>
      <div>
        <div class="ar-top"><span class="ar-proj">api-server</span><span class="ar-pill" style="--c:#66d9ff"><i></i><span class="mono">2:14</span></span></div>
        <div class="ar-meta"><span>Claude</span> · Running: npm test -- auth · 6 steps</div>
      </div>
      <div class="ar-progress"><span class="ar-progress-bar"></span></div>
    </article>
    <!-- DONE -->
    <article class="ar-card">
      <div class="ar-tile" style="--s:#7ea6ff"><svg viewBox="0 0 16 16"><path d="M8 5.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6zM8 1.5c3.9 0 7 1.6 7 3.5 0 .9-.7 1.7-1.9 2.4l-.6-.9c.8-.5 1.3-1 1.3-1.5 0-1.2-2.6-2.4-5.8-2.4S2.2 3.8 2.2 5c0 .5.5 1 1.3 1.5l-.6.9C1.7 6.7 1 5.9 1 5c0-1.9 3.1-3.5 7-3.5z"/></svg></div>
      <div>
        <div class="ar-top"><span class="ar-proj">marketing-site</span><span class="ar-pill" style="--c:#5ee39a"><i></i>Done · <span class="mono">just now</span></span></div>
        <div class="ar-meta"><span>Antigravity</span> · Redesigned the pricing page</div>
      </div>
    </article>
  </div>
</div>
```

**Other states:**
- **All working:** remove the `waiting` class, the border, the ask lines and the buttons. Make the orb blue (`--c:#66d9ff`) and give `.ar-orb-sweep` `opacity:1`.
- **Collapsed:** keep only the header, set `border-radius:24px` and `height:48px`, and replace the title with "api-server" plus "2:14 · Claude · Running: npm test · +2".

## Production notes
- **Music:** low, steady electronic bed (~100 BPM). Drop it slightly under the VO, and land a soft "blip" sound effect on the amber blip in Scene 3 and on the Needs-you state in Scene 5.
- **Sound effects:** subtle whoosh on the window swap (0:03.5), a tick on the Approve click (~0:37.5), and a soft swish on the collapse (0:42).
- **Voiceover:** record it, then add it as an `<audio>` clip at `data-start="0"` in `index.html`. Scene timings above match the VO lengths.
- **Short version (30s for social):** Scenes 2 → 3 → 5 → 8.
