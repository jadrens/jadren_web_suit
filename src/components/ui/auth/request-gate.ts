/** Prevent overlapping requests within one authentication form, including same-tick submits. */
export function createRequestGate() {
  let pending = false;
  return {
    acquire(): (() => void) | null {
      if (pending) return null;
      pending = true;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        pending = false;
      };
    },
  };
}
