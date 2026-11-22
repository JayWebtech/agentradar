const $ = (id) => document.getElementById(id);
const widget = $('widget');
const frame = $('frame');
const list = $('list');
const headline = $('headline');
const sub = $('sub');

const SRC = {
  claude: { name: 'Claude', glyph: 'M8 1.5l1.2 4.1L13 4l-2.4 3.4L14.5 9l-4.1.4L11 13.6 8 10.6l-3 3 .6-4.2L1.5 9l3.9-1.6L3 4l3.8 1.6z' },
  cursor: { name: 'Cursor', glyph: 'M3.5 2l9.5 5.2-4.1 1.1 2.6 4.6-1.9 1.1-2.6-4.6L4 12.5z' },
  antigravity: { name: 'Antigravity', glyph: 'M8 5.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6zM8 1.5c3.9 0 7 1.6 7 3.5 0 .9-.7 1.7-1.9 2.4l-.6-.9c.8-.5 1.3-1 1.3-1.5 0-1.2-2.6-2.4-5.8-2.4S2.2 3.8 2.2 5c0 .5.5 1 1.3 1.5l-.6.9C1.7 6.7 1 5.9 1 5c0-1.9 3.1-3.5 7-3.5z' },
  other: { name: 'Agent', glyph: 'M8 3a5 5 0 1 1 0 10A5 5 0 0 1 8 3z' },
};
const srcOf = (s) => SRC[s] ? s : 'other';
const srcName = (s) => (SRC[s] || { name: s }).name;

let state = { sessions: [], now: Date.now(), collapsed: false };
let skew = 0;
const seen = new Set();

