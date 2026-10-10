import type { JsonObject } from "@bufbuild/protobuf";
import type { CallOptions } from "@connectrpc/connect";
import type { EditorArticle, EditorArticleSummary } from "@lib/publishing/editor";
import type { ReviewEvent } from "@lib/vocabulary-practice/collection-memory";
import { AuthSessionManager } from "./auth-session";
import {
  meaningInit,
  phoneticInit,
  toCollection,
  toCollectionItem,
  toDrillMeaning,
  toEmailAudit,
  toLlmBackup,
  toPhonetic,
  toQuickLink,
  toReminder,
  toVocabularyAttempt,
  toVocabularyUsage,
  toWordQuiz,
} from "./mappers";
import { createRpcClients } from "./rpc";
import type * as T from "./types";

export const authSession = new AuthSessionManager();

const rpc = createRpcClients({
  getAccessToken: authSession.getAccessToken,
  refreshAccessToken: authSession.refreshAccessToken,
});

export const quickLinksApi = {
  list: async (): Promise<T.QuickLinkListResponse> => {
    const response = await rpc.quickLinks.listQuickLinks({});
    return { links: response.links.map(toQuickLink) };
  },
  create: async (input: T.CreateQuickLinkRequest): Promise<T.CreateQuickLinkResponse> => {
    const response = await rpc.quickLinks.createQuickLink({ ...input, note: input.note ?? undefined });
    return { link: toQuickLink(response.link) };
  },
  update: async (shortName: string, input: T.UpdateQuickLinkRequest): Promise<T.CreateQuickLinkResponse> => {
    // An empty note clears it on the server.
    const response = await rpc.quickLinks.updateQuickLink({
      shortName,
      targetUrl: input.targetUrl,
      note: input.note === undefined ? undefined : input.note ?? "",
      expiresAt: input.expiresAt,
      disable: input.disable,
    });
    return { link: toQuickLink(response.link) };
  },
  delete: async (shortName: string): Promise<void> => {
    await rpc.quickLinks.deleteQuickLink({ shortName });
  },
};

export const remindersApi = {
  list: async (): Promise<T.ReminderListResponse> => {
    const response = await rpc.reminders.listReminders({});
    return { reminders: response.reminders.map(toReminder) };
  },
  create: async (input: T.CreateReminderRequest): Promise<T.ReminderResponse> => {
    const response = await rpc.reminders.createReminder({
      title: input.title,
      note: input.note,
      remindAt: input.remindAt ?? undefined,
      scheduleType: input.scheduleType,
      repeatIntervalMinutes: input.repeatIntervalMinutes ?? undefined,
    });
    return { reminder: toReminder(response.reminder) };
  },
  setStatus: async (reminderId: string, status: "active" | "paused"): Promise<T.ReminderResponse> => {
    const response = await rpc.reminders.setReminderStatus({ reminderId, status });
    return { reminder: toReminder(response.reminder) };
  },
  updateSchedule: async (reminderId: string, input: T.UpdateReminderScheduleRequest): Promise<T.ReminderResponse> => {
    const response = await rpc.reminders.updateReminderSchedule({
      reminderId,
      scheduleType: input.scheduleType,
      remindAt: input.remindAt ?? undefined,
      repeatIntervalMinutes: input.repeatIntervalMinutes ?? undefined,
    });
    return { reminder: toReminder(response.reminder) };
  },
  updateContent: async (reminderId: string, input: T.UpdateReminderContentRequest): Promise<T.ReminderResponse> => {
    const response = await rpc.reminders.updateReminderContent({ reminderId, ...input });
    return { reminder: toReminder(response.reminder) };
  },
  reactivate: async (reminderId: string, remindAt: string): Promise<T.ReminderResponse> => {
    const response = await rpc.reminders.reactivateReminder({ reminderId, remindAt });
    return { reminder: toReminder(response.reminder) };
  },
  delete: async (reminderId: string): Promise<void> => {
    await rpc.reminders.deleteReminder({ reminderId });
  },
  audit: async (): Promise<T.EmailAuditListResponse> => {
    const response = await rpc.reminders.listReminderAudits({});
    return { audits: response.audits.map(toEmailAudit) };
  },
};

