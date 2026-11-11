import { describe, expect, test } from "bun:test";
import { createListRequestGuard } from "./list-request-guard";

describe("account list request guard", () => {
  test("an older refresh cannot resurrect a deleted item or erase a newly created item", () => {
    let account: string | undefined = "alice";
    const guard = createListRequestGuard(account, () => account);
    let rows = ["old"];
    const staleRequest = guard.begin();
    rows = ["new"];
    guard.invalidate(); // delete and create have completed
    if (guard.isCurrent(staleRequest)) rows = ["old"];
    expect(rows).toEqual(["new"]);
    const freshRequest = guard.begin();
    if (guard.isCurrent(freshRequest)) rows = ["new", "server"];
    expect(rows).toEqual(["new", "server"]);
    account = "bob";
    if (guard.isCurrent(freshRequest)) rows = ["alice private"];
    expect(rows).toEqual(["new", "server"]);
  });

  test("newer list requests win even when responses arrive out of order", () => {
    const guard = createListRequestGuard("alice", () => "alice");
    const earlier = guard.begin();
    const later = guard.begin();
    expect(guard.isCurrent(later)).toBe(true);
    expect(guard.isCurrent(earlier)).toBe(false);
  });
});

test("an older foreground completion cannot hide a newer loading indicator", () => {
  const guard = createListRequestGuard("alice", () => "alice");
  let loading = true;
  const first = guard.beginForeground();
  const second = guard.beginForeground();
  if (guard.isLatestForeground(first)) loading = false;
  expect(loading).toBe(true);
  if (guard.isLatestForeground(second)) loading = false;
  expect(loading).toBe(false);
});
