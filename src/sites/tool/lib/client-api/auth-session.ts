import { ApiClient, ApiError } from "./http";
import type {
  AuthSnapshot,
  LoginRequest,
  MeResponse,
  RegisterRequest,
  RegisterResponse,
  SendVerificationCodeResponse,
  TokenResponse,
  UserProfile,
  VerifyEmailResponse,
} from "./types";

const STORAGE_KEY = "dra-tool-auth-session-v1";
const STORAGE_VERSION = 1;
const REFRESH_AHEAD_MS = 60_000;
const REFRESH_RETRY_MS = 60_000;

interface StoredSession {
  version: 1;
  accessToken: string;
  user: UserProfile;
  issuedAt: number;
  expiresAt: number;
  refreshUntil: number;
}

interface JwtTiming {
  issuedAt: number;
  expiresAt: number;
}

const SERVER_SNAPSHOT: AuthSnapshot = {
  status: "uninitialized",
  user: null,
  expiresAt: null,
  isAuthenticated: false,
  error: null,
};

function decodeJwtTiming(token: string): JwtTiming | null {
  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return null;
    const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(base64 + padding)) as {
      iat?: unknown;
      exp?: unknown;
    };
    if (typeof payload.iat !== "number" || typeof payload.exp !== "number") {
      return null;
    }
    return {
      issuedAt: payload.iat * 1000,
      expiresAt: payload.exp * 1000,
    };
  } catch {
    return null;
  }
}

function isUserProfile(value: unknown): value is UserProfile {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<UserProfile>;
  return (
    typeof user.userId === "string" &&
    typeof user.nickname === "string" &&
    typeof user.email === "string" &&
    (user.phone === null || typeof user.phone === "string") &&
    typeof user.registeredAt === "string" &&
    (user.status === 0 || user.status === 1 || user.status === 2)
  );
}

function isStoredSession(value: unknown): value is StoredSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<StoredSession>;
  return (
    session.version === STORAGE_VERSION &&
    typeof session.accessToken === "string" &&
    isUserProfile(session.user) &&
    typeof session.issuedAt === "number" &&
    typeof session.expiresAt === "number" &&
    typeof session.refreshUntil === "number"
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Authentication request failed";
}

export class AuthSessionManager {
  private readonly transport = new ApiClient();
  private readonly listeners = new Set<() => void>();
  private snapshot: AuthSnapshot = SERVER_SNAPSHOT;
  private session: StoredSession | null = null;
  private initialized = false;
  private refreshPromise: Promise<string | null> | null = null;
  private refreshTimer: number | null = null;

  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => SERVER_SNAPSHOT;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  initialize = async () => {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;
    window.addEventListener("storage", this.handleStorage);
    window.addEventListener("online", this.handleOnline);
    document.addEventListener("visibilitychange", this.handleVisibility);

    const stored = this.readStoredSession();
    if (!stored) {
      this.publish("anonymous", null, null);
      return;
    }

    this.session = stored;
    const now = Date.now();
    if (now >= stored.refreshUntil) {
      this.clearSession();
      return;
    }
    if (now < stored.expiresAt) {
      this.publish("authenticated", stored.user, stored.expiresAt);
      this.scheduleRefresh();
      return;
    }

    this.publish("refreshing", stored.user, stored.expiresAt);
    await this.refreshAccessToken();
  };

  destroy = () => {
    if (typeof window !== "undefined" && this.initialized) {
      window.removeEventListener("storage", this.handleStorage);
      window.removeEventListener("online", this.handleOnline);
      document.removeEventListener("visibilitychange", this.handleVisibility);
    }
    this.initialized = false;
    this.clearRefreshTimer();
    this.listeners.clear();
  };

  getAccessToken = () => {
    if (!this.session || Date.now() >= this.session.expiresAt) return null;
    return this.session.accessToken;
  };

  register = (input: RegisterRequest) =>
    this.transport.post<RegisterResponse, RegisterRequest>(
      "/api/auth/register",
      input,
      { auth: false }
    );

  login = async (input: LoginRequest) => {
    await this.initialize();
    const previousSession = this.session;
    this.publish("authenticating", null, null);
    try {
      const response = await this.transport.post<TokenResponse, LoginRequest>(
        "/api/auth/login",
        input,
        { auth: false }
      );
      this.acceptToken(response);
      return response.user;
    } catch (error) {
      if (previousSession) {
        this.session = previousSession;
        this.publish(
          "authenticated",
          previousSession.user,
          previousSession.expiresAt,
          errorMessage(error)
        );
        this.scheduleRefresh();
      } else {
        this.clearSession();
        this.publish("anonymous", null, null, errorMessage(error));
      }
      throw error;
    }
  };

  logout = () => this.clearSession();

