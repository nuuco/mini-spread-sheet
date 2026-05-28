import { ENABLE_PERF_LOG } from '../constants.js';

export class PerfTracker {
  constructor(enabled = ENABLE_PERF_LOG) {
    this.enabled = enabled;
  }

  measure(label, fn) {
    if (!this.enabled) {
      return fn();
    }

    const start = performance.now();
    const result = fn();
    const elapsed = performance.now() - start;
    console.debug(`[perf] ${label}: ${elapsed.toFixed(2)}ms`);
    return result;
  }
}
