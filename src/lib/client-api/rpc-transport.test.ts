import { describe, expect, test } from "bun:test";
import { Code, ConnectError, createRouterTransport } from "@connectrpc/connect";
import { AuthService } from "@gen/jadren/v1/auth_pb";
import { ErrorDetailSchema } from "@gen/jadren/v1/common_pb";
import { ApiError } from "./http";
import { authInterceptor, createApiClient } from "./rpc-transport";

const invalidCredentials = () =>
  new ConnectError("Invalid credentials", Code.Unauthenticated, undefined, [
    { desc: ErrorDetailSchema, value: { code: "invalid_credentials" } },
  ]);

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("createApiClient", () => {
  test("surfaces RPC failures as ApiError even behind interceptors", async () => {
    const transport = createRouterTransport(
      ({ service }) => service(AuthService, { login: () => { throw invalidCredentials(); } }),
      { transport: { interceptors: [authInterceptor({})] } }
    );
    const error = await createApiClient(AuthService, transport)
      .login({ identifier: "someone", password: "wrong" })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 401,
      code: "invalid_credentials",
      message: "Invalid credentials",
      url: "/rpc/jadren.v1.AuthService/Login",
    });
  });

  test("still lets the auth interceptor retry after a token refresh", async () => {
    let calls = 0;
    let token = "expired";
    const transport = createRouterTransport(
      ({ service }) =>
        service(AuthService, {
          me: (_request, context) => {
            calls++;
            if (context.requestHeader.get("Authorization") !== "Bearer fresh") throw invalidCredentials();
            return {};
          },
        }),
      {
        transport: {
          interceptors: [
            authInterceptor({
              getAccessToken: () => token,
              refreshAccessToken: async () => (token = "fresh"),
            }),
          ],
        },
      }
    );

    await createApiClient(AuthService, transport).me({});
    expect(calls).toBe(2);
  });

  test("does not refresh or replay an old account's request after switching accounts", async () => {
    let identity = "alice";
    let calls = 0;
    let refreshes = 0;
    const started = deferred();
    const release = deferred();
    const transport = createRouterTransport(
      ({ service }) => service(AuthService, { me: async () => {
        calls++;
        started.resolve();
        await release.promise;
        throw invalidCredentials();
      } }),
      { transport: { interceptors: [authInterceptor({
        getAccessToken: () => identity,
        getSessionIdentity: () => identity,
        refreshAccessToken: async () => { refreshes++; return identity; },
      })] } }
    );
    const pending = createApiClient(AuthService, transport).me({}).catch((error: unknown) => error);
    await started.promise;
    identity = "bob";
    release.resolve();
    expect(await pending).toMatchObject({ code: Code.Canceled });
    expect(calls).toBe(1);
    expect(refreshes).toBe(0);
  });

  test("rejects a successful response from the account that signed out", async () => {
    let identity: string | null = "alice";
    const started = deferred();
    const release = deferred();
    const transport = createRouterTransport(
      ({ service }) => service(AuthService, { me: async () => {
        started.resolve();
        await release.promise;
        return { user: { userId: "alice" } };
      } }),
      { transport: { interceptors: [authInterceptor({ getSessionIdentity: () => identity })] } }
    );
    const pending = createApiClient(AuthService, transport).me({}).catch((error: unknown) => error);
    await started.promise;
    identity = null;
    release.resolve();
    expect(await pending).toMatchObject({ code: Code.Canceled });
  });

  test("discards a failed response from a previous account", async () => {
    let identity = "alice";
    const started = deferred();
    const release = deferred();
    const transport = createRouterTransport(
      ({ service }) => service(AuthService, { me: async () => {
        started.resolve();
        await release.promise;
        throw new ConnectError("old account failure", Code.Internal);
      } }),
      { transport: { interceptors: [authInterceptor({ getSessionIdentity: () => identity })] } }
    );
    const pending = createApiClient(AuthService, transport).me({}).catch((error: unknown) => error);
    await started.promise;
    identity = "bob";
    release.resolve();
    expect(await pending).toMatchObject({ code: Code.Canceled });
  });

  test("preserves failure mapping after a same-account token refresh", async () => {
    let token = "old";
    const transport = createRouterTransport(
      ({ service }) => service(AuthService, { me: (_request, context) => {
        if (context.requestHeader.get("Authorization") === "Bearer old") throw invalidCredentials();
        throw new ConnectError("server failure", Code.Internal);
      } }),
      { transport: { interceptors: [authInterceptor({
        getSessionIdentity: () => "alice",
        getAccessToken: () => token,
        refreshAccessToken: async () => (token = "fresh"),
      })] } }
    );
    const error = await createApiClient(AuthService, transport).me({}).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 500, message: "server failure" });
  });

  test("does not retry with a new account selected while refresh was pending", async () => {
    let identity = "alice";
    let calls = 0;
    const refreshing = deferred();
    const release = deferred();
    const transport = createRouterTransport(
      ({ service }) => service(AuthService, { me: () => { calls++; throw invalidCredentials(); } }),
      { transport: { interceptors: [authInterceptor({
        getSessionIdentity: () => identity,
        refreshAccessToken: async () => { refreshing.resolve(); await release.promise; return identity; },
      })] } }
    );
    const pending = createApiClient(AuthService, transport).me({}).catch((error: unknown) => error);
    await refreshing.promise;
    identity = "bob";
    release.resolve();
    expect(await pending).toMatchObject({ code: Code.Canceled });
    expect(calls).toBe(1);
  });
});