export const vocabularyPracticeApi = {
  list: async (): Promise<T.VocabularyUsageListResponse> => {
    const response = await rpc.sentencePractice.listUsages({});
    return {
      collections: response.collections.map(({ collectionId, name }) => ({ collectionId, name })),
      usages: response.usages.map(toVocabularyUsage),
    };
  },
  createUsage: async (input: T.CreateVocabularyUsageRequest): Promise<T.VocabularyUsageResponse> => {
    const response = await rpc.sentencePractice.createUsage(input);
    return { usage: toVocabularyUsage(response.usage) };
  },
  deleteUsage: async (usageId: string): Promise<void> => {
    await rpc.sentencePractice.deleteUsage({ usageId });
  },
  recordAttempt: async (input: T.CreateVocabularyAttemptRequest): Promise<T.CreateVocabularyAttemptResponse> => {
    const response = await rpc.sentencePractice.recordAttempt({
      ...input,
      correctedSentence: input.correctedSentence ?? undefined,
    });
    if (!response.attempt) throw new Error("Response did not include an attempt");
    return { attempt: toVocabularyAttempt(response.attempt), last8CorrectRate: response.last8CorrectRate };
  },
};

export interface VocabularyDrillWord {
  id: number;
  english: string;
  phonetic: string;
  chinese: string;
  phonetics: T.VocabularyPhonetic[];
  meanings: T.DrillMeaning[];
  examples: Array<{ en: string; zh: string }>;
  hintIndexes: number[];
  duplicateCount: number;
}

export type VocabularyDrillMode = "phonetic" | "meaning" | "word";

export interface NewCollectionItem {
  collectionId: string;
  dataset: string;
  sourceWordId?: number;
  word: string;
  phonetic: string;
  phonetics?: T.VocabularyPhonetic[];
  meanings: T.DrillMeaning[];
  pluralForms?: string;
  pastForms?: string;
  example?: string;
  definition?: string;
}

export interface CollectionStatDelta {
  collectionId: string;
  dataset: string;
  sourceWordId: number;
  lastReviewedAt?: string;
  reviews?: ReviewEvent[];
  appearances: number;
  correct: number;
  wrong: number;
}

export const vocabularyDrillApi = {
  wordIds: async (dataset: string, mode: VocabularyDrillMode): Promise<number[]> =>
    (await rpc.vocabularyDrill.listWordIds({ dataset, mode })).ids,
  searchWords: async (dataset: string, mode: VocabularyDrillMode, query: string) =>
    (await rpc.vocabularyDrill.searchWords({ dataset, mode, query })).matches.map(({ id, english }) => ({ id, english })),
  words: async (dataset: string, mode: VocabularyDrillMode, ids: number[]): Promise<VocabularyDrillWord[]> =>
    (await rpc.vocabularyDrill.getWords({ dataset, mode, ids })).words.map((word) => ({
      id: word.id,
      english: word.english,
      phonetic: word.phonetic,
      chinese: word.chinese,
      phonetics: word.phonetics.map(toPhonetic),
      meanings: word.meanings.map(toDrillMeaning),
      examples: word.examples.map(({ en, zh }) => ({ en, zh })),
      hintIndexes: word.hintIndexes,
      duplicateCount: word.duplicateCount,
    })),
  lookupOnline: async (word: string) => {
    const response = await rpc.vocabularyDrill.lookupOnlineWord({ word });
    return {
      phonetic: response.phonetic,
      phonetics: response.phonetics.map(toPhonetic),
      definition: response.definition,
      example: response.example,
      definitions: response.definitions.map(({ partOfSpeech, definition, example }) => ({ partOfSpeech, definition, example })),
    };
  },
  wordQuiz: async (dataset: string, sourceWordId: number): Promise<T.VocabularyWordQuizResponse> => {
    const response = await rpc.vocabularyDrill.getWordQuiz({ dataset, sourceWordId });
    return { quiz: toWordQuiz(response.quiz), canGenerate: response.canGenerate };
  },
  cacheWordQuiz: async (input: { dataset: string; sourceWordId: number; word: string; exerciseKind: "meanings" | "dictionary"; senseKeys: string[]; generatorModel: string }): Promise<T.VocabularyWordQuizResponse> => {
    const response = await rpc.vocabularyDrill.cacheWordQuiz(input);
    return { quiz: toWordQuiz(response.quiz), canGenerate: response.canGenerate };
  },
  reorderCollection: async (collectionId: string): Promise<{ saved: boolean }> =>
    ({ saved: (await rpc.vocabularyDrill.reorderCollection({ collectionId })).saved }),
  userData: async (): Promise<T.VocabularyDrillUserDataResponse> => {
    const response = await rpc.vocabularyDrill.getUserData({});
    return {
      collections: response.collections.map(toCollection),
      progress: response.progress.map((entry) => ({
        dataset: entry.dataset,
        mode: entry.mode,
        orderGeneratedAt: entry.orderGeneratedAt,
        order: entry.order,
        index: entry.index,
      })),
    };
  },
  createCollection: async (name: string): Promise<{ collection: T.VocabularyCollection }> =>
    ({ collection: toCollection((await rpc.vocabularyDrill.createCollection({ name })).collection) }),
  deleteCollection: async (collectionId: string): Promise<void> => {
    await rpc.vocabularyDrill.deleteCollection({ collectionId });
  },
  addItem: async (input: NewCollectionItem): Promise<{ saved: boolean; item?: T.VocabularyCollectionItem }> => {
    const response = await rpc.vocabularyDrill.addItem({
      ...input,
      phonetics: input.phonetics?.map(phoneticInit),
      meanings: input.meanings.map(meaningInit),
    });
    return { saved: response.saved, ...(response.item ? { item: toCollectionItem(response.item) } : {}) };
  },
  transferItem: async (input: { collectionId: string; dataset: string; sourceWordId: number }): Promise<{ restored: boolean; destinationCollectionId: string }> => {
    const response = await rpc.vocabularyDrill.transferItem(input);
    return { restored: response.restored, destinationCollectionId: response.destinationCollectionId };
  },
  saveStatDeltas: async (deltas: CollectionStatDelta[]): Promise<{ saved: boolean }> =>
    ({ saved: (await rpc.vocabularyDrill.saveStatDeltas({ deltas: deltas.map((delta) => ({ ...delta, reviews: delta.reviews ?? [] })) })).saved }),
  deleteItem: async (collectionId: string, sourceWordId: number, dataset?: string): Promise<void> => {
    await rpc.vocabularyDrill.deleteItem({ collectionId, sourceWordId, dataset });
  },
  saveProgress: async (input: { dataset: string; mode: string; orderGeneratedAt?: string; order: number[]; index: number }): Promise<{ saved: boolean }> =>
    ({ saved: (await rpc.vocabularyDrill.saveProgress(input)).saved }),
};

