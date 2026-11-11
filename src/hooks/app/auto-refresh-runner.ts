/** Coalesce focus, visibility and timer triggers while a refresh is in flight. */
export function createAutoRefreshRunner(refresh: () => void | Promise<void>, visible: () => boolean) {
  let pending: Promise<void> | null = null;
  let stopped = false;

  return {
    run(): Promise<void> {
      if (stopped || !visible()) return Promise.resolve();
      if (pending) return pending;
      pending = Promise.resolve()
        .then(() => { if (!stopped && visible()) return refresh(); })
        // Refresh callbacks own their error feedback. Background triggers must
        // not leak unhandled rejections or prevent the next scheduled retry.
        .catch(() => undefined)
        .finally(() => { pending = null; });
      return pending;
    },
    stop() { stopped = true; },
  };
}
