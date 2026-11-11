import { ApiError } from "./http";
import { toUserProfile } from "./mappers";
import type { createAnonymousClients } from "./rpc-transport";
import type {
  AuthSnapshot,
  LoginRequest,
  MeResponse,
  RegisterRequest,
  SendVerificationCodeResponse,
  TokenResponse,
  UserProfile,
  VerifyEmailResponse,
} from "./types";

// Holds the short-lived access token and profile so tabs share one session.
// The long-lived refresh token never reaches script: it is an HttpOnly cookie
// that only the auth RPCs receive.
const STORAGE_KEY = "dra-tool-auth-session-v1";
/** Script-readable cookie used by older builds; deleted on sight because it carried the token. */
const LEGACY_COOKIE_KEY = "jadren_auth_session";
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

function clearLegacyCookie() {
  if (!document.cookie.includes(`${LEGACY_COOKIE_KEY}=`)) return;
  const hostname = window.location.hostname;
  const domains = ["jadren.me", "jadren.cn", "jadren.debug"].filter(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );
  for (const domain of [...domains.map((item) => `; Domain=.${item}`), ""]) {
    document.cookie = `${LEGACY_COOKIE_KEY}=; Path=/; Max-Age=0${domain}`;
  }
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
    typeof session.issuedAt === "number" && Number.isFinite(session.issuedAt) &&
    typeof session.expiresAt === "number" && Number.isFinite(session.expiresAt) &&
    typeof session.refreshUntil === "number" && Number.isFinite(session.refreshUntil)
  );
}

