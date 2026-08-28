export type AccountStatus = 0 | 1 | 2;

export interface UserProfile {
  userId: string;
  nickname: string;
  email: string;
  phone: string | null;
  registeredAt: string;
  status: AccountStatus;
}

export interface TokenResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  refreshWindow: number;
  user: UserProfile;
}

export interface RegisterRequest {
  nickname: string;
  email: string;
  password: string;
  phone?: string | null;
}

export interface RegisterResponse {
  user: UserProfile;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface SendVerificationCodeRequest {
  email: string;
  locale: "en" | "zh";
}

export interface SendVerificationCodeResponse {
  message: string;
  expiresIn: number;
  sentAt: string;
  expiresAt: string;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface VerifyEmailResponse {
  message: string;
  user: UserProfile;
}

export interface MeResponse {
  user: UserProfile;
  issuedAt: number;
  expiresAt: number;
}

export interface QuickLink {
  shortName: string;
  targetUrl: string;
  note: string | null;
  createdAt: string;
  expiresAt: string;
  clickCount: string;
}

export interface QuickLinkListResponse {
  links: QuickLink[];
}

export interface CreateQuickLinkRequest {
  shortName: string;
  targetUrl: string;
  note?: string | null;
  expiresAt: string;
}

export interface CreateQuickLinkResponse {
  link: QuickLink;
}

export interface UpdateQuickLinkRequest {
  targetUrl?: string;
  note?: string | null;
  expiresAt?: string;
  disable?: boolean;
}

export type AuthStatus =
  | "uninitialized"
  | "anonymous"
  | "authenticating"
  | "authenticated"
  | "refreshing";

export interface AuthSnapshot {
  status: AuthStatus;
  user: UserProfile | null;
  expiresAt: number | null;
  isAuthenticated: boolean;
  error: string | null;
}
