import type {
  EmailAudit as EmailAuditMessage,
  EncryptedBackup,
  QuickLink as QuickLinkMessage,
  Reminder as ReminderMessage,
} from "@gen/jadren/v1/account_pb";
import type { User } from "@gen/jadren/v1/auth_pb";
import type { Meaning, Phonetic } from "@gen/jadren/v1/common_pb";
import type {
  Collection,
  CollectionItem,
  PracticeAttempt,
  PracticeUsage,
  ReviewSummary,
  WordQuiz,
} from "@gen/jadren/v1/vocabulary_pb";
import type {
  AccountStatus,
  DrillMeaning,
  DrillPartOfSpeech,
  EmailAudit,
  EncryptedLlmSettingsBackup,
  QuickLink,
  Reminder,
  ReminderDeliveryStatus,
  ReminderScheduleType,
  ReminderStatus,
  UserProfile,
  VocabularyAttempt,
  VocabularyCollection,
  VocabularyCollectionItem,
  VocabularyPhonetic,
  VocabularyReviewSummary,
  VocabularyUsage,
  VocabularyWordQuiz,
} from "./types";

/** Protobuf optional fields arrive as undefined; the UI models absence as null. */
const orNull = <T>(value: T | undefined): T | null => value ?? null;

export function toUserProfile(user: User | undefined): UserProfile {
  if (!user) throw new Error("Response did not include a user");
  return {
    userId: user.userId,
    nickname: user.nickname,
    email: user.email,
    phone: orNull(user.phone),
    registeredAt: user.registeredAt,
    status: user.status as AccountStatus,
  };
}

export function toQuickLink(link: QuickLinkMessage | undefined): QuickLink {
  if (!link) throw new Error("Response did not include a link");
  return {
    shortName: link.shortName,
    targetUrl: link.targetUrl,
    note: orNull(link.note),
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    clickCount: link.clickCount,
  };
}

export function toReminder(reminder: ReminderMessage | undefined): Reminder {
  if (!reminder) throw new Error("Response did not include a reminder");
  return {
    reminderId: reminder.reminderId,
    title: reminder.title,
    note: reminder.note,
    remindAt: orNull(reminder.remindAt),
    nextRemindAt: orNull(reminder.nextRemindAt),
    repeats: reminder.repeats,
    scheduleType: reminder.scheduleType as ReminderScheduleType,
    repeatIntervalMinutes: orNull(reminder.repeatIntervalMinutes),
    status: reminder.status as ReminderStatus,
    createdAt: reminder.createdAt,
    updatedAt: reminder.updatedAt,
    lastSentAt: orNull(reminder.lastSentAt),
    completedAt: orNull(reminder.completedAt),
    lastDeliveryStatus: orNull(reminder.lastDeliveryStatus) as ReminderDeliveryStatus,
  };
}

export function toEmailAudit(audit: EmailAuditMessage): EmailAudit {
  return {
    auditId: audit.auditId,
    reminderId: orNull(audit.reminderId),
    recipientEmail: audit.recipientEmail,
    subject: audit.subject,
    bodyText: audit.bodyText,
    contentSha256: audit.contentSha256,
    status: audit.status as EmailAudit["status"],
    providerEmailId: orNull(audit.providerEmailId),
    failureMessage: orNull(audit.failureMessage),
    createdAt: audit.createdAt,
    sentAt: orNull(audit.sentAt),
  };
}

export function toLlmBackup(backup: EncryptedBackup | undefined): EncryptedLlmSettingsBackup {
  if (!backup) throw new Error("Response did not include a backup");
  return {
    version: backup.version as 1,
    salt: backup.salt,
    iv: backup.iv,
    ciphertext: backup.ciphertext,
    updatedAt: backup.updatedAt,
  };
}

export function toDrillMeaning(meaning: Meaning): DrillMeaning {
  return { text: meaning.text, partOfSpeech: meaning.partOfSpeech as DrillPartOfSpeech };
}

