import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path) {
  return readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');
}

test('agent resource tools keep tenant filters on every workspace table', async () => {
  const text = await source('lib/agent-tools.ts');
  for (const tenantFilter of [
    'eq(workflows.userId, userId)',
    'eq(executions.userId, userId)',
    'eq(forms.userId, userId)',
    'eq(contacts.userId, userId)',
    'eq(userIntegrations.userId, userId)',
    'eq(loggedEvents.userId, userId)',
  ]) {
    assert.ok(text.includes(tenantFilter), `missing tenant constraint: ${tenantFilter}`);
  }
});

test('approved action execution keeps tenant ownership checks', async () => {
  const text = await source('lib/agent-action-executor.ts');
  for (const tenantFilter of [
    'eq(agentProposedActions.userId, userId)',
    'eq(workflows.userId, userId)',
    'eq(executions.userId, userId)',
    'eq(forms.userId, userId)',
    'eq(contacts.userId, userId)',
    'eq(userIntegrations.userId, userId)',
  ]) {
    assert.ok(text.includes(tenantFilter), `missing action ownership constraint: ${tenantFilter}`);
  }
});

test('agent API entry points enforce feature access before workspace reads', async () => {
  const routes = [
    'app/api/agent/messages/route.ts',
    'app/api/agent/threads/route.ts',
    'app/api/agent/threads/[id]/messages/route.ts',
    'app/api/agent/runs/[id]/cancel/route.ts',
    'app/api/agent/usage/route.ts',
    'app/api/agent/failure-findings/route.ts',
    'app/api/agent/failure-findings/[id]/route.ts',
  ];
  for (const route of routes) {
    const text = await source(route);
    assert.ok(text.includes('canAccessAgentFeature'), `${route} is missing a release gate`);
  }
  assert.ok((await source('lib/agent-action-api.ts')).includes('canAccessAgentFeature'));
});

test('failure monitor supports an internal-release user allowlist', async () => {
  const monitor = await source('lib/failure-monitor.ts');
  const route = await source('app/api/agent/failure-monitor/scan/route.ts');
  assert.ok(monitor.includes('inArray(executions.userId, allowedUserIds)'));
  assert.ok(route.includes('getFailureMonitorAllowedUserIds'));
});

test('approved workflow definitions are revalidated and applied with tenant and version checks', async () => {
  const text = await source('lib/agent-action-executor.ts');
  assert.ok(text.includes('validateWorkflowForExecution'));
  assert.ok(text.includes("isAgentWorkflowActionType(actionType)"));
  assert.ok(text.includes('eq(workflows.userId, userId)'));
  assert.ok(text.includes('eq(workflows.updatedAt, current.updatedAt)'));
  assert.ok(text.includes("status: 'active'"));
  assert.ok(text.includes('crypto.randomUUID()'));
});

test('scheduled workflow proposals require an explicit valid timezone', async () => {
  const text = await source('lib/agent-workflow-proposals.ts');
  assert.ok(text.includes("code: 'TIMEZONE_REQUIRED'"));
  assert.ok(text.includes("code: 'INVALID_TIMEZONE'"));
  assert.ok(text.includes("snapshotFromParsedWorkflow(parsed.workflow, 'active')"));
});

test('quick mutations use proposals while event reads remain tenant scoped', async () => {
  const messages = await source('app/api/agent/messages/route.ts');
  const proposals = await source('lib/agent-quick-proposals.ts');
  const executor = await source('lib/agent-action-executor.ts');
  assert.ok(messages.includes('AGENT_QUICK_PROPOSAL_TOOLS'));
  assert.ok(proposals.includes("actionType: 'event.log'"));
  assert.ok(proposals.includes("actionType: 'email.send'"));
  assert.ok(executor.includes('isAgentQuickActionType(actionType)'));
});

test('legacy Quick Commands retire only at agent general availability', async () => {
  const route = await source('app/api/quick-command/route.ts');
  const layout = await source('app/dashboard/quick-commands/layout.tsx');
  assert.ok(route.includes("releasePolicy.releaseMode === 'general'"));
  assert.ok(route.includes('status: 410'));
  assert.ok(layout.includes("access.releaseMode === 'general'"));
  assert.ok(layout.includes("redirect('/dashboard/agent')"));
});
