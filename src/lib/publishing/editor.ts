import { db, withTransaction, type QueryClient } from "@lib/auth/db";
import { bearerToken, verifyAccessToken } from "@lib/auth/jwt";
import type { Locale } from "./posts";

export interface EditorArticle {
  pendingId: string | null;
  postId: string | null;
  locale: Locale;
  slug: string;
  title: string;
  description: string;
  content: string;
  tags: string[];
  updatedAt: string;
  published: boolean;
  authorId: string | null;
  authorName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  lastEditedUser: string | null;
  lastEditedUserName: string | null;
  forkedFromPendingId: string | null;
  contributors: ArticleContributor[];
}

export type EditorArticleSummary = Omit<EditorArticle, "content">;

export interface ArticleContributor {
  userId: string;
  name: string;
  contributionCount: number;
}

export interface PendingReview extends EditorArticle {
  authorId: string;
  authorName: string;
  ownerName: string;
  lastEditedUserName: string;
}

export interface RejectedDraft {
  rejectionId: string;
  pendingId: string;
  authorId: string;
  email: string;
  locale: Locale;
  slug: string;
  title: string;
  reason: string;
}

export interface DeletedPublishedArticle {
  postId: string;
  authorId: string | null;
  email: string | null;
  locale: Locale;
  slug: string;
  title: string;
  reason: string;
}

interface ArticleInput {
  pendingId: string | null;
  postId: string | null;
  locale: Locale;
  slug: string;
  title: string;
  description: string;
  content: string;
  tags: string[];
}

interface ArticleRow {
  pending_id: string | null;
  post_id: string | null;
  locale: Locale;
  slug: string;
  title: string;
  description: string;
  content: string;
  tags: string[] | null;
  updated_at: Date | string;
  published: boolean;
  author_id: string | null;
  author_name: string | null;
  owner_id: string | null;
  owner_name: string | null;
  last_edited_user: string | null;
  last_edited_user_name: string | null;
  forked_from_pending_id: string | null;
  contributors: ArticleContributor[] | null;
}

export async function editorUser(request: Request) {
  const token = bearerToken(request);
  if (!token) return null;
  try {
    const user = await verifyAccessToken(token);
    if (user.status !== 1) return null;
    const permission = await db.query<{ is_admin: boolean }>(
      "SELECT is_admin FROM user_main WHERE user_id = $1 AND status = 1 LIMIT 1",
      [user.sub]
    );
    if (!permission.rows[0]) return null;
    return { ...user, isAdmin: permission.rows[0].is_admin };
  } catch {
    return null;
  }
}

export function parseArticleInput(value: unknown): ArticleInput {
  const body = value as Record<string, unknown> | null;
  const text = (key: string, max: number, required = false) => {
    const result = typeof body?.[key] === "string" ? body[key].trim() : "";
    if ((required && !result) || result.length > max) throw new Error(`Invalid ${key}`);
    return result;
  };
  const nullableId = (key: string) => {
    const result = body?.[key];
    if (result === undefined || result === null || result === "") return null;
    if (typeof result !== "string" || !/^[0-9a-f-]{36}$/i.test(result)) throw new Error(`Invalid ${key}`);
    return result;
  };
  const locale = body?.locale;
  if (locale !== "en" && locale !== "zh") throw new Error("Invalid locale");
  const slug = text("slug", 160, true).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Invalid slug");
  const rawTags = Array.isArray(body?.tags) ? body.tags : [];
  const tags = [...new Set(rawTags.map((tag) => String(tag).trim()).filter(Boolean))];
  if (tags.length > 20 || tags.some((tag) => tag.length > 50)) throw new Error("Invalid tags");
  return {
    pendingId: nullableId("pendingId"),
    postId: nullableId("postId"),
    locale,
    slug,
    title: text("title", 240, true),
    description: text("description", 500),
    content: typeof body?.content === "string" ? body.content : "",
    tags,
  };
}

function toArticle(row: ArticleRow): EditorArticle {
  return {
    pendingId: row.pending_id,
    postId: row.post_id,
    locale: row.locale,
    slug: row.slug,
    title: row.title,
    description: row.description,
    content: row.content,
    tags: row.tags ?? [],
    updatedAt: new Date(row.updated_at).toISOString(),
    published: row.published,
    authorId: row.author_id,
    authorName: row.author_name,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    lastEditedUser: row.last_edited_user,
    lastEditedUserName: row.last_edited_user_name,
    forkedFromPendingId: row.forked_from_pending_id,
    contributors: row.contributors ?? [],
  };
}