function tokenResponse(response: {
  accessToken: string;
  expiresIn: number;
  refreshWindow: number;
  user?: Parameters<typeof toUserProfile>[0];
}): TokenResponse {
  return {
    accessToken: response.accessToken,
    tokenType: "Bearer",
    expiresIn: response.expiresIn,
    refreshWindow: response.refreshWindow,
    user: toUserProfile(response.user),
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Authentication request failed";
}

type AnonymousClients = ReturnType<typeof createAnonymousClients>;

export class AuthSessionManager {
  // The RPC stack (connect + protobuf runtime) is fetched on the first auth call, so
  // anonymous visitors (who never make one) don't download it with every page.
  private clients: Promise<AnonymousClients> | null = null;
  private readonly listeners = new Set<() => void>();
  private snapshot: AuthSnapshot = SERVER_SNAPSHOT;
  private session: StoredSession | null = null;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  // Invalidates replies belonging to a signed-out or replaced account.
  private sessionRevision = 0;
  // Cookie mutations must finish in order: logout must revoke the cookie left
  // by an in-flight rotation, and a later sign-in must own the final cookie.
  private sessionRequest: Promise<unknown> = Promise.resolve();
  private refreshPromise: Promise<string | null> | null = null;
  private refreshRevision = -1;
  private refreshTimer: number | null = null;

  private authClient = async () => {
    this.clients ??= import("./rpc-transport").then((module) => module.createAnonymousClients());
    return (await this.clients).auth;
  };

  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => SERVER_SNAPSHOT;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  initialize = (): Promise<void> => {
    if (typeof window === "undefined") return Promise.resolve();
    this.initializationPromise ??= this.initializeSession();
    return this.initializationPromise;
  };

  private async initializeSession() {
    this.initialized = true;
    window.addEventListener("storage", this.handleStorage);
    window.addEventListener("online", this.handleOnline);
    document.addEventListener("visibilitychange", this.handleVisibility);
    clearLegacyCookie();

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
  }

  destroy = () => {
    if (typeof window !== "undefined" && this.initialized) {
      window.removeEventListener("storage", this.handleStorage);
      window.removeEventListener("online", this.handleOnline);
      document.removeEventListener("visibilitychange", this.handleVisibility);
    }
    this.initialized = false;
    this.initializationPromise = null;
    this.sessionRevision++;
    this.clearRefreshTimer();
    this.listeners.clear();
  };

  getAccessToken = () => {
    if (!this.session || Date.now() >= this.session.expiresAt) return null;
    return this.session.accessToken;
  };

  /** Sends the code that proves the e-mail before an account is created. */
  sendRegistrationCode = async (
    email: string,
    locale: "en" | "zh" = "en"
  ): Promise<SendVerificationCodeResponse> => {
    const { message, expiresIn, sentAt, expiresAt } =
      await (await this.authClient()).sendRegistrationCode({ email, locale });
    return { message, expiresIn, sentAt, expiresAt };
  };

  /** Creates a verified account and signs it in. */
  register = async (input: RegisterRequest) => {
    await this.initialize();
    const revision = this.beginSessionChange();
    return this.runSessionRequest(async () => {
      const response = tokenResponse(
        await (await this.authClient()).register({ ...input, phone: input.phone ?? undefined })
      );
      if (revision === this.sessionRevision) this.acceptToken(response);
      return response.user;
    }).catch((error: unknown) => {
      if (revision === this.sessionRevision) this.scheduleRefresh();
      throw error;
    });
  };

  sendPasswordResetCode = async (
    email: string,
    locale: "en" | "zh" = "en"
  ): Promise<SendVerificationCodeResponse> => {
    const { message, expiresIn, sentAt, expiresAt } =
      await (await this.authClient()).sendPasswordResetCode({ email, locale });
    return { message, expiresIn, sentAt, expiresAt };
  };

  /** Sets a new password (signing out every other session) and signs in. */
  resetPassword = async (email: string, code: string, newPassword: string) => {
    await this.initialize();
    const revision = this.beginSessionChange();
    return this.runSessionRequest(async () => {
      const response = tokenResponse(
        await (await this.authClient()).resetPassword({ email, code, newPassword })
      );
      if (revision === this.sessionRevision) this.acceptToken(response);
      return response.user;
    }).catch((error: unknown) => {
      if (revision === this.sessionRevision) this.scheduleRefresh();
      throw error;
    });
  };

  login = async (input: LoginRequest) => {
    await this.initialize();
    const previousSession = this.session;
    const revision = this.beginSessionChange();
    this.publish("authenticating", null, null);
    try {
      return await this.runSessionRequest(async () => {
        const response = tokenResponse(await (await this.authClient()).login(input));
        if (revision === this.sessionRevision) this.acceptToken(response);
        return response.user;
      });
    } catch (error) {
      if (revision !== this.sessionRevision) throw error;
      if (previousSession && Date.now() < previousSession.expiresAt) {
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

  /** Forgets the session immediately, then revokes the final refresh cookie. */
  logout = async () => {
    this.clearSession();
    try {
      await this.runSessionRequest(async () => (await this.authClient()).logout({}));
    } catch {
      // Offline or already expired: the local session is already cleared.
    }
  };

  sendVerificationCode = async (
    email: string,
    locale: "en" | "zh" = "en"
  ): Promise<SendVerificationCodeResponse> => {
    const { message, expiresIn, sentAt, expiresAt } =
      await (await this.authClient()).sendVerificationCode({ email, locale });
    return { message, expiresIn, sentAt, expiresAt };
  };

  verifyEmail = async (email: string, code: string) => {
    const revision = this.sessionRevision;
    const verified = await (await this.authClient()).verifyEmail({ email, code });
    const response: VerifyEmailResponse = {
      message: verified.message,
      user: toUserProfile(verified.user),
    };

    if (revision === this.sessionRevision && this.session?.user.email.toLowerCase() === email.trim().toLowerCase()) {
      this.session = { ...this.session, user: response.user };
      this.persistSession();
      this.publish("authenticated", response.user, this.session.expiresAt);
      await this.refreshAccessToken();
    }
    return response.user;
  };

  loadCurrentUser = async () => {
    const revision = this.sessionRevision;
    const token = this.getAccessToken();
    if (!token) return null;
    const me = await (await this.authClient()).me(
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const response: MeResponse = {
      user: toUserProfile(me.user),
      issuedAt: Number(me.issuedAt),
      expiresAt: Number(me.expiresAt),
    };
    if (revision !== this.sessionRevision) return this.snapshot.user;
    if (this.session) {
      this.session = { ...this.session, user: response.user };
      this.persistSession();
      this.publish("authenticated", response.user, this.session.expiresAt);
    }
    return response.user;
  };

  refreshAccessToken = async (): Promise<string | null> => {
    if (this.refreshPromise && this.refreshRevision === this.sessionRevision) return this.refreshPromise;
    const revision = this.sessionRevision;
    const pending = this.performRefresh().finally(() => {
      if (this.refreshPromise === pending) this.refreshPromise = null;
    });
    this.refreshRevision = revision;
    this.refreshPromise = pending;
    return pending;
  };

  private async performRefresh() {
    const current = this.session;
    const revision = this.sessionRevision;
    if (!current) return null;
    if (Date.now() >= current.refreshUntil) {
      this.clearSession();
      return null;
    }

    this.publish("refreshing", current.user, current.expiresAt);
    try {
      return await this.runSessionRequest(async () => {
        if (revision !== this.sessionRevision) return this.getAccessToken();
        // The refresh token travels in the HttpOnly cookie.
        const response = tokenResponse(await (await this.authClient()).refresh({}));
        if (revision !== this.sessionRevision) return this.getAccessToken();
        this.acceptToken(response);
        return response.accessToken;
      });
    } catch (error) {
      if (revision !== this.sessionRevision) return this.getAccessToken();
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        this.clearSession();
      } else {
        const usable = Date.now() < current.expiresAt;
        this.publish(
          usable ? "authenticated" : "anonymous",
          usable ? current.user : null,
          usable ? current.expiresAt : null,
          errorMessage(error)
        );
        // Keep trying after temporary outages even when the access token expired.
        this.scheduleRefresh(REFRESH_RETRY_MS);
      }
      return null;
    }
  }

  private beginSessionChange() {
    this.clearRefreshTimer();
    return ++this.sessionRevision;
  }

  private runSessionRequest<T>(request: () => Promise<T>): Promise<T> {
    const pending = this.sessionRequest.then(request, request);
    this.sessionRequest = pending;
    return pending;
  }

  private acceptToken(response: TokenResponse) {
    // Also invalidate work queued against the old account while sign-in was
    // pending, before its new cookie and user became available.
    this.sessionRevision++;
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
      // refreshWindow counts from now: it is the remaining session lifetime.
      refreshUntil: now + response.refreshWindow * 1000,
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
      Math.min(
        delay ?? Math.max(0, this.session.expiresAt - Date.now() - REFRESH_AHEAD_MS),
        Math.max(0, this.session.refreshUntil - Date.now())
      );
    this.refreshTimer = window.setTimeout(
      () => void this.refreshAccessToken(),
      wait
    );
  }

  private clearRefreshTimer() {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
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
    this.sessionRevision++;
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
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    if (!event.newValue) {
      this.clearSession(false);
      return;
    }
    try {
      const value: unknown = JSON.parse(event.newValue);
      if (!isStoredSession(value)) return;
      if (Date.now() >= value.refreshUntil) {
        this.clearSession(false);
        return;
      }
      this.sessionRevision++;
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
    if (document.visibilityState !== "visible") return;
    if (!this.session) return;
    if (Date.now() >= this.session.expiresAt - REFRESH_AHEAD_MS) {
      void this.refreshAccessToken();
    }
  };
}