export const llmSettingsApi = {
  download: async (): Promise<T.LlmSettingsBackupResponse> =>
    ({ backup: toLlmBackup((await rpc.llmSettings.getBackup({})).backup) }),
  upload: async (backup: T.EncryptedLlmSettingsBackup): Promise<T.LlmSettingsBackupResponse> =>
    ({ backup: toLlmBackup((await rpc.llmSettings.putBackup(backup)).backup) }),
};

export type DictionaryDirection = "auto" | "en-zh" | "zh-en";

export const dictionaryApi = {
  lookup: async (word: string, direction: DictionaryDirection = "auto", options?: CallOptions): Promise<JsonObject> =>
    (await rpc.dictionary.lookup({ word, direction }, options)).result ?? {},
  search: async (query: string, direction: DictionaryDirection = "auto", limit = 20, options?: CallOptions) => {
    const response = await rpc.dictionary.search({ query, direction, limit }, options);
    return { query: response.query, count: response.count, results: response.results as JsonObject[] };
  },
};

export interface DnsRecordResult { name: string; type: string; TTL: number; data: string }
export interface DnsLookupResult {
  domain: string;
  type: string;
  Answer: DnsRecordResult[];
  Authority: DnsRecordResult[];
  Additional: DnsRecordResult[];
  comment?: string;
}
export interface DnsLeakQuery {
  id?: number;
  query_type: string;
  client_ip: string;
  country_code: string;
  city: string;
  edns_subnet: string | null;
  edns_country_code: string | null;
  nsid: string | null;
  created_at: string;
}
export interface DnsLeakResult { domain: string; found: boolean; queries: DnsLeakQuery[] }

