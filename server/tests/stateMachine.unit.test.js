const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createStateMachine } = require('../utils/stateMachine');
const { createJobStateMachine } = require('../utils/jobStateMachine');
const {
  extractionStateMachine,
  canManualRetry,
} = require('../modules/document-intelligence/extraction/extraction-state-machine');

describe('Shared StateMachine & JobStateMachine Unit Tests', () => {
  it('createStateMachine validates valid/invalid transitions, unknown states, and terminal states', () => {
    const machine = createStateMachine({
      name: 'Order',
      transitions: {
        NEW: ['PAID', 'CANCELLED'],
        PAID: ['SHIPPED'],
        SHIPPED: [],
        CANCELLED: [],
      },
      terminalStates: ['SHIPPED', 'CANCELLED'],
    });

    assert.strictEqual(machine.canTransition('NEW', 'PAID'), true);
    assert.strictEqual(machine.assertTransition('NEW', 'PAID'), true);
    assert.strictEqual(machine.canTransition('PAID', 'NEW'), false);
    assert.strictEqual(machine.canTransition('UNKNOWN', 'PAID'), false);
    assert.strictEqual(machine.canTransition('NEW', 'UNKNOWN'), false);
    assert.strictEqual(machine.isTerminal('SHIPPED'), true);
    assert.strictEqual(machine.isTerminal('NEW'), false);
    assert.deepStrictEqual(machine.getNextStates('NEW'), ['PAID', 'CANCELLED']);

    assert.throws(() => machine.assertTransition('SHIPPED', 'PAID'), {
      code: 'INVALID_STATE_TRANSITION',
    });
    assert.throws(() => machine.assertTransition('NOPE', 'PAID'), {
      code: 'UNKNOWN_STATE',
    });
    assert.throws(() => machine.assertTransition('NEW', 'NOPE'), {
      code: 'UNKNOWN_STATE',
    });
  });

  it('createStateMachine rejects invalid transition-map configurations', () => {
    assert.throws(() => createStateMachine({ name: '', transitions: { A: [] } }));
    assert.throws(() => createStateMachine({ name: 'Bad', transitions: {} }));
    assert.throws(() =>
      createStateMachine({
        name: 'BadTarget',
        transitions: { A: ['MISSING'] },
      })
    );
    assert.throws(() =>
      createStateMachine({
        name: 'BadTerminal',
        transitions: { A: ['B'], B: [] },
        terminalStates: ['A'],
      })
    );
  });

  it('createJobStateMachine supports retry policy, backoff, and lease reclamation checks', () => {
    const jm = createJobStateMachine({ name: 'GenericJob', baseRetryDelayMs: 1000 });

    assert.strictEqual(jm.canTransition('QUEUED', 'PROCESSING'), true);
    assert.strictEqual(jm.canTransition('PROCESSING', 'RETRY_WAIT'), true);
    assert.strictEqual(jm.canTransition('RETRY_WAIT', 'PROCESSING'), true);
    assert.strictEqual(jm.canTransition('COMPLETED', 'PROCESSING'), false);

    assert.strictEqual(jm.canRetryAutomatically({ attemptCount: 1, maximumAttempts: 3, retryable: true }), true);
    assert.strictEqual(jm.canRetryAutomatically({ attemptCount: 3, maximumAttempts: 3, retryable: true }), false);
    assert.strictEqual(jm.canRetryAutomatically({ attemptCount: 1, maximumAttempts: 3, retryable: false }), false);

    assert.strictEqual(jm.computeRetryDelayMs({ attemptCount: 1 }), 1000);
    assert.strictEqual(jm.computeRetryDelayMs({ attemptCount: 3 }), 4000);

    const past = new Date(Date.now() - 5000);
    const future = new Date(Date.now() + 5000);
    assert.strictEqual(jm.isLeaseExpired(past), true);
    assert.strictEqual(jm.isLeaseExpired(future), false);
    assert.strictEqual(
      jm.canReclaimLease({ status: 'PROCESSING', leaseExpiresAt: past, attemptCount: 1, maximumAttempts: 3 }),
      true
    );
    assert.strictEqual(
      jm.canReclaimLease({ status: 'PROCESSING', leaseExpiresAt: past, attemptCount: 3, maximumAttempts: 3 }),
      false
    );
    assert.strictEqual(
      jm.canReclaimLease({ status: 'COMPLETED', leaseExpiresAt: past, attemptCount: 1, maximumAttempts: 3 }),
      false
    );
  });

  it('extractionStateMachine enforces Module 2 lifecycle, manual retry, and security terminal states', () => {
    assert.strictEqual(extractionStateMachine.canTransition('QUEUED', 'PROCESSING'), true);
    assert.strictEqual(extractionStateMachine.canTransition('PROCESSING', 'BLOCKED_SECURITY_SCAN'), true);
    assert.strictEqual(extractionStateMachine.canTransition('PROCESSING', 'NEEDS_OCR'), true);
    assert.strictEqual(extractionStateMachine.canTransition('PROCESSING', 'REJECTED'), true);

    // Terminal states cannot reopen
    for (const term of ['COMPLETED', 'NEEDS_OCR', 'BLOCKED_SECURITY_SCAN', 'REJECTED']) {
      assert.strictEqual(extractionStateMachine.isTerminal(term), true);
      assert.strictEqual(extractionStateMachine.canTransition(term, 'QUEUED'), false);
      assert.strictEqual(extractionStateMachine.canTransition(term, 'PROCESSING'), false);
      assert.strictEqual(canManualRetry(term), false);
    }

    assert.strictEqual(extractionStateMachine.isSecurityBlocked('BLOCKED_SECURITY_SCAN'), true);
    assert.strictEqual(extractionStateMachine.isSecurityBlocked('FAILED'), false);

    // FAILED may only transition to QUEUED (manual retry), never directly to PROCESSING
    assert.strictEqual(canManualRetry('FAILED'), true);
    assert.strictEqual(extractionStateMachine.canTransition('FAILED', 'QUEUED'), true);
    assert.strictEqual(extractionStateMachine.canTransition('FAILED', 'PROCESSING'), false);
  });
});
