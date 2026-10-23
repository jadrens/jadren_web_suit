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
});
