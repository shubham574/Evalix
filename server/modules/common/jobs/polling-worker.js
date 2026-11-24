/**
 * Base class for the lease-based polling workers (Modules 3, 4, 6, 7).
 *
 * Guarantees the previous per-module workers lacked:
 * - a failed claim (e.g. MongoDB briefly unavailable) never becomes an unhandled rejection and
 *   never stops the poll loop; the worker backs off and keeps polling
 * - only one claim loop runs at a time, so concurrency limits hold
 * - each in-flight job's lease is renewed while it runs, so long LLM calls are not re-claimed
 *   by another worker mid-flight
 * - exhausted expired leases are failed periodically instead of staying PROCESSING forever
 */
class LeasePollingWorker {
  /**
   * @param {object} options
   * @param {string} options.name                 log label
   * @param {string} options.workerId
   * @param {number} options.concurrency
   * @param {number} options.leaseMs
   * @param {number} [options.pollIntervalMs]
   * @param {(args: {workerId: string, leaseMs: number}) => Promise<object|null>} options.claim
   * @param {(job: object) => Promise<unknown>} options.process
   * @param {(job: object, leaseMs: number) => Promise<object|null>} [options.renew]
   * @param {() => Promise<unknown>} [options.recover]  periodic maintenance (exhausted leases, outbox sweeps)
   * @param {number} [options.recoverIntervalMs]      defaults to max(5s, leaseMs)
   * @param {() => Promise<unknown>} [options.onStart] startup reconciliation
   * @param {boolean} [options.enabled]
   */
  constructor({
    name,
    workerId,
    concurrency,
    leaseMs,
    pollIntervalMs = 2000,
    claim,
    process,
    renew = null,
    recover = null,
    recoverIntervalMs = null,
    onStart = null,
    enabled = true,
  }) {
    this.name = name;
    this.workerId = workerId;
    this.concurrency = Math.max(1, Number(concurrency) || 1);
    this.leaseMs = leaseMs;
    this.pollIntervalMs = pollIntervalMs;
    this._claim = claim;
    this._process = process;
    this._renew = renew;
    this._recover = recover;
    this.recoverIntervalMs = recoverIntervalMs || Math.max(5000, Number(leaseMs) || 0);
    this._onStart = onStart;
    this.enabled = enabled;

    this.running = false;
    this.activeCount = 0;
    this.timer = null;
    this.recoverTimer = null;
    this._ticking = false;
    this._failureStreak = 0;
  }

  async start() {
    if (!this.enabled || this.running) return;
    this.running = true;

    if (this._onStart) {
      try {
        await this._onStart();
      } catch (err) {
        console.error(`${this.name} startup reconciliation failed:`, err.message);
      }
    }
    await this._runRecover();
    if (this._recover) {
      this.recoverTimer = setInterval(() => void this._runRecover(), this.recoverIntervalMs);
      if (typeof this.recoverTimer.unref === 'function') this.recoverTimer.unref();
    }

    this.scheduleNextTick(50);
  }

  async _runRecover() {
    if (!this._recover) return;
    try {
      await this._recover();
    } catch (err) {
      console.warn(`${this.name} lease recovery failed:`, err.message);
    }
  }

  scheduleNextTick(delayMs = this.pollIntervalMs) {
    if (!this.running) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.tick();
    }, delayMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  async tick() {
    if (!this.running || this._ticking) return;
    this._ticking = true;
    let nextDelay = this.pollIntervalMs;
    try {
      while (this.running && this.activeCount < this.concurrency) {
        const job = await this._claim({ workerId: this.workerId, leaseMs: this.leaseMs });
        if (!job) break;
        this._runJob(job);
      }
      this._failureStreak = 0;
    } catch (err) {
      // Claim failed (DB unavailable, etc.). Back off exponentially up to 30s and keep polling.
      this._failureStreak += 1;
      nextDelay = Math.min(30000, this.pollIntervalMs * 2 ** Math.min(this._failureStreak, 4));
      console.error(`${this.name} claim failed (retrying in ${nextDelay}ms):`, err.message);
    } finally {
      this._ticking = false;
    }
    if (this.running) this.scheduleNextTick(nextDelay);
  }

  _runJob(job) {
    this.activeCount += 1;
    const heartbeat = this._startHeartbeat(job);

    Promise.resolve()
      .then(() => this._process(job))
      .catch((err) => {
        console.error(`${this.name} job failure:`, err.message);
      })
      .finally(() => {
        heartbeat();
        this.activeCount = Math.max(0, this.activeCount - 1);
        if (this.running) this.scheduleNextTick(10);
      });
  }

  /** Renew the job's lease every leaseMs/3 while it runs. Returns a stop function. */
  _startHeartbeat(job) {
    if (!this._renew || !this.leaseMs) return () => {};
    let inFlight = false;
    const interval = Math.max(1000, Math.floor(this.leaseMs / 3));
    const timer = setInterval(async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const renewed = await this._renew(job, this.leaseMs);
        if (!renewed) clearInterval(timer); // lease lost; fenced writes will be ignored
      } catch (_) {
        // transient DB error: try again on the next beat, before the lease expires
      } finally {
        inFlight = false;
      }
    }, interval);
    if (typeof timer.unref === 'function') timer.unref();
    return () => clearInterval(timer);
  }

  async stop() {
    this.running = false;
    clearTimeout(this.timer);
    if (this.recoverTimer) clearInterval(this.recoverTimer);
    this.recoverTimer = null;
    while (this.activeCount > 0) {
      await new Promise((r) => setTimeout(r, 25));
    }
  }
}

module.exports = { LeasePollingWorker };
