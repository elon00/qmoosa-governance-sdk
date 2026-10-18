import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VoteType,
  buildProposeIntent,
  buildVoteIntent,
  calculateTimelockStatus,
  calculateQuorumMetrics,
  GovernanceClient
} from '../dist/index.js';

test('Governance SDK: Intent Signature Builders', () => {
  const proposer = '0x1111111111111111111111111111111111111111';
  const desc = 'Fund Community Treasury';

  const proposeIntent = buildProposeIntent(proposer, desc);
  assert.equal(proposeIntent.payload, `${proposer}:PROPOSE:${desc}`);
  assert.equal(typeof proposeIntent.signature, 'string');
  assert.equal(proposeIntent.signature.length, 64);

  assert.throws(() => buildProposeIntent('', desc), /INVALID_PROPOSER_ADDRESS/);
  assert.throws(() => buildProposeIntent(proposer, ''), /EMPTY_DESCRIPTION/);

  const voter = '0x2222222222222222222222222222222222222222';
  const voteIntent = buildVoteIntent(voter, '42', VoteType.For);
  assert.equal(voteIntent.payload, `${voter}:VOTE:42:1`);
  assert.equal(typeof voteIntent.signature, 'string');
  assert.equal(voteIntent.signature.length, 64);

  assert.throws(() => buildVoteIntent('', '42', VoteType.For), /INVALID_VOTER_ADDRESS/);
  assert.throws(() => buildVoteIntent(voter, '', VoteType.For), /INVALID_PROPOSAL_ID/);
  assert.throws(() => buildVoteIntent(voter, '42', 99), /INVALID_VOTE_TYPE/);
});

test('Governance SDK: Timelock Status Evaluation', () => {
  const now = 1_000_000;
  const eta = now + 86400; // 1 day in future
  const grace = 14 * 86400;

  // 1. Not queued
  const statusNotQueued = calculateTimelockStatus(0, now);
  assert.equal(statusNotQueued.status, 'NOT_QUEUED');
  assert.equal(statusNotQueued.isReady, false);

  // 2. Locked
  const statusLocked = calculateTimelockStatus(eta, now, grace);
  assert.equal(statusLocked.status, 'LOCKED');
  assert.equal(statusLocked.isReady, false);
  assert.equal(statusLocked.timeRemainingSeconds, 86400);

  // 3. Ready
  const statusReady = calculateTimelockStatus(eta, eta + 10, grace);
  assert.equal(statusReady.status, 'READY');
  assert.equal(statusReady.isReady, true);
  assert.equal(statusReady.isExpired, false);

  // 4. Expired
  const statusExpired = calculateTimelockStatus(eta, eta + grace + 10, grace);
  assert.equal(statusExpired.status, 'EXPIRED');
  assert.equal(statusExpired.isReady, false);
  assert.equal(statusExpired.isExpired, true);
});

test('Governance SDK: Quorum Metrics Calculation', () => {
  const quorum = 400_000n * 10n ** 18n;

  // Below quorum (50%)
  const below = calculateQuorumMetrics(200_000n * 10n ** 18n, 0n, quorum);
  assert.equal(below.quorumReached, false);
  assert.equal(below.percentageBps, 5000);

  // Exact quorum (100%)
  const exact = calculateQuorumMetrics(400_000n * 10n ** 18n, 0n, quorum);
  assert.equal(exact.quorumReached, true);
  assert.equal(exact.percentageBps, 10000);

  // Above quorum (capped at 10000 bps)
  const above = calculateQuorumMetrics(600_000n * 10n ** 18n, 0n, quorum);
  assert.equal(above.quorumReached, true);
  assert.equal(above.percentageBps, 10000);
});

test('Governance SDK: Client Proposal Validation & Immutability', () => {
  const client = new GovernanceClient();
  const proposer = '0x1111111111111111111111111111111111111111';

  // Empty actions rejected
  assert.throws(
    () => client.validateProposal({ proposer, description: 'Test', actions: [] }),
    /EMPTY_PROPOSAL_ACTIONS/
  );

  // Valid proposal preparation
  const prep = client.preparePropose({
    proposer,
    description: 'Grant Proposal',
    actions: [{ target: '0xTarget', value: 0n, signature: 'transfer()', calldata: '0x' }]
  });

  assert.ok(prep.intent.signature);
  assert.ok(Object.isFrozen(prep));
  assert.ok(Object.isFrozen(prep.request));
  assert.ok(Object.isFrozen(prep.request.actions[0]));
});
