const $ = (id) => document.getElementById(id);
const widget = $('widget');
const list = $('list');
const radarEl = $('radar');
const summary = $('summary');

const SRC_LABEL = { claude: 'Claude', cursor: 'Cursor', antigravity: 'Antigravity' };

function ago(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 45) return 'now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function render({ sessions, now, collapsed }) {
  widget.classList.toggle('collapsed', collapsed);

  const waiting = sessions.filter((s) => s.status === 'needs_input');
  const working = sessions.filter((s) => s.status === 'working');
  const done = sessions.filter((s) => s.status === 'done');

  widget.classList.toggle('alert', waiting.length > 0);
  radarEl.className = 'radar ' + (waiting.length ? 'waiting' : working.length ? 'working' : done.length ? 'done' : '');

  // summary line
  summary.replaceChildren();
  const parts = [];
  if (waiting.length) { const b = el('b', null, `${waiting.length} need${waiting.length > 1 ? '' : 's'} you`); parts.push(b); }
  if (working.length) parts.push(document.createTextNode(`${working.length} working`));
  if (done.length) parts.push(document.createTextNode(`${done.length} done`));
  if (!parts.length) parts.push(document.createTextNode('No active agents'));
  parts.forEach((p, i) => { if (i) summary.append(' · '); summary.append(p); });

  // cards
  list.replaceChildren();
  if (!sessions.length) {
    const e = el('div', 'empty');
    e.append('Waiting for agents… start a task in Claude Code, Cursor or Antigravity.');
    list.append(e);
  }
  for (const s of sessions) list.append(card(s, now));

  requestAnimationFrame(() => window.radar.resize(widget.getBoundingClientRect().height));
}

function card(s, now) {
  const c = el('div', `card ${s.status} clickable`);
  c.title = 'Click to jump to this agent';
  c.addEventListener('click', () => window.radar.focus(s.key));

  const row = el('div', 'row');
  row.append(el('span', `src ${s.source}`, SRC_LABEL[s.source] || s.source));
  row.append(el('span', 'proj', s.project));
  const since = s.status === 'working' ? now - s.startedAt : now - s.updatedAt;
  row.append(el('span', 'time', ago(since)));
  c.append(row);

  if (s.status === 'needs_input' && s.ask) {
    const a = el('div', 'ask');
    a.append(el('div', 'ask-title', s.ask.title));
    if (s.ask.text) a.append(el('div', 'ask-text', s.ask.text));
    const actions = el('div', 'actions');
    const open = el('button', 'btn', 'Open to respond');
    open.addEventListener('click', (e) => { e.stopPropagation(); window.radar.focus(s.key); });
    actions.append(open);
    a.append(actions);
    c.append(a);
  } else {
    const d = el('div', 'detail');
    const statusText = { working: 'Working', done: 'Done', idle: 'Idle' }[s.status] || s.status;
    d.append(el('span', 'status', statusText));
    const text = s.status === 'done' ? (s.prompt || s.detail) : s.detail;
    if (text) d.append(' · ' + text);
    if (s.status === 'working' && s.tools) d.append(` (${s.tools} steps)`);
    c.append(d);
  }

  const x = el('button', 'x', '×');
  x.title = 'Dismiss';
  x.addEventListener('click', (e) => { e.stopPropagation(); window.radar.dismiss(s.key); });
  c.append(x);
  return c;
}

window.radar.onState(render);
window.radar.onFlash(() => {
  widget.classList.remove('flash');
  void widget.offsetWidth;
  widget.classList.add('flash');
});
$('collapse').addEventListener('click', () => window.radar.toggleCollapsed());
$('menu').addEventListener('click', () => window.radar.menu());
