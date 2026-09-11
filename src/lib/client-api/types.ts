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

export interface ReactivateReminderRequest {
  remindAt: string;
}

export type ReminderStatus = "active" | "paused" | "completed";
export type ReminderScheduleType = "one_time" | "repeat" | "never";
export type ReminderDeliveryStatus = "sent" | "rate_limited" | null;

export interface Reminder {
  reminderId: string;
  title: string;
  note: string;
  remindAt: string | null;
  nextRemindAt: string | null;
  repeats: boolean;
  scheduleType: ReminderScheduleType;
  repeatIntervalMinutes: number | null;
  status: ReminderStatus;
  createdAt: string;
  updatedAt: string;
  lastSentAt: string | null;
  completedAt: string | null;
  lastDeliveryStatus: ReminderDeliveryStatus;
}

export interface ReminderListResponse {
  reminders: Reminder[];
}

export interface CreateReminderRequest {
  title: string;
  note: string;
  remindAt: string | null;
  scheduleType: ReminderScheduleType;
  repeatIntervalMinutes: number | null;
}

export interface UpdateReminderScheduleRequest {
  scheduleType: ReminderScheduleType;
  remindAt: string | null;
  repeatIntervalMinutes: number | null;
}

export interface UpdateReminderContentRequest {
  title: string;
  note: string;
}

export interface ReminderResponse {
  reminder: Reminder;
}

export interface EmailAudit {
  auditId: string;
  reminderId: string | null;
  recipientEmail: string;
  subject: string;
  bodyText: string;
  contentSha256: string;
  status: "pending" | "sent" | "failed";
  providerEmailId: string | null;
  failureMessage: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface EmailAuditListResponse {
  audits: EmailAudit[];
}

export interface VocabularyAttempt {
  attemptId: string;
  question: string;
  exampleSentence: string;
  answer: string;
  isCorrect: boolean;
  feedback: string;
  correctedSentence: string | null;
  createdAt: string;
}

export interface VocabularyUsage {
  usageId: string;
  collectionId: string;
  word: string;
  prompt: string;
  lastLearnTime: string | null;
  correct: number;
  wrong: number;
  last8CorrectRate: string;
  createdAt: string;
  updatedAt: string;
  attempts: VocabularyAttempt[];
}

export interface VocabularyCollectionSummary { collectionId: string; name: string }
export interface VocabularyUsageListResponse { collections: VocabularyCollectionSummary[]; usages: VocabularyUsage[] }
export interface VocabularyUsageResponse { usage: VocabularyUsage }
export interface CreateVocabularyUsageRequest { collectionId: string; word: string; prompt: string }
export interface CreateVocabularyAttemptRequest {
  usageId: string;
  question: string;
  exampleSentence: string;
  answer: string;
  isCorrect: boolean;
  feedback: string;
  correctedSentence: string | null;
}
export interface CreateVocabularyAttemptResponse {
  attempt: VocabularyAttempt;
  last8CorrectRate: string;
}

export type DrillPartOfSpeech = "vt" | "vi" | "v" | "adj" | "adv" | "n" | "prep" | "conj" | "pron" | "int" | "num" | "art" | "other";
export interface DrillMeaning { text: string; partOfSpeech: DrillPartOfSpeech }
export interface VocabularyPhonetic { accent: "uk" | "us" | "other"; text: string; audio?: string }
export interface VocabularyReviewSummary {
  addedAt: string | null; lastReviewedAt: string | null; dueAt: string | null;
  status: "new" | "due" | "scheduled"; estimated: boolean;
  recallProbability: number | null; stabilityDays: number | null; difficulty: number | null;
  lapses: number | null; calculatedAt: string;
}
export interface VocabularyCollectionItem { review?: VocabularyReviewSummary; dataset: string; sourceWordId: number; word: string; phonetic: string; phonetics?: VocabularyPhonetic[]; meanings: DrillMeaning[]; pluralForms?: string; pastForms?: string; example?: string; definition?: string; appearanceCount: number; correctCount: number; wrongCount: number }
export interface VocabularyCollection { orderGeneratedAt?: string; practiceOrder?: string[]; collectionId: string; name: string; items: VocabularyCollectionItem[] }
export interface VocabularyDrillUserDataResponse { collections: VocabularyCollection[]; progress: Array<{ dataset: string; mode: string; orderGeneratedAt?: string; order: number[]; index: number }> }

export interface EncryptedLlmSettingsBackup {
  version: 1;
  salt: string;
  iv: string;
  ciphertext: string;
  updatedAt?: string;
}

export interface LlmSettingsBackupResponse {
  backup: EncryptedLlmSettingsBackup;
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