// ----------------------------------------------------------- helpers
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function svg(path, viewBox = '0 0 16 16') {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', viewBox);
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', path);
  s.append(p);
  return s;
}
function clock(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
function ago(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}
const now = () => Date.now() - skew;

// a <time> that the 1s ticker keeps fresh
function liveTime(since, mode) {
  const t = el('time');
  t.dataset.since = since;
  t.dataset.mode = mode;
  t.textContent = mode === 'ago' ? ago(now() - since) : clock(now() - since);
  return t;
}
function tick() {
  for (const t of document.querySelectorAll('time[data-since]')) {
    const d = now() - Number(t.dataset.since);
    t.textContent = t.dataset.mode === 'ago' ? ago(d) : clock(d);
  }
}

// ----------------------------------------------------------- render
function render() {
  const { sessions, collapsed } = state;
  // keep CSS animations in phase across re-renders
  document.documentElement.style.setProperty('--phase', `-${(performance.now() % 7800) / 1000}s`);

  const waiting = sessions.filter((s) => s.status === 'needs_input');
  const working = sessions.filter((s) => s.status === 'working');
  const done = sessions.filter((s) => s.status === 'done');
  const mood = waiting.length ? 'waiting' : working.length ? 'working' : done.length ? 'done' : 'idle';

  widget.dataset.mood = mood;
  widget.classList.toggle('collapsed', collapsed);
  renderHeader({ sessions, waiting, working, done, collapsed });

  const cards = sessions.map((s) => card(s));
  if (!sessions.length) {
    const e = el('div', 'empty');
    e.append(el('b', null, 'All quiet'), el('span', null, 'Agents show up here the moment they start working.'));
    cards.push(e);
  }
  list.replaceChildren(...cards);
  for (const s of sessions) seen.add(s.key);

  requestAnimationFrame(() => window.radar.resize(frame.getBoundingClientRect().height));
}

function renderHeader({ sessions, waiting, working, done, collapsed }) {
  sub.replaceChildren();
  const top = sessions[0];

  if (collapsed && top && top.status !== 'idle') {
    // collapsed: show the single most important thing
    if (top.status === 'needs_input') headline.textContent = `${top.project} · ${top.ask?.title || 'needs you'}`;
    else headline.textContent = top.project;
    const line = el('span', 'muted', top.status === 'needs_input' ? srcName(top.source) + ' is waiting'
      : top.status === 'working' ? `${srcName(top.source)} · ${top.detail || 'Working'}` : `${srcName(top.source)} finished`);
    line.style.overflow = 'hidden'; line.style.textOverflow = 'ellipsis';
    if (top.status !== 'done') sub.append(liveTime(top.status === 'working' ? top.startedAt : top.updatedAt, 'clock'));
    sub.append(line);
    const others = sessions.length - 1;
    if (others > 0) sub.append(el('span', 'muted', `+${others}`));
    return;
  }

  headline.textContent = 'Agent Radar';
  const add = (n, cls, label) => {
    if (!n) return;
    const c = el('span', `count ${cls}`);
    c.append(el('i'), `${n} ${label}`);
    sub.append(c);
  };
  add(waiting.length, 'waiting', waiting.length > 1 ? 'need you' : 'needs you');
  add(working.length, 'working', 'working');
  add(done.length, 'done', 'done');
  if (!sub.childNodes.length) sub.append(el('span', 'muted', 'Listening for agents'));
}

function card(s) {
  const c = el('article', `card s-${s.status}`);
  if (seen.has(s.key)) c.classList.add('settled');
  c.title = 'Click to jump to this agent';
  c.addEventListener('click', () => window.radar.focus(s.key));

  const tile = el('div', `tile src-${srcOf(s.source)}`);
  tile.append(svg(SRC[srcOf(s.source)].glyph));
  c.append(tile);

  const body = el('div', 'body');
  const top = el('div', 'top');
  top.append(el('span', 'proj', s.project));
  top.append(pill(s));
  body.append(top);

  const meta = el('div', 'meta');
  meta.append(el('span', 'src-name', srcName(s.source)), ' · ');
  if (s.status === 'needs_input') meta.append(s.prompt || 'Waiting for you');
  else if (s.status === 'done') meta.append(s.prompt || s.detail || 'Finished');
  else meta.append(s.detail || 'Working');
  if (s.status === 'working' && s.tools) meta.append(el('span', 'src-name', ` · ${s.tools} step${s.tools === 1 ? "" : "s"}`));
  body.append(meta);

  if (s.status === 'needs_input' && s.ask) body.append(askBlock(s));
  c.append(body);

  if (s.status === 'working') c.append(el('div', 'progress'));

  if (s.status !== 'needs_input') {
    const x = el('button', 'x');
    x.title = 'Dismiss';
    x.append(svg('M3 3l10 10M13 3L3 13'));
    x.addEventListener('click', (e) => { e.stopPropagation(); window.radar.dismiss(s.key); });
    c.append(x);
  }
  return c;
}

function pill(s) {
  const p = el('span', 'pill');
  p.append(el('i'));
  if (s.status === 'working') p.append(liveTime(s.startedAt, 'clock'));
  else if (s.status === 'needs_input') p.append('Waiting ', liveTime(s.updatedAt, 'clock'));
  else if (s.status === 'done') p.append('Done · ', liveTime(s.finishedAt || s.updatedAt, 'ago'));
  else p.append('Idle');
  return p;
}

function askBlock(s) {
  const a = el('div', 'ask');
  a.append(el('div', 'ask-title', s.ask.title));
  if (s.ask.text) {
    const code = el('div', 'code', s.ask.text);
    if (s.ask.text.length < 120) code.classList.add('short');
    a.append(code);
  }
  const actions = el('div', 'actions');
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };

  if (s.ask.actionable) {
    const approve = el('button', 'btn btn-approve');
    approve.append(svg('M3.5 8.5l3 3 6-7'), 'Approve');
    approve.addEventListener('click', stop(() => window.radar.decide(s.key, 'allow')));
    const deny = el('button', 'btn btn-deny', 'Deny');
    deny.addEventListener('click', stop(() => window.radar.decide(s.key, 'deny')));
    const open = el('button', 'btn btn-link', 'Open ↗');
    open.title = 'Answer in the agent instead';
    open.addEventListener('click', stop(() => window.radar.decide(s.key, null)));
    actions.append(approve, deny, open);
  } else {
    const open = el('button', 'btn btn-primary', 'Open to respond');
    open.addEventListener('click', stop(() => window.radar.focus(s.key)));
    actions.append(open);
  }
  a.append(actions);
  return a;
}

// ----------------------------------------------------------- wiring
window.radar.onState((next) => {
  state = next;
  skew = Date.now() - next.now;
  render();
});
window.radar.onFlash(() => {
  widget.classList.remove('flash');
  void widget.offsetWidth;
  widget.classList.add('flash');
});
$('collapse').addEventListener('click', () => window.radar.toggleCollapsed());
$('menu').addEventListener('click', () => window.radar.menu());
setInterval(tick, 1000);
