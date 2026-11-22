#!/usr/bin/env node
// CLI wrapper around lib/hooks.js
//
//   node scripts/install-hooks.js                 install for every agent found
//   node scripts/install-hooks.js --uninstall     remove everything Agent Radar added
//   node scripts/install-hooks.js --antigravity   also add a rule telling Antigravity to report status

const { installHooks } = require('../lib/hooks');

const args = new Set(process.argv.slice(2));
const uninstall = args.has('--uninstall');
for (const line of installHooks({ uninstall, antigravity: args.has('--antigravity') })) console.log(line);
console.log(uninstall
  ? '\nAgent Radar hooks removed.'
  : '\nDone. New agent sessions will now report to Agent Radar (restart open sessions to pick up hooks).');
