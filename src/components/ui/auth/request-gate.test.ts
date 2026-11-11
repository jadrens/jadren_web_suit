import { describe, expect, test } from "bun:test";
import { createRequestGate } from "./request-gate";

describe("authentication request gate", () => {
  test("blocks overlapping operations until the active request finishes", () => {
    const gate = createRequestGate();
    const release = gate.acquire();
    expect(release).not.toBeNull();
    expect(gate.acquire()).toBeNull();
    release!();
    const nextRelease = gate.acquire();
    expect(nextRelease).not.toBeNull();
    release!(); // A repeated cleanup must not unlock the next request.
    expect(gate.acquire()).toBeNull();
    nextRelease!();
    expect(gate.acquire()).not.toBeNull();
  });

  test("keeps separate form instances independent", () => {
    const first = createRequestGate();
    const second = createRequestGate();
    expect(first.acquire()).not.toBeNull();
    expect(second.acquire()).not.toBeNull();
  });
});