function toArticleSummary(row: Omit<ArticleRow, "content">): EditorArticleSummary {
  return {
    pendingId: row.pending_id,
    postId: row.post_id,
    locale: row.locale,
    slug: row.slug,
    title: row.title,
    description: row.description,
    tags: row.tags ?? [],
    updatedAt: new Date(row.updated_at).toISOString(),
    published: row.published,
    authorId: row.author_id,
    authorName: row.author_name,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    lastEditedUser: row.last_edited_user,
    lastEditedUserName: row.last_edited_user_name,
    forkedFromPendingId: row.forked_from_pending_id,
    contributors: row.contributors ?? [],
  };
}

export async function listEditorArticles(userId: string, isAdmin: boolean) {
  const result = await db.query<Omit<ArticleRow, "content">>(
    `SELECT d.pending_id, d.post_id, d.locale, d.slug, d.title, d.description,
            d.updated_at, FALSE AS published,
            d.author_id,
            (SELECT nickname FROM user_main WHERE user_id = d.author_id) AS author_name,
            d.owner_id,
            (SELECT nickname FROM user_main WHERE user_id = d.owner_id) AS owner_name,
            d.last_edited_user,
            (SELECT nickname FROM user_main WHERE user_id = d.last_edited_user) AS last_edited_user_name,
            d.forked_from_pending_id,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'userId', c.user_id,
                'name', contributor.nickname,
                'contributionCount', c.contribution_count
              ) ORDER BY c.last_contributed_at DESC)
                FROM blog_post_contributor c
                JOIN user_main contributor ON contributor.user_id = c.user_id
               WHERE c.post_id = d.post_id
            ), '[]'::jsonb) AS contributors,
            COALESCE(array_agg(dt.tag ORDER BY dt.tag)
              FILTER (WHERE dt.tag IS NOT NULL), ARRAY[]::varchar[]) AS tags
       FROM blog_post_pending d
       LEFT JOIN blog_post_pending_tag dt ON dt.pending_id = d.pending_id
      WHERE ($2::boolean OR d.owner_id = $1)
      GROUP BY d.pending_id
      UNION ALL
     SELECT NULL::uuid, p.post_id, p.locale, p.slug, p.title, p.description,
            p.updated_at, TRUE,
            p.author_id,
            (SELECT nickname FROM user_main WHERE user_id = p.author_id) AS author_name,
            NULL::uuid, NULL::varchar,
            NULL::uuid, NULL::varchar, NULL::uuid,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'userId', c.user_id,
                'name', contributor.nickname,
                'contributionCount', c.contribution_count
              ) ORDER BY c.last_contributed_at DESC)
                FROM blog_post_contributor c
                JOIN user_main contributor ON contributor.user_id = c.user_id
               WHERE c.post_id = p.post_id
            ), '[]'::jsonb) AS contributors,
            COALESCE(array_agg(t.tag ORDER BY t.tag)
              FILTER (WHERE t.tag IS NOT NULL), ARRAY[]::varchar[]) AS tags
       FROM blog_post p
       LEFT JOIN blog_post_tag t ON t.post_id = p.post_id
      GROUP BY p.post_id
      ORDER BY updated_at DESC`,
    [userId, isAdmin]
  );
  return result.rows.map(toArticleSummary);
}

export async function getEditorArticleContent(
  userId: string,
  isAdmin: boolean,
  pendingId: string | null,
  postId: string | null
) {
  if (pendingId) {
    const result = await db.query<{ content: string }>(
      `SELECT content
         FROM blog_post_pending
        WHERE pending_id = $1 AND (owner_id = $2 OR $3::boolean)
        LIMIT 1`,
      [pendingId, userId, isAdmin]
    );
    return result.rows[0]?.content ?? null;
  }
  if (postId) {
    const result = await db.query<{ content: string }>(
      "SELECT content FROM blog_post WHERE post_id = $1 LIMIT 1",
      [postId]
    );
    return result.rows[0]?.content ?? null;
  }
  return null;
}

async function replaceTags(client: QueryClient, table: "blog_post_tag" | "blog_post_pending_tag", id: string, tags: string[]) {
  const idColumn = table === "blog_post_tag" ? "post_id" : "pending_id";
  await client.query(`DELETE FROM ${table} WHERE ${idColumn} = $1`, [id]);
  for (const tag of tags) {
    await client.query(`INSERT INTO ${table} (${idColumn}, tag) VALUES ($1, $2)`, [id, tag]);
  }
}

