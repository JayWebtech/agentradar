#!/usr/bin/env node
// Plays a fake multi-agent session against a running Agent Radar so you can see every state.
const PORT = process.env.AGENT_RADAR_PORT || 47321;
const send = (source, body) => fetch(`http://127.0.0.1:${PORT}/event`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-agent-source': source },
  body: JSON.stringify(body),
}).catch(() => { console.error('Agent Radar is not running (npm start)'); process.exit(1); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const A = { session_id: 'demo-a', cwd: '/Users/you/code/checkout-app' };
const B = { session_id: 'demo-b', cwd: '/Users/you/code/marketing-site' };
const C = { conversation_id: 'demo-c', workspace_roots: ['/Users/you/code/api-server'] };

(async () => {
  await send('claude', { ...A, hook_event_name: 'UserPromptSubmit', prompt: 'Add Apple Pay to the checkout flow' });
  await send('cursor', { ...C, hook_event_name: 'beforeSubmitPrompt', prompt: 'Fix the failing auth tests' });
  await send('antigravity', { status: 'working', project: 'marketing-site', message: 'Redesigning the pricing page', session_id: 'demo-b' });
  await wait(1200);
  await send('claude', { ...A, hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: '/x/src/checkout/Payment.tsx' } });
  await send('cursor', { ...C, hook_event_name: 'afterFileEdit', file_path: '/x/tests/auth.test.ts' });
  await wait(1500);
  await send('claude', { ...A, hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: '/x/src/checkout/Payment.tsx' } });
  await wait(1500);
  await send('claude', { ...A, hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'npm install @stripe/stripe-js' } });
  await send('claude', { ...A, hook_event_name: 'Notification', notification_type: 'permission_prompt', message: 'Claude needs your permission to use Bash' });
  await wait(2500);
  await send('cursor', { ...C, hook_event_name: 'stop', status: 'completed' });
  console.log('Demo running — the checkout-app card is waiting for you. Ctrl+C or wait to finish.');
  await wait(6000);
  await send('claude', { ...A, hook_event_name: 'PostToolUse', tool_name: 'Bash' });
  await send('claude', { ...A, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'npm test' } });
  await wait(2000);
  await send('claude', { ...A, hook_event_name: 'Stop' });
  console.log('Demo finished.');
})();
