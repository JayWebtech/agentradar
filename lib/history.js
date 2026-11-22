// Task history: one JSON line per finished agent task, kept in the app's data folder.
// A "task" is one prompt → finish cycle of an agent session.
//
// Record shape:
//   { id, source, project, prompt, startedAt, endedAt, durationMs, waitMs, waits,
//     tools, approvals, denials, outcome: 'done' | 'error' | 'stopped' | 'interrupted' }

const fs = require('fs');
const path = require('path');

const MAX_RECORDS = 20000; // ~ years of heavy use; older lines are trimmed on load

class History {
  constructor(dir) {
    this.file = path.join(dir, 'history.jsonl');
    this.records = null;
  }

  all() {
    if (this.records) return this.records;
    this.records = [];
    try {
      for (const line of fs.readFileSync(this.file, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try { this.records.push(JSON.parse(line)); } catch { /* skip a corrupt line */ }
      }
    } catch (e) {
      if (e.code !== 'ENOENT') console.error('Agent Radar: could not read history', e.message);
    }
    if (this.records.length > MAX_RECORDS) {
      this.records = this.records.slice(-MAX_RECORDS);
      this.rewrite();
    }
    return this.records;
  }

  append(record) {
    this.all().push(record);
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.appendFileSync(this.file, JSON.stringify(record) + '\n');
    } catch (e) {
      console.error('Agent Radar: could not save history', e.message);
    }
  }

  clear() {
    this.records = [];
    try { fs.rmSync(this.file, { force: true }); } catch {}
  }

  rewrite() {
    try { fs.writeFileSync(this.file, this.records.map((r) => JSON.stringify(r)).join('\n') + '\n'); } catch {}
  }
}

module.exports = { History };