export const toolsApi = {
  clientIp: async () => {
    const response = await rpc.tools.getClientIp({});
    return {
      ip: response.ip,
      headers: { "x-forwarded-for": response.xForwardedFor ?? null, "x-real-ip": response.xRealIp ?? null },
    };
  },
  ipGeo: async (ip: string, options?: CallOptions): Promise<JsonObject> =>
    (await rpc.tools.lookupIpGeo({ ip }, options)).data ?? {},
  resolveDns: async (domain: string, type: string): Promise<DnsLookupResult> => {
    const response = await rpc.tools.resolveDns({ domain, type });
    const records = (list: typeof response.answer) =>
      list.map((record) => ({ name: record.name, type: record.type, TTL: record.ttl, data: record.data }));
    return {
      domain: response.domain,
      type: response.type,
      Answer: records(response.answer),
      Authority: records(response.authority),
      Additional: records(response.additional),
      ...(response.comment ? { comment: response.comment } : {}),
    };
  },
  dnsLeak: async (domains: string[], options?: CallOptions): Promise<DnsLeakResult[]> =>
    (await rpc.tools.checkDnsLeak({ domains }, options)).results.map((result) => ({
      domain: result.domain,
      found: result.found,
      queries: result.queries.map((query) => ({
        ...(query.id === undefined ? {} : { id: Number(query.id) }),
        query_type: query.queryType,
        client_ip: query.clientIp,
        country_code: query.countryCode,
        city: query.city,
        edns_subnet: query.ednsSubnet ?? null,
        edns_country_code: query.ednsCountryCode ?? null,
        nsid: query.nsid ?? null,
        created_at: query.createdAt,
      })),
    })),
  pronounce: async (word: string, options?: CallOptions): Promise<Blob> => {
    const response = await rpc.tools.synthesizePronunciation({ word }, options);
    return new Blob([new Uint8Array(response.audio)], { type: response.contentType });
  },
  searchPosts: async (query: string, locale: string, options?: CallOptions) => {
    const response = await rpc.tools.searchPosts({ query, locale }, options);
    return { results: response.results as JsonObject[], tags: response.tags };
  },
};

function toArticle(article: import("@gen/jadren/v1/publishing_pb").EditorArticle): EditorArticle {
  return {
    pendingId: article.pendingId ?? null,
    postId: article.postId ?? null,
    locale: article.locale as EditorArticle["locale"],
    slug: article.slug,
    title: article.title,
    description: article.description,
    content: article.content,
    tags: article.tags,
    updatedAt: article.updatedAt,
    published: article.published,
    authorId: article.authorId ?? null,
    authorName: article.authorName ?? null,
    ownerId: article.ownerId ?? null,
    ownerName: article.ownerName ?? null,
    lastEditedUser: article.lastEditedUser ?? null,
    lastEditedUserName: article.lastEditedUserName ?? null,
    forkedFromPendingId: article.forkedFromPendingId ?? null,
    contributors: article.contributors.map(({ userId, name, contributionCount }) => ({ userId, name, contributionCount })),
  };
}

function toArticleSummary(article: import("@gen/jadren/v1/publishing_pb").EditorArticle): EditorArticleSummary {
  const { content, ...summary } = toArticle(article);
  void content;
  return summary;
}

export const editorApi = {
  listArticles: async () => {
    const response = await rpc.editor.listArticles({});
    return { articles: response.articles.map(toArticleSummary), isAdmin: response.isAdmin };
  },
  articleContent: async (target: { pendingId: string | null; postId: string | null }) =>
    (await rpc.editor.getArticleContent({
      pendingId: target.pendingId ?? undefined,
      postId: target.pendingId ? undefined : target.postId ?? undefined,
    })).content,
  saveDraft: async (article: EditorArticle) =>
    (await rpc.editor.saveDraft({
      pendingId: article.pendingId ?? undefined,
      postId: article.postId ?? undefined,
      locale: article.locale,
      slug: article.slug,
      title: article.title,
      description: article.description,
      content: article.content,
      tags: article.tags,
    })).pendingId,
  publishDraft: async (pendingId: string, message: string) => {
    const response = await rpc.editor.publishDraft({ pendingId, message });
    return { postId: response.postId, locale: response.locale, slug: response.slug, notificationSent: response.notificationSent };
  },
  listPending: async () => (await rpc.admin.listPending({})).pending.map(toArticle),
  forkPending: async (pendingId: string) => (await rpc.admin.forkPending({ pendingId })).pendingId,
  forkArticle: async (postId: string) => (await rpc.admin.forkArticle({ postId })).pendingId,
  rejectPending: async (pendingId: string, reason: string) => {
    const response = await rpc.admin.rejectPending({ pendingId, reason });
    return { deleted: response.deleted, notificationSent: response.notificationSent ?? null };
  },
  deleteArticle: async (postId: string, reason: string) => {
    const response = await rpc.admin.deleteArticle({ postId, reason });
    return { deleted: response.deleted, notificationSent: response.notificationSent ?? null };
  },
};

export * from "./http";
export * from "./types";
