import { expect, test } from "bun:test";
import { isCurrentDialogOperation } from "./use-dialog-operation";

test("late dialog work is rejected after account, permission, or opening changes", () => {
  const operation = { open: true, isAuthenticated: true, userId: "a", status: 1, started: 3, generation: 3 };
  const account = { isAuthenticated: true, user: { userId: "a", status: 1 } };
  expect(isCurrentDialogOperation(operation, account)).toBe(true);
  expect(isCurrentDialogOperation(operation, { ...account, user: { ...account.user, userId: "b" } })).toBe(false);
  expect(isCurrentDialogOperation(operation, { ...account, user: { ...account.user, status: 0 } })).toBe(false);
  expect(isCurrentDialogOperation(operation, { ...account, isAuthenticated: false })).toBe(false);
  expect(isCurrentDialogOperation({ ...operation, generation: 4 }, account)).toBe(false);
  expect(isCurrentDialogOperation({ ...operation, open: false }, account)).toBe(false);
});
