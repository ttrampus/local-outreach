/**
 * A counting semaphore for async work.
 *
 * Needed because preview generation is far heavier than a normal request: each
 * one holds a Claude stream open for minutes and then launches a headless
 * Chromium. Three at once on a small VPS is three browsers and three long-lived
 * sockets, which is how the route started returning 500s under load. Queuing is
 * the right answer rather than rejecting — the work is slow but it does finish.
 */
export function createSemaphore(limit: number) {
  const max = Math.max(1, Math.floor(limit));
  let active = 0;
  const waiting: Array<() => void> = [];

  function release() {
    active -= 1;
    // FIFO, so a request that queued first is not starved by later arrivals.
    const next = waiting.shift();
    if (next) next();
  }

  async function acquire(): Promise<void> {
    if (active < max) {
      active += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      waiting.push(() => {
        active += 1;
        resolve();
      });
    });
  }

  return {
    /** Run `fn` once a slot is free, always releasing the slot afterwards. */
    async withSlot<T>(fn: () => Promise<T>): Promise<T> {
      await acquire();
      try {
        return await fn();
      } finally {
        release();
      }
    },
    /** Queue depth, for logging. */
    get pending() {
      return waiting.length;
    },
  };
}
