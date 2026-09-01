export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";
export type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean>;

export interface ApiRequestOptions<TBody = unknown>
  extends Omit<RequestInit, "body" | "headers" | "method"> {
  body?: TBody;
  headers?: HeadersInit;
  query?: Record<string, QueryValue>;
  auth?: boolean;
  retryAuth?: boolean;
  timeoutMs?: number;
}

export interface ApiClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  getAccessToken?: () => string | null;
  refreshAccessToken?: () => Promise<string | null>;
}

export class ApiError<TDetails = unknown> extends Error {
  readonly code: string | null;

  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
    readonly details: TDetails | null = null
  ) {
    super(message);
    this.name = "ApiError";
    this.code =
      typeof details === "object" &&
      details !== null &&
      "code" in details &&
      typeof details.code === "string"
        ? details.code
        : null;
  }
}

function appendQuery(path: string, query?: Record<string, QueryValue>) {
  if (!query) return path;
  const [pathname, existingQuery = ""] = path.split("?", 2);
  const search = new URLSearchParams(existingQuery);

  for (const [key, rawValue] of Object.entries(query)) {
    if (rawValue === undefined || rawValue === null) continue;
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) search.append(key, String(value));
  }

  const queryString = search.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

function isRawBody(value: unknown): value is BodyInit {
  return (
    typeof value === "string" ||
    value instanceof FormData ||
    value instanceof URLSearchParams ||
    value instanceof Blob ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value)
  );
}

async function responseBody(response: Response) {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => undefined);
  }
  const text = await response.text();
  return text || undefined;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly getAccessToken?: () => string | null;
  private readonly refreshAccessToken?: () => Promise<string | null>;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "").replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.getAccessToken = options.getAccessToken;
    this.refreshAccessToken = options.refreshAccessToken;
  }

  async request<TResponse, TBody = unknown>(
    method: HttpMethod,
    path: string,
    options: ApiRequestOptions<TBody> = {}
  ): Promise<TResponse> {
    const {
      body: requestBody,
      headers: requestHeaders,
      query,
      auth,
      retryAuth,
      timeoutMs,
      ...fetchOptions
    } = options;
    const url = `${this.baseUrl}${appendQuery(path, query)}`;
    const headers = new Headers(requestHeaders);
    headers.set("Accept", "application/json");

    if (auth !== false) {
      const token = this.getAccessToken?.();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }

    let body: BodyInit | undefined;
    if (requestBody !== undefined) {
      if (isRawBody(requestBody)) {
        body = requestBody;
      } else {
        headers.set("Content-Type", "application/json");
        body = JSON.stringify(requestBody);
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
      timeoutMs ?? this.timeoutMs
    );
    const abortFromCaller = () => controller.abort(fetchOptions.signal?.reason);
    fetchOptions.signal?.addEventListener("abort", abortFromCaller, {
      once: true,
    });

    let response: Response;
    try {
      response = await fetch(url, {
        ...fetchOptions,
        method,
        headers,
        body,
        signal: controller.signal,
        credentials: fetchOptions.credentials ?? "same-origin",
      });
    } finally {
      clearTimeout(timeout);
      fetchOptions.signal?.removeEventListener("abort", abortFromCaller);
    }

    if (
      response.status === 401 &&
      auth !== false &&
      retryAuth !== false &&
      this.refreshAccessToken
    ) {
      const refreshedToken = await this.refreshAccessToken();
      if (refreshedToken) {
        return this.request<TResponse, TBody>(method, path, {
          ...options,
          retryAuth: false,
        });
      }
    }

    const data = await responseBody(response);
    if (!response.ok) {
      const message =
        typeof data === "object" && data !== null && "error_msg" in data
          ? String(data.error_msg)
          : typeof data === "object" && data !== null && "error" in data
            ? String(data.error)
          : typeof data === "string"
            ? data
            : `Request failed with HTTP ${response.status}`;
      throw new ApiError(message, response.status, url, data ?? null);
    }
    return data as TResponse;
  }

  get<TResponse>(
    path: string,
    options?: ApiRequestOptions<never>
  ): Promise<TResponse> {
    return this.request<TResponse>("GET", path, options);
  }

  post<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    options: ApiRequestOptions<TBody> = {}
  ): Promise<TResponse> {
    return this.request<TResponse, TBody>("POST", path, { ...options, body });
  }

  put<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    options: ApiRequestOptions<TBody> = {}
  ): Promise<TResponse> {
    return this.request<TResponse, TBody>("PUT", path, { ...options, body });
  }

  patch<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    options: ApiRequestOptions<TBody> = {}
  ): Promise<TResponse> {
    return this.request<TResponse, TBody>("PATCH", path, { ...options, body });
  }

  delete<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    options: ApiRequestOptions<TBody> = {}
  ): Promise<TResponse> {
    return this.request<TResponse, TBody>("DELETE", path, { ...options, body });
  }

  head<TResponse>(
    path: string,
    options?: ApiRequestOptions<never>
  ): Promise<TResponse> {
    return this.request<TResponse>("HEAD", path, options);
  }

  options<TResponse>(
    path: string,
    options?: ApiRequestOptions<never>
  ): Promise<TResponse> {
    return this.request<TResponse>("OPTIONS", path, options);
  }
}