export function toPhonetic(phonetic: Phonetic): VocabularyPhonetic {
  return {
    accent: phonetic.accent as VocabularyPhonetic["accent"],
    text: phonetic.text,
    ...(phonetic.audio ? { audio: phonetic.audio } : {}),
  };
}

/** Request-side counterpart of toPhonetic/toDrillMeaning: plain objects become message init values. */
export const meaningInit = (meaning: DrillMeaning) => ({ text: meaning.text, partOfSpeech: meaning.partOfSpeech });
export const phoneticInit = (phonetic: VocabularyPhonetic) => ({ accent: phonetic.accent, text: phonetic.text, audio: phonetic.audio });

function toAttempt(attempt: PracticeAttempt): VocabularyAttempt {
  return {
    attemptId: attempt.attemptId,
    question: attempt.question,
    exampleSentence: attempt.exampleSentence,
    answer: attempt.answer,
    isCorrect: attempt.isCorrect,
    feedback: attempt.feedback,
    correctedSentence: orNull(attempt.correctedSentence),
    createdAt: attempt.createdAt,
  };
}

export { toAttempt as toVocabularyAttempt };

export function toVocabularyUsage(usage: PracticeUsage | undefined): VocabularyUsage {
  if (!usage) throw new Error("Response did not include a usage");
  return {
    usageId: usage.usageId,
    collectionId: usage.collectionId,
    word: usage.word,
    prompt: usage.prompt,
    lastLearnTime: orNull(usage.lastLearnTime),
    correct: usage.correct,
    wrong: usage.wrong,
    last8CorrectRate: usage.last8CorrectRate,
    createdAt: usage.createdAt,
    updatedAt: usage.updatedAt,
    attempts: usage.attempts.map(toAttempt),
  };
}

function toReview(review: ReviewSummary): VocabularyReviewSummary {
  return {
    addedAt: orNull(review.addedAt),
    lastReviewedAt: orNull(review.lastReviewedAt),
    dueAt: orNull(review.dueAt),
    status: review.status as VocabularyReviewSummary["status"],
    estimated: review.estimated,
    recallProbability: orNull(review.recallProbability),
    stabilityDays: orNull(review.stabilityDays),
    difficulty: orNull(review.difficulty),
    lapses: orNull(review.lapses),
    calculatedAt: review.calculatedAt,
  };
}

export function toCollectionItem(item: CollectionItem): VocabularyCollectionItem {
  return {
    ...(item.review ? { review: toReview(item.review) } : {}),
    dataset: item.dataset,
    sourceWordId: item.sourceWordId,
    word: item.word,
    phonetic: item.phonetic,
    phonetics: item.phonetics.map(toPhonetic),
    meanings: item.meanings.map(toDrillMeaning),
    pluralForms: item.pluralForms,
    pastForms: item.pastForms,
    example: item.example,
    definition: item.definition,
    appearanceCount: item.appearanceCount,
    correctCount: item.correctCount,
    wrongCount: item.wrongCount,
  };
}

export function toCollection(collection: Collection | undefined): VocabularyCollection {
  if (!collection) throw new Error("Response did not include a collection");
  return {
    orderGeneratedAt: collection.orderGeneratedAt,
    practiceOrder: collection.practiceOrder,
    collectionId: collection.collectionId,
    name: collection.name,
    items: collection.items.map(toCollectionItem),
  };
}

export function toWordQuiz(quiz: WordQuiz | undefined): VocabularyWordQuiz | null {
  if (!quiz) return null;
  return {
    dataset: quiz.dataset,
    sourceWordId: quiz.sourceWordId,
    word: quiz.word,
    exerciseKind: quiz.exerciseKind as VocabularyWordQuiz["exerciseKind"],
    meanings: quiz.meanings.map(toDrillMeaning),
    hints: quiz.hints,
    createdAt: quiz.createdAt,
  };
}
