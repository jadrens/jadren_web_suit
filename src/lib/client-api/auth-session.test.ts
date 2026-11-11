import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { AuthSessionManager } from "./auth-session";
import { ApiError } from "./http";
import type { UserProfile } from "./types";

const STORAGE_KEY = "dra-tool-auth-session-v1";
const user = (userId: string): UserProfile => ({
  userId, nickname: userId, email: `${userId}@example.com`, phone: null,
  registeredAt: "2026-01-01T00:00:00.000Z", status: 1,
});
const token = (userId: string) => ({
  accessToken: `token-${userId}`, expiresIn: 900, refreshWindow: 86_400, user: user(userId),
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("auth session lifecycle", () => {
  let browser: EventTarget;
  let timers: Map<number, { callback: () => void; delay: number }>;
  let storage: Map<string, string>;
  let manager: AuthSessionManager;
  let descriptors: Map<string, PropertyDescriptor | undefined>;

  beforeEach(() => {
    descriptors = new Map(["window", "document", "localStorage"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    browser = new EventTarget();
    timers = new Map();
    storage = new Map();
    let nextTimer = 0;
    Object.defineProperty(globalThis, "window", { configurable: true, value: Object.assign(browser, {
      location: { hostname: "localhost" },
      setTimeout: (callback: () => void, delay: number) => { timers.set(++nextTimer, { callback, delay }); return nextTimer; },
      clearTimeout: (id: number) => timers.delete(id),
    }) });
    Object.defineProperty(globalThis, "document", { configurable: true, value: Object.assign(new EventTarget(), { cookie: "", visibilityState: "visible" }) });
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    } });
    manager = new AuthSessionManager();
  });

  afterEach(() => {
    manager.destroy();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });

  function clients(auth: Record<string, (...args: never[]) => unknown>) {
    Object.assign(manager, { clients: Promise.resolve({ auth }) });
  }

  async function signedIn() {
    clients({ login: async () => token("alice") });
    await manager.login({ identifier: "alice", password: "password" });
  }

  function storageEvent(key: string | null, newValue: string | null) {
    browser.dispatchEvent(Object.assign(new Event("storage"), { key, newValue }));
  }

  test("logout clears locally immediately and waits for rotation before revoking the cookie", async () => {
    await signedIn();
    const refreshing = deferred<ReturnType<typeof token>>();
    const started = deferred<void>();
    const calls: string[] = [];
    clients({
      refresh: () => { calls.push("refresh"); started.resolve(); return refreshing.promise; },
      logout: async () => { calls.push("logout"); return {}; },
    });
    const pending = manager.refreshAccessToken();
    await started.promise;
    const logout = manager.logout();
    expect(manager.getSnapshot().status).toBe("anonymous");
    expect(storage.has(STORAGE_KEY)).toBe(false);
    expect(calls).toEqual(["refresh"]);
    refreshing.resolve(token("alice"));
    await Promise.all([pending, logout]);
    expect(calls).toEqual(["refresh", "logout"]);
    expect(manager.getAccessToken()).toBeNull();
    expect(manager.getSnapshot().status).toBe("anonymous");
  });

  test("a failed old refresh cannot sign out a newly selected account", async () => {
    await signedIn();
    const refreshing = deferred<ReturnType<typeof token>>();
    const started = deferred<void>();
    clients({ refresh: () => { started.resolve(); return refreshing.promise; } });
    const pending = manager.refreshAccessToken();
    await started.promise;
    storageEvent(STORAGE_KEY, JSON.stringify({
      version: 1, accessToken: "token-bob", user: user("bob"), issuedAt: Date.now(),
      expiresAt: Date.now() + 900_000, refreshUntil: Date.now() + 86_400_000,
    }));
    refreshing.reject(new ApiError("expired", 401, "/refresh"));
    await pending;
    expect(manager.getSnapshot().user?.userId).toBe("bob");
    expect(manager.getAccessToken()).toBe("token-bob");
  });

  test("an expired account received from another tab gets its own refresh", async () => {
    await signedIn();
    const refreshing = deferred<ReturnType<typeof token>>();
    const started = deferred<void>();
    const restored = deferred<void>();
    manager.subscribe(() => {
      const snapshot = manager.getSnapshot();
      if (snapshot.status === "authenticated" && snapshot.user?.userId === "bob") restored.resolve();
    });
    let calls = 0;
    clients({ refresh: () => {
      if (++calls === 1) { started.resolve(); return refreshing.promise; }
      return Promise.resolve(token("bob"));
    } });
    const previous = manager.refreshAccessToken();
    await started.promise;
    storageEvent(STORAGE_KEY, JSON.stringify({
      version: 1, accessToken: "expired-bob", user: user("bob"), issuedAt: Date.now() - 900_000,
      expiresAt: Date.now() - 1_000, refreshUntil: Date.now() + 86_400_000,
    }));
    refreshing.resolve(token("alice"));
    await previous;
    expect(calls).toBe(2);
    await restored.promise;
    expect(manager.getSnapshot().user?.userId).toBe("bob");
    expect(manager.getAccessToken()).toBe("token-bob");
    expect(timers.size).toBe(1);
  });

  test("a refresh queued during sign-in cannot fall back to the previous account", async () => {
    await signedIn();
    const signingIn = deferred<ReturnType<typeof token>>();
    const started = deferred<void>();
    clients({
      login: () => { started.resolve(); return signingIn.promise; },
      refresh: async () => { throw new Error("offline"); },
    });
    const login = manager.login({ identifier: "bob", password: "password" });
    await started.promise;
    const refresh = manager.refreshAccessToken();
    signingIn.resolve(token("bob"));
    await Promise.all([login, refresh]);
    expect(manager.getSnapshot().user?.userId).toBe("bob");
    expect(manager.getAccessToken()).toBe("token-bob");
  });

  test("a late profile response cannot overwrite a new account", async () => {
    await signedIn();
    const profile = deferred<{ user: UserProfile; issuedAt: bigint; expiresAt: bigint }>();
    const started = deferred<void>();
    clients({
      me: () => { started.resolve(); return profile.promise; },
      login: async () => token("bob"),
    });
    const pending = manager.loadCurrentUser();
    await started.promise;
    await manager.login({ identifier: "bob", password: "password" });
    profile.resolve({ user: user("alice"), issuedAt: BigInt(0), expiresAt: BigInt(0) });
    expect((await pending)?.userId).toBe("bob");
    expect(manager.getSnapshot().user?.userId).toBe("bob");
    expect(manager.getAccessToken()).toBe("token-bob");
  });

  test("temporary errors after access token expiry schedule recovery", async () => {
    storage.set(STORAGE_KEY, JSON.stringify({
      version: 1, accessToken: "expired", user: user("alice"), issuedAt: Date.now() - 900_000,
      expiresAt: Date.now() - 1_000, refreshUntil: Date.now() + 86_400_000,
    }));
    let calls = 0;
    clients({ refresh: async () => { if (++calls === 1) throw new Error("offline"); return token("alice"); } });
    await manager.initialize();
    expect(manager.getSnapshot().status).toBe("anonymous");
    expect([...timers.values()].map(({ delay }) => delay)).toEqual([60_000]);
    await manager.refreshAccessToken();
    expect(manager.getSnapshot().status).toBe("authenticated");
  });

  test("all initialization callers await the same expired-session refresh", async () => {
    storage.set(STORAGE_KEY, JSON.stringify({
      version: 1, accessToken: "expired", user: user("alice"), issuedAt: Date.now() - 900_000,
      expiresAt: Date.now() - 1_000, refreshUntil: Date.now() + 86_400_000,
    }));
    const refreshing = deferred<ReturnType<typeof token>>();
    clients({ refresh: () => refreshing.promise });
    const first = manager.initialize();
    const second = manager.initialize();
    expect(second).toBe(first);
    refreshing.resolve(token("alice"));
    await second;
    expect(manager.getSnapshot().status).toBe("authenticated");
  });

  test("clearing browser storage in another tab signs out this tab", async () => {
    await signedIn();
    storageEvent(null, null);
    expect(manager.getSnapshot().status).toBe("anonymous");
    expect(manager.getAccessToken()).toBeNull();
    expect(timers.size).toBe(0);
  });

  test("a delayed logout reply cannot clear a later sign-in", async () => {
    await signedIn();
    const signedOut = deferred<object>();
    const started = deferred<void>();
    clients({ logout: () => { started.resolve(); return signedOut.promise; }, login: async () => token("bob") });
    const logout = manager.logout();
    await started.promise;
    const login = manager.login({ identifier: "bob", password: "password" });
    signedOut.resolve({});
    await Promise.all([logout, login]);
    expect(manager.getSnapshot().user?.userId).toBe("bob");
  });

  test("an anonymous refresh does not cancel an in-flight sign-in", async () => {
    const signingIn = deferred<ReturnType<typeof token>>();
    const started = deferred<void>();
    clients({ login: () => { started.resolve(); return signingIn.promise; } });
    const login = manager.login({ identifier: "alice", password: "password" });
    await started.promise;
    expect(await manager.refreshAccessToken()).toBeNull();
    signingIn.resolve(token("alice"));
    await login;
    expect(manager.getSnapshot().user?.userId).toBe("alice");
  });

  test("a failed account creation preserves the previous session's refresh timer", async () => {
    await signedIn();
    clients({ register: async () => { throw new Error("invalid code"); } });
    await expect(manager.register({ nickname: "bob", email: "bob@example.com", password: "password", code: "123456" })).rejects.toThrow("invalid code");
    expect(manager.getSnapshot().user?.userId).toBe("alice");
    expect(timers.size).toBe(1);
  });
});
