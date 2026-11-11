import { expect, test } from "bun:test";
import { createAutoRefreshRunner } from "./auto-refresh-runner";

test("concurrent refresh triggers share a request, then allow another refresh", async () => {
  let calls = 0;
  let finish!: () => void;
  const runner = createAutoRefreshRunner(() => {
    calls++;
    return new Promise<void>((resolve) => { finish = resolve; });
  }, () => true);
  const first = runner.run();
  const second = runner.run();
  expect(second).toBe(first);
  await Promise.resolve();
  expect(calls).toBe(1);
  finish();
  await first;
  const next = runner.run();
  await Promise.resolve();
  expect(calls).toBe(2);
  finish();
  await next;
});

test("a failed background request can recover on the next trigger", async () => {
  let calls = 0;
  const runner = createAutoRefreshRunner(async () => {
    if (++calls === 1) throw new Error("offline");
  }, () => true);
  await runner.run();
  await runner.run();
  expect(calls).toBe(2);
});

test("hidden and disposed pages do not start requests", async () => {
  let visible = false;
  let calls = 0;
  const runner = createAutoRefreshRunner(() => { calls++; }, () => visible);
  await runner.run();
  visible = true;
  const queued = runner.run();
  runner.stop();
  await queued;
  await runner.run();
  expect(calls).toBe(0);
});
