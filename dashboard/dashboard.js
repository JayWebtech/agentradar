// Agent Radar dashboard: turns task history into stats and charts (plain SVG, no libraries).
(function () {
  const $ = (id) => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const DAY = 86400000;

  // Fixed agent → color mapping (color follows the entity, never its rank)
  const AGENTS = [
    { key: 'claude', label: 'Claude', color: 'var(--series-claude)' },
    { key: 'cursor', label: 'Cursor', color: 'var(--series-cursor)' },
    { key: 'antigravity', label: 'Antigravity', color: 'var(--series-antigravity)' },
    { key: 'other', label: 'Other', color: 'var(--series-other)' },
  ];
  const agentOf = (src) => AGENTS.find((a) => a.key === src) || AGENTS[3];
  const TIME_SERIES = [
    { key: 'working', label: 'Agent working', color: 'var(--series-working)' },
    { key: 'waiting', label: 'Waiting on you', color: 'var(--series-waiting)' },
  ];

  let records = [];
  let period = localStorageGet('period') || '7d';

  // ---------------------------------------------------------------- formatting
  function dur(ms, short) {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60), mm = m % 60;
    return short || !mm ? `${h}h` + (mm ? ` ${mm}m` : '') : `${h}h ${String(mm).padStart(2, '0')}m`;
  }
  const minutes = (ms) => ms / 60000;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  function median(xs) {
    if (!xs.length) return 0;
    const a = [...xs].sort((x, y) => x - y), m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  function el(tag, attrs = {}, parent) {
    const isSvg = ['svg', 'g', 'rect', 'path', 'line', 'text'].includes(tag);
    const e = isSvg ? document.createElementNS(NS, tag) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'text') e.textContent = v; else if (k === 'class') e.setAttribute('class', v); else e.setAttribute(k, v);
    }
    if (parent) parent.append(e);
    return e;
  }
  function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

  // ---------------------------------------------------------------- periods & buckets
  function startOfDay(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }

  function range() {
    const now = Date.now();
    if (period === 'today') return { from: startOfDay(now), to: now, unit: 'hour' };
    if (period === '7d') return { from: startOfDay(now) - 6 * DAY, to: now, unit: 'day' };
    if (period === '30d') return { from: startOfDay(now) - 29 * DAY, to: now, unit: 'day' };
    const first = records.length ? Math.min(...records.map((r) => r.endedAt)) : now;
    const days = Math.ceil((now - startOfDay(first)) / DAY);
    return { from: startOfDay(first), to: now, unit: days > 60 ? 'week' : 'day' };
  }

  function buckets({ from, to, unit }) {
    const out = [];
    const step = unit === 'hour' ? 3600000 : unit === 'week' ? 7 * DAY : DAY;
    for (let t = from; t <= to; t += step) {
      const d = new Date(t);
      const label = unit === 'hour' ? d.toLocaleTimeString([], { hour: 'numeric' })
        : d.toLocaleDateString([], unit === 'week' ? { month: 'short', day: 'numeric' } : period === '7d' ? { weekday: 'short' } : { month: 'short', day: 'numeric' });
      const full = unit === 'hour' ? d.toLocaleString([], { weekday: 'short', hour: 'numeric' })
        : unit === 'week' ? `Week of ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}` : d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
      out.push({ start: t, end: t + step, label, full, items: [] });
    }
    return out;
  }

  // ---------------------------------------------------------------- render
  function render() {
    const r = range();
    const inRange = records.filter((x) => x.endedAt >= r.from && x.endedAt <= r.to);
    const empty = records.length === 0;
    $('main').hidden = empty;
    $('empty').hidden = !empty;
    if (empty) return;

    renderKpis(inRange);
    const bs = buckets(r);
    for (const x of inRange) {
      const b = bs.find((b) => x.endedAt >= b.start && x.endedAt < b.end) || bs[bs.length - 1];
      b.items.push(x);
    }

    // Tasks per bucket, stacked by agent
    const usedAgents = AGENTS.filter((a) => inRange.some((x) => agentOf(x.source) === a));
    legend('lg-tasks', usedAgents);
    stackedBars($('ch-tasks'), {
      buckets: bs,
      series: usedAgents,
      value: (b, s) => b.items.filter((x) => agentOf(x.source) === s).length,
      fmt: (v) => String(v),
      tipTotal: (t) => plural(t, 'task'),
      integer: true,
    });

    // Agent time vs waiting time per bucket (minutes)
    legend('lg-time', TIME_SERIES);
    stackedBars($('ch-time'), {
      buckets: bs,
      series: TIME_SERIES,
      value: (b, s) => minutes(b.items.reduce((sum, x) => sum + (s.key === 'waiting' ? x.waitMs : x.durationMs - x.waitMs), 0)),
      fmt: (v) => dur(v * 60000, true),
      axisFmt: (v) => (v === 0 ? '0' : v % 60 === 0 ? `${v / 60}h` : v > 60 ? `${Math.floor(v / 60)}h ${v % 60}m` : `${v}m`),
      minutesAxis: true,
      tipTotal: (t) => `${dur(t * 60000, true)} total`,
    });

    // Task length histogram
    const BINS = [
      { label: '< 1m', max: 60e3 }, { label: '1–5m', max: 300e3 }, { label: '5–15m', max: 900e3 },
      { label: '15–30m', max: 1800e3 }, { label: '30–60m', max: 3600e3 }, { label: '1h+', max: Infinity },
    ];
    const hist = BINS.map((bin, i) => ({
      label: bin.label, full: `Tasks that took ${bin.label}`,
      items: inRange.filter((x) => x.durationMs < bin.max && x.durationMs >= (i ? BINS[i - 1].max : 0)),
    }));
    stackedBars($('ch-length'), {
      buckets: hist,
      series: [{ key: 'n', label: 'Tasks', color: 'var(--series-working)' }],
      value: (b) => b.items.length,
      fmt: (v) => String(v),
      tipTotal: null,
      integer: true,
    });

    // Projects by agent time
    const byProject = new Map();
    for (const x of inRange) {
      const p = byProject.get(x.project) || { project: x.project, ms: 0, n: 0 };
      p.ms += x.durationMs - x.waitMs; p.n++;
      byProject.set(x.project, p);
    }
    hBars($('ch-projects'), [...byProject.values()].sort((a, b) => b.ms - a.ms).slice(0, 6));

    renderTable(inRange);
  }

  function renderKpis(xs) {
    const n = xs.length;
    const agentMs = xs.reduce((s, x) => s + x.durationMs - x.waitMs, 0);
    const waits = xs.reduce((s, x) => s + x.waits, 0);
    const waitMs = xs.reduce((s, x) => s + x.waitMs, 0);
    const approvals = xs.reduce((s, x) => s + x.approvals, 0);
    const denials = xs.reduce((s, x) => s + x.denials, 0);
    const failed = xs.filter((x) => x.outcome === 'error').length;
    const lengths = xs.map((x) => x.durationMs);

    const tiles = [
      { label: 'Tasks finished', value: String(n), sub: failed ? `${failed} ended with an error` : n ? 'all finished cleanly' : 'none in this period' },
      { label: 'Agent time', value: dur(agentMs, true), sub: 'working on your tasks' },
      { label: 'Typical task', value: n ? dur(median(lengths), true) : '—', sub: n ? `longest ${dur(Math.max(...lengths), true)}` : '' },
      { label: 'Your response time', value: waits ? dur(waitMs / waits, true) : '—', sub: waits ? `avg over ${plural(waits, 'request')} · ${dur(waitMs, true)} total` : 'no waits — nice' },
      { label: 'Answered from widget', value: String(approvals + denials), sub: approvals + denials ? `${approvals} approved · ${denials} denied` : 'approve / deny from the card' },
    ];
    $('kpis').replaceChildren(...tiles.map((t) => {
      const k = el('div', { class: 'kpi' });
      el('div', { class: 'label', text: t.label }, k);
      el('div', { class: 'value', text: t.value }, k);
      el('div', { class: 'sub', text: t.sub }, k);
      return k;
    }));
  }

  function legend(id, series) {
    $(id).replaceChildren(...(series.length > 1 ? series.map((s) => {
      const sp = el('span'); const i = el('i'); i.style.setProperty('--c', s.color); sp.append(i, s.label); return sp;
    }) : []));
  }

  // ---------------------------------------------------------------- stacked bar chart
  function niceMax(v, integer) {
    if (v <= 0) return integer ? 4 : 1;
    const exp = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / exp;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    let max = step * exp;
    if (integer) max = Math.max(4, Math.ceil(max / 4) * 4);
    return max;
  }

  // Minutes axis: round steps (5m, 10m, 15m, 30m, 1h, 2h…) so ticks read cleanly
  function niceMinutes(v) {
    const steps = [1, 2, 5, 10, 15, 30, 60, 120, 180, 240, 360, 480, 720, 1440];
    const step = steps.find((st) => st * 4 >= v) || Math.ceil(v / 4 / 1440) * 1440;
    return step * 4;
  }

  function stackedBars(host, { buckets, series, value, fmt, axisFmt = fmt, tipTotal, integer, minutesAxis }) {
    host.replaceChildren();
    const W = host.clientWidth, H = host.clientHeight;
    const M = { l: 40, r: 6, t: 8, b: 24 };
    const iw = W - M.l - M.r, ih = H - M.t - M.b;
    const data = buckets.map((b) => ({ b, vals: series.map((s) => value(b, s)) }));
    const totals = data.map((d) => d.vals.reduce((a, c) => a + c, 0));
    if (!totals.some((t) => t > 0)) { el('div', { class: 'nodata', text: 'Nothing in this period yet' }, host); return; }
    const max = minutesAxis ? niceMinutes(Math.max(...totals)) : niceMax(Math.max(...totals), integer);
    const y = (v) => M.t + ih - (v / max) * ih;

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' }, host);
    // grid + y axis (recessive)
    const axis = el('g', { class: 'axis' }, svg);
    for (let i = 0; i <= 4; i++) {
      const v = (max / 4) * i, yy = Math.round(y(v)) + 0.5;
      if (i) el('line', { class: 'gridline', x1: M.l, x2: W - M.r, y1: yy, y2: yy }, svg);
      el('text', { x: M.l - 8, y: yy + 4, 'text-anchor': 'end', text: axisFmt(v) }, axis);
    }
    el('line', { class: 'baseline', x1: M.l, x2: W - M.r, y1: y(0) + 0.5, y2: y(0) + 0.5 }, svg);

    const band = iw / data.length;
    const bw = Math.max(4, Math.min(30, band * 0.62));
    const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(iw / 46)));

    data.forEach((d, i) => {
      const cx = M.l + band * i + band / 2;
      const x0 = cx - bw / 2;
      // segments bottom-up, 2px surface gap between them, 4px rounded top on the topmost
      let acc = 0;
      const top = d.vals.reduce((last, v, j) => (v > 0 ? j : last), -1);
      d.vals.forEach((v, j) => {
        if (v <= 0) return;
        const yTop = y(acc + v), yBot = y(acc);
        const h = Math.max(1, yBot - yTop - (acc > 0 ? 2 : 0));
        const yy = yBot - (acc > 0 ? 2 : 0) - h;
        const r = j === top ? Math.min(4, h, bw / 2) : 0;
        el('path', {
          d: `M${x0},${yy + h} V${yy + r} Q${x0},${yy} ${x0 + r},${yy} H${x0 + bw - r} Q${x0 + bw},${yy} ${x0 + bw},${yy + r} V${yy + h} Z`,
          fill: series[j].color,
        }, svg);
        acc += v;
      });
      if (i % labelEvery === 0) el('text', { x: cx, y: H - 6, 'text-anchor': 'middle', text: d.b.label }, axis);

      // hover target: whole column, bigger than the bar
      const hit = el('rect', { class: 'hit', x: M.l + band * i, y: M.t, width: band, height: ih, rx: 6 }, svg);
      hit.addEventListener('mousemove', (e) => tip(e, d.b.full || d.b.label,
        series.map((s, j) => ({ label: s.label, color: s.color, value: fmt(d.vals[j]) })),
        tipTotal && series.length > 1 ? tipTotal(totals[i]) : null));
      hit.addEventListener('mouseleave', hideTip);
    });
  }

  // ---------------------------------------------------------------- horizontal bars (projects)
  function hBars(host, rows) {
    host.replaceChildren();
    if (!rows.length) { el('div', { class: 'nodata', text: 'Nothing in this period yet' }, host); return; }
    const W = host.clientWidth, H = host.clientHeight;
    const labelW = Math.min(170, W * 0.34), valueW = 64;
    const rowH = Math.min(32, H / rows.length);
    const bh = Math.min(14, rowH * 0.5);
    const max = Math.max(...rows.map((r) => r.ms)) || 1;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' }, host);
    rows.forEach((r, i) => {
      const cy = rowH * i + rowH / 2;
      const len = Math.max(3, ((W - labelW - valueW) * r.ms) / max);
      const name = r.project.length > 22 ? r.project.slice(0, 21) + '…' : r.project;
      el('text', { class: 'bar-label', x: 0, y: cy + 4, text: name }, svg);
      const x0 = labelW, y0 = cy - bh / 2, rr = Math.min(4, bh / 2, len / 2);
      el('path', { d: `M${x0},${y0} H${x0 + len - rr} Q${x0 + len},${y0} ${x0 + len},${y0 + rr} V${y0 + bh - rr} Q${x0 + len},${y0 + bh} ${x0 + len - rr},${y0 + bh} H${x0} Z`, fill: 'var(--series-working)' }, svg);
      el('text', { class: 'bar-value', x: x0 + len + 8, y: cy + 4, text: dur(r.ms, true) }, svg);
      const hit = el('rect', { class: 'hit', x: 0, y: rowH * i, width: W, height: rowH, rx: 6 }, svg);
      hit.addEventListener('mousemove', (e) => tip(e, r.project, [
        { label: 'Agent time', color: 'var(--series-working)', value: dur(r.ms, true) },
        { label: 'Tasks', value: String(r.n) },
        { label: 'Avg per task', value: dur(r.ms / r.n, true) },
      ]));
      hit.addEventListener('mouseleave', hideTip);
    });
  }

  // ---------------------------------------------------------------- tooltip
  function tip(e, title, rows, total) {
    const t = $('tip');
    t.replaceChildren(el('b', { text: title }));
    for (const r of rows) {
      const row = el('div', { class: 'row' }, t);
      if (r.color) { const i = el('i'); i.style.setProperty('--c', r.color); row.append(i); }
      row.append(el('span', { text: r.label }), el('span', { text: r.value }));
    }
    if (total) el('div', { class: 'row total' }, t).append(el('span', { text: 'Total' }), el('span', { text: total }));
    t.hidden = false;
    const pad = 14, w = t.offsetWidth, h = t.offsetHeight;
    let x = e.clientX + pad, y = e.clientY + pad;
    if (x + w > innerWidth - 8) x = e.clientX - w - pad;
    if (y + h > innerHeight - 8) y = e.clientY - h - pad;
    t.style.left = `${x}px`; t.style.top = `${y}px`;
  }
  function hideTip() { $('tip').hidden = true; }

  // ---------------------------------------------------------------- table
  function renderTable(xs) {
    const rows = [...xs].sort((a, b) => b.endedAt - a.endedAt).slice(0, 25);
    $('recent-count').textContent = xs.length > 25 ? `latest 25 of ${xs.length}` : plural(xs.length, 'task');
    const RESULT = { done: 'Finished', error: 'Error', stopped: 'Stopped', interrupted: 'Replaced' };
    $('recent').tBodies[0].replaceChildren(...rows.map((x) => {
      const tr = el('tr');
      const when = new Date(x.endedAt);
      const sameDay = startOfDay(x.endedAt) === startOfDay(Date.now());
      el('td', { text: sameDay ? when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : when.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }, tr);
      const a = agentOf(x.source);
      const td = el('td', {}, tr); const sp = el('span', { class: 'agent' }, td); const i = el('i'); i.style.setProperty('--c', a.color); sp.append(i, a.key === 'other' ? x.source : a.label);
      el('td', { text: x.project }, tr);
      el('td', { class: 'task', text: x.prompt || '—', title: x.prompt || '' }, tr);
      el('td', { class: 'num', text: dur(x.durationMs) }, tr);
      el('td', { class: 'num', text: x.waitMs ? dur(x.waitMs) : '—' }, tr);
      el('td', { class: 'num', text: String(x.tools || 0) }, tr);
      el('td', {}, tr).append(el('span', { class: `result ${x.outcome}`, text: RESULT[x.outcome] || x.outcome }));
      return tr;
    }));
  }

  // ---------------------------------------------------------------- wiring
  function setPeriod(p) {
    period = p; localStorageSet('period', p);
    for (const b of document.querySelectorAll('#period button')) b.classList.toggle('on', b.dataset.p === p);
    render();
  }
  for (const b of document.querySelectorAll('#period button')) b.addEventListener('click', () => setPeriod(b.dataset.p));
  $('clear').addEventListener('click', async () => { if (await window.radarHistory.clear()) { records = []; render(); } });
  if (!/Mac/.test(navigator.platform)) document.body.classList.add('no-inset');
  let resizeT; addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(render, 80); });

  window.radarHistory.onUpdate((r) => { records = r; render(); });
  window.radarHistory.get().then((r) => { records = r; setPeriod(period); });
  setInterval(render, 60000); // roll "today" over at midnight, refresh relative labels
})();