export async function saveDraft(userId: string, isAdmin: boolean, input: ArticleInput) {
  return withTransaction(async (client) => {
    let pendingId = input.pendingId;
    if (pendingId) {
      const result = await client.query<{ pending_id: string }>(
        `UPDATE blog_post_pending
            SET locale = $3, slug = $4, title = $5, description = $6,
                content = $7, last_edited_user = $2, updated_at = NOW()
          WHERE pending_id = $1 AND (owner_id = $2 OR $8::boolean)
          RETURNING pending_id`,
        [pendingId, userId, input.locale, input.slug, input.title, input.description, input.content, isAdmin]
      );
      if (!result.rows[0]) throw new Error("Draft not found");
    } else {
      if (input.postId) {
        const owned = await client.query<{ post_id: string }>(
          "SELECT post_id FROM blog_post WHERE post_id = $1",
          [input.postId]
        );
        if (!owned.rows[0]) throw new Error("Article not found");
      }
      pendingId = crypto.randomUUID();
      await client.query(
        `INSERT INTO blog_post_pending
          (pending_id, post_id, author_id, owner_id, last_edited_user,
           locale, slug, title, description, content)
         VALUES ($1, $2, $3, $3, $3, $4, $5, $6, $7, $8)`,
        [pendingId, input.postId, userId, input.locale, input.slug, input.title, input.description, input.content]
      );
    }
    await replaceTags(client, "blog_post_pending_tag", pendingId, input.tags);
    return pendingId;
  });
}