  sendVerificationCode = (email: string, locale: "en" | "zh" = "en") =>
    this.transport.post<
      SendVerificationCodeResponse,
      { email: string; locale: "en" | "zh" }
    >(
      "/api/auth/email/send-code",
      { email, locale },
      { auth: false }
    );

  verifyEmail = async (email: string, code: string) => {
    const response = await this.transport.post<
      VerifyEmailResponse,
      { email: string; code: string }
    >("/api/auth/email/verify", { email, code }, { auth: false });

    if (this.session?.user.email.toLowerCase() === email.trim().toLowerCase()) {
      this.session = { ...this.session, user: response.user };
      this.persistSession();
      this.publish("authenticated", response.user, this.session.expiresAt);
      await this.refreshAccessToken();
    }
    return response.user;
  };

  loadCurrentUser = async () => {
    const token = this.getAccessToken();
    if (!token) return null;
    const response = await this.transport.get<MeResponse>("/api/auth/me", {
      auth: false,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (this.session) {
      this.session = { ...this.session, user: response.user };
      this.persistSession();
      this.publish("authenticated", response.user, this.session.expiresAt);
    }
    return response.user;
  };

  refreshAccessToken = async (): Promise<string | null> => {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.performRefresh().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  };

  private async performRefresh() {
    const current = this.session;
    if (!current || Date.now() >= current.refreshUntil) {
      this.clearSession();
      return null;
    }

    this.publish("refreshing", current.user, current.expiresAt);
    try {
      const response = await this.transport.post<
        TokenResponse,
        { token: string }
      >("/api/auth/refresh", { token: current.accessToken }, { auth: false });
      this.acceptToken(response);
      return response.accessToken;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        this.clearSession();
      } else if (Date.now() < current.expiresAt) {
        this.publish(
          "authenticated",
          current.user,
          current.expiresAt,
          errorMessage(error)
        );
        this.scheduleRefresh(REFRESH_RETRY_MS);
      } else {
        this.publish("anonymous", null, null, errorMessage(error));
      }
      return null;
    }
  }

  private acceptToken(response: TokenResponse) {
    const now = Date.now();
    const timing = decodeJwtTiming(response.accessToken);
    const issuedAt = timing?.issuedAt ?? now;
    const expiresAt = timing?.expiresAt ?? now + response.expiresIn * 1000;
    this.session = {
      version: STORAGE_VERSION,
      accessToken: response.accessToken,
      user: response.user,
      issuedAt,
      expiresAt,
      refreshUntil: issuedAt + response.refreshWindow * 1000,
    };
    this.persistSession();
    this.publish("authenticated", response.user, expiresAt);
    this.scheduleRefresh();
  }

  private publish(
    status: AuthSnapshot["status"],
    user: UserProfile | null,
    expiresAt: number | null,
    error: string | null = null
  ) {
    this.snapshot = {
      status,
      user,
      expiresAt,
      isAuthenticated: status === "authenticated" || status === "refreshing",
      error,
    };
    for (const listener of this.listeners) listener();
  }

  private scheduleRefresh(delay?: number) {
    this.clearRefreshTimer();
    if (!this.session || typeof window === "undefined") return;
    const wait =
      delay ?? Math.max(0, this.session.expiresAt - Date.now() - REFRESH_AHEAD_MS);
    this.refreshTimer = window.setTimeout(
      () => void this.refreshAccessToken(),
      wait
    );
  }

  private clearRefreshTimer() {
    if (this.refreshTimer !== null) clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
  }

  private persistSession() {
    if (!this.session || typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.session));
    } catch {
      // The in-memory session remains usable if storage is unavailable.
    }
  }

  private readStoredSession() {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const value: unknown = JSON.parse(raw);
      if (isStoredSession(value)) return value;
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Storage may be unavailable in private browsing modes.
      }
    }
    return null;
  }

  private clearSession(persist = true) {
    this.session = null;
    this.clearRefreshTimer();
    if (persist && typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // The in-memory session is already cleared.
      }
    }
    this.publish("anonymous", null, null);
  }

  private handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    if (!event.newValue) {
      this.session = null;
      this.clearRefreshTimer();
      this.publish("anonymous", null, null);
      return;
    }
    try {
      const value: unknown = JSON.parse(event.newValue);
      if (!isStoredSession(value)) return;
      this.session = value;
      if (Date.now() < value.expiresAt) {
        this.publish("authenticated", value.user, value.expiresAt);
        this.scheduleRefresh();
      } else {
        void this.refreshAccessToken();
      }
    } catch {
      // Ignore malformed data from another tab.
    }
  };

  private handleOnline = () => {
    if (this.session) void this.refreshAccessToken();
  };

  private handleVisibility = () => {
    if (document.visibilityState !== "visible" || !this.session) return;
    if (Date.now() >= this.session.expiresAt - REFRESH_AHEAD_MS) {
      void this.refreshAccessToken();
    }
  };
}