export async function publishDraft(pendingId: string) {
  return withTransaction(async (client) => {
    const result = await client.query<{
      pending_id: string; post_id: string | null; author_id: string; author_email: string;
      owner_id: string; last_edited_user: string; locale: Locale; slug: string;
      title: string; description: string; content: string;
    }>(
      `SELECT d.pending_id, d.post_id, d.author_id, u.email AS author_email,
              d.owner_id, d.last_edited_user, d.locale, d.slug, d.title,
              d.description, d.content
         FROM blog_post_pending d
         JOIN user_main u ON u.user_id = d.author_id
        WHERE d.pending_id = $1 FOR UPDATE OF d`,
      [pendingId]
    );
    const draft = result.rows[0];
    if (!draft) throw new Error("Draft not found");
    const tags = await client.query<{ tag: string }>(
      "SELECT tag FROM blog_post_pending_tag WHERE pending_id = $1 ORDER BY tag",
      [pendingId]
    );
    const postId = draft.post_id ?? crypto.randomUUID();
    if (draft.post_id) {
      const updated = await client.query<{ post_id: string }>(
        `UPDATE blog_post SET author_id = COALESCE(author_id, $2), locale = $3,
                slug = $4, title = $5, description = $6, content = $7, updated_at = NOW()
          WHERE post_id = $1
          RETURNING post_id`,
        [postId, draft.author_id, draft.locale, draft.slug, draft.title, draft.description, draft.content]
      );
      if (!updated.rows[0]) throw new Error("Article not found");
    } else {
      await client.query(
        `INSERT INTO blog_post
          (post_id, author_id, locale, slug, title, description, content)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [postId, draft.author_id, draft.locale, draft.slug, draft.title, draft.description, draft.content]
      );
    }
    await replaceTags(client, "blog_post_tag", postId, tags.rows.map(({ tag }) => tag));
    for (const contributorId of new Set([draft.author_id, draft.last_edited_user])) {
      await client.query(
        `INSERT INTO blog_post_contributor (post_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (post_id, user_id) DO UPDATE
           SET contribution_count = blog_post_contributor.contribution_count + 1,
               last_contributed_at = NOW()`,
        [postId, contributorId]
      );
    }
    await client.query("DELETE FROM blog_post_pending WHERE pending_id = $1", [pendingId]);
    return {
      postId,
      pendingId: draft.pending_id,
      locale: draft.locale,
      slug: draft.slug,
      title: draft.title,
      authorId: draft.author_id,
      authorEmail: draft.author_email,
    };
  });
}

export async function listPendingReviews(): Promise<PendingReview[]> {
  const result = await db.query<ArticleRow & {
    author_id: string; author_name: string; owner_name: string; last_edited_user_name: string;
  }>(
    `SELECT d.pending_id, d.post_id, d.locale, d.slug, d.title, d.description,
            d.content, d.updated_at, (d.post_id IS NOT NULL) AS published,
            d.owner_id, d.last_edited_user, d.forked_from_pending_id,
            d.author_id, author.nickname AS author_name,
            owner_user.nickname AS owner_name,
            editor.nickname AS last_edited_user_name,
            COALESCE(array_agg(dt.tag ORDER BY dt.tag)
              FILTER (WHERE dt.tag IS NOT NULL), ARRAY[]::varchar[]) AS tags
       FROM blog_post_pending d
       JOIN user_main author ON author.user_id = d.author_id
       JOIN user_main owner_user ON owner_user.user_id = d.owner_id
       JOIN user_main editor ON editor.user_id = d.last_edited_user
       LEFT JOIN blog_post_pending_tag dt ON dt.pending_id = d.pending_id
      GROUP BY d.pending_id, author.nickname, owner_user.nickname, editor.nickname
      ORDER BY d.updated_at ASC`
  );
  return result.rows.map((row) => ({
    ...toArticle(row),
    authorId: row.author_id,
    authorName: row.author_name,
    ownerName: row.owner_name,
    lastEditedUserName: row.last_edited_user_name,
  }));
}

export async function forkDraft(adminId: string, pendingId: string) {
  return withTransaction(async (client) => {
    const sourceResult = await client.query<{
      post_id: string | null; author_id: string; locale: Locale; slug: string; title: string;
      description: string; content: string;
    }>(
      `SELECT post_id, author_id, locale, slug, title, description, content
         FROM blog_post_pending WHERE pending_id = $1 FOR UPDATE`,
      [pendingId]
    );
    const source = sourceResult.rows[0];
    if (!source) throw new Error("Draft not found");

    const existing = await client.query<{ pending_id: string }>(
      `SELECT pending_id FROM blog_post_pending
        WHERE owner_id = $1
          AND (post_id = $2 OR (locale = $3 AND slug = $4))
        LIMIT 1`,
      [adminId, source.post_id, source.locale, source.slug]
    );
    if (existing.rows[0]) return existing.rows[0].pending_id;

    const forkedId = crypto.randomUUID();
    const inserted = await client.query<{ pending_id: string }>(
      `INSERT INTO blog_post_pending
        (pending_id, post_id, author_id, owner_id, last_edited_user,
         forked_from_pending_id, locale, slug, title, description, content)
       VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT DO NOTHING
       RETURNING pending_id`,
      [forkedId, source.post_id, source.author_id, adminId, pendingId,
       source.locale, source.slug, source.title, source.description, source.content]
    );
    if (!inserted.rows[0]) {
      const concurrent = await client.query<{ pending_id: string }>(
        `SELECT pending_id FROM blog_post_pending
          WHERE owner_id = $1
            AND (post_id = $2 OR (locale = $3 AND slug = $4))
          LIMIT 1`,
        [adminId, source.post_id, source.locale, source.slug]
      );
      if (concurrent.rows[0]) return concurrent.rows[0].pending_id;
      throw new Error("Unable to fork pending submission");
    }
    await client.query(
      `INSERT INTO blog_post_pending_tag (pending_id, tag)
       SELECT $1, tag FROM blog_post_pending_tag WHERE pending_id = $2`,
      [forkedId, pendingId]
    );
    return forkedId;
  });
}

export async function forkPublishedArticle(adminId: string, postId: string) {
  return withTransaction(async (client) => {
    const sourceResult = await client.query<{
      post_id: string; author_id: string | null; locale: Locale; slug: string;
      title: string; description: string; content: string;
    }>(
      `SELECT post_id, author_id, locale, slug, title, description, content
         FROM blog_post WHERE post_id = $1 FOR UPDATE`,
      [postId]
    );
    const source = sourceResult.rows[0];
    if (!source) throw new Error("Article not found");

    const existing = await client.query<{ pending_id: string }>(
      `SELECT pending_id FROM blog_post_pending
        WHERE owner_id = $2
          AND (post_id = $1 OR (locale = $3 AND slug = $4))
        LIMIT 1`,
      [postId, adminId, source.locale, source.slug]
    );
    if (existing.rows[0]) return existing.rows[0].pending_id;

    const pendingId = crypto.randomUUID();
    const inserted = await client.query<{ pending_id: string }>(
      `INSERT INTO blog_post_pending
        (pending_id, post_id, author_id, owner_id, last_edited_user,
         locale, slug, title, description, content)
       VALUES ($1, $2, COALESCE($3, $4), $4, $4, $5, $6, $7, $8, $9)
       ON CONFLICT DO NOTHING
       RETURNING pending_id`,
      [pendingId, source.post_id, source.author_id, adminId, source.locale,
       source.slug, source.title, source.description, source.content]
    );
    if (!inserted.rows[0]) {
      const concurrent = await client.query<{ pending_id: string }>(
        `SELECT pending_id FROM blog_post_pending
          WHERE owner_id = $2
            AND (post_id = $1 OR (locale = $3 AND slug = $4))
          LIMIT 1`,
        [postId, adminId, source.locale, source.slug]
      );
      if (concurrent.rows[0]) return concurrent.rows[0].pending_id;
      throw new Error("Unable to fork article");
    }
    await client.query(
      `INSERT INTO blog_post_pending_tag (pending_id, tag)
       SELECT $1, tag FROM blog_post_tag WHERE post_id = $2`,
      [pendingId, postId]
    );
    return pendingId;
  });
}

export async function deletePublishedArticle(
  _adminId: string,
  postId: string,
  reason: string
): Promise<DeletedPublishedArticle> {
  const normalizedReason = reason.trim();
  if (!normalizedReason || normalizedReason.length > 2000) throw new Error("Invalid deletion reason");
  return withTransaction(async (client) => {
    const result = await client.query<{
      post_id: string; author_id: string | null; email: string | null;
      locale: Locale; slug: string; title: string;
    }>(
      `SELECT p.post_id, p.author_id, u.email, p.locale, p.slug, p.title
         FROM blog_post p
         LEFT JOIN user_main u ON u.user_id = p.author_id
        WHERE p.post_id = $1
        FOR UPDATE OF p`,
      [postId]
    );
    const article = result.rows[0];
    if (!article) throw new Error("Article not found");
    const pending = await client.query<{ pending_id: string }>(
      "SELECT pending_id FROM blog_post_pending WHERE post_id = $1 LIMIT 1",
      [postId]
    );
    if (pending.rows[0]) throw new Error("Delete pending drafts before deleting the published article");
    await client.query("DELETE FROM blog_post WHERE post_id = $1", [postId]);
    return {
      postId: article.post_id,
      authorId: article.author_id,
      email: article.email,
      locale: article.locale,
      slug: article.slug,
      title: article.title,
      reason: normalizedReason,
    };
  });
}

export async function rejectDraft(adminId: string, pendingId: string, reason: string): Promise<RejectedDraft> {
  const normalizedReason = reason.trim();
  if (!normalizedReason || normalizedReason.length > 2000) throw new Error("Invalid rejection reason");
  return withTransaction(async (client) => {
    const result = await client.query<{
      pending_id: string; author_id: string; email: string; locale: Locale;
      slug: string; title: string;
    }>(
      `SELECT d.pending_id, d.author_id, u.email, d.locale, d.slug, d.title
         FROM blog_post_pending d
         JOIN user_main u ON u.user_id = d.author_id
        WHERE d.pending_id = $1
        FOR UPDATE OF d`,
      [pendingId]
    );
    const draft = result.rows[0];
    if (!draft) throw new Error("Draft not found");
    const rejectionId = crypto.randomUUID();
    await client.query(
      `INSERT INTO blog_post_rejection
        (rejection_id, pending_id, author_id, rejected_by, recipient_email,
         locale, slug, title, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [rejectionId, pendingId, draft.author_id, adminId, draft.email,
       draft.locale, draft.slug, draft.title, normalizedReason]
    );
    await client.query("DELETE FROM blog_post_pending WHERE pending_id = $1", [pendingId]);
    return {
      rejectionId,
      pendingId,
      authorId: draft.author_id,
      email: draft.email,
      locale: draft.locale,
      slug: draft.slug,
      title: draft.title,
      reason: normalizedReason,
    };
  });
}

export async function recordRejectionNotification(
  rejectionId: string,
  result: { providerEmailId: string } | { failure: string }
) {
  if ("providerEmailId" in result) {
    await db.query(
      `UPDATE blog_post_rejection
          SET notification_status = 'sent', provider_email_id = $2,
              failure_message = NULL, notification_updated_at = NOW()
        WHERE rejection_id = $1`,
      [rejectionId, result.providerEmailId]
    );
    return;
  }
  await db.query(
    `UPDATE blog_post_rejection
        SET notification_status = 'failed', failure_message = $2,
            notification_updated_at = NOW()
      WHERE rejection_id = $1`,
    [rejectionId, result.failure.slice(0, 4000)]
  );
}
