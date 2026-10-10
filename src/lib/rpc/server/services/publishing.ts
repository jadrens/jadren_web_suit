import { revalidateTag } from "next/cache";
import type { ServiceImpl } from "@connectrpc/connect";
import type { AdminService, EditorService } from "@gen/jadren/v1/publishing_pb";
import {
  deletePublishedArticle,
  editorUser,
  forkDraft,
  forkPublishedArticle,
  getEditorArticleContent,
  listEditorArticles,
  listPendingReviews,
  parseArticleInput,
  publishDraft,
  recordRejectionNotification,
  rejectDraft,
  saveDraft,
  type EditorArticle,
  type EditorArticleSummary,
} from "@lib/publishing/editor";
import { sendBlogApprovalEmail, sendBlogDeletionEmail, sendBlogRejectionEmail } from "@lib/auth/mailer";
import { apiFailure } from "../errors";
import { headersOf } from "../context";

const UUID = /^[0-9a-f-]{36}$/i;

async function requireEditor(context: Parameters<typeof headersOf>[0]) {
  const user = await editorUser(headersOf(context));
  if (!user) throw apiFailure("Unauthorized", 401, "unauthorized");
  return user;
}

async function requireAdmin(context: Parameters<typeof headersOf>[0], message = "Forbidden") {
  const user = await requireEditor(context);
  if (!user.isAdmin) throw apiFailure(message, 403, "forbidden");
  return user;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/** The publishing layer reports failures as plain messages; map them to RPC codes. */
function workflowFailure(detail: string, notFound: string, invalidPrefix = false) {
  const status = detail === notFound || detail.endsWith("not found")
    ? 404
    : invalidPrefix && detail.startsWith("Invalid")
      ? 400
      : 409;
  return apiFailure(detail, status, status === 404 ? "not_found" : status === 400 ? "invalid_request" : "conflict");
}

function articleMessage(article: EditorArticleSummary | EditorArticle) {
  return {
    ...article,
    content: "content" in article ? article.content : "",
    pendingId: article.pendingId ?? undefined,
    postId: article.postId ?? undefined,
    authorId: article.authorId ?? undefined,
    authorName: article.authorName ?? undefined,
    ownerId: article.ownerId ?? undefined,
    ownerName: article.ownerName ?? undefined,
    lastEditedUser: article.lastEditedUser ?? undefined,
    lastEditedUserName: article.lastEditedUserName ?? undefined,
    forkedFromPendingId: article.forkedFromPendingId ?? undefined,
  };
}

function reasonOf(value: string, subject: string) {
  const reason = value.trim();
  if (!reason || reason.length > 2000) {
    throw apiFailure(`A ${subject} reason between 1 and 2000 characters is required`, 400, "invalid_reason");
  }
  return reason;
}

export const editorService: ServiceImpl<typeof EditorService> = {
  async listArticles(_request, context) {
    const user = await requireEditor(context);
    try {
      const articles = await listEditorArticles(user.sub, user.isAdmin);
      return { articles: articles.map(articleMessage), isAdmin: user.isAdmin };
    } catch (error) {
      console.error("Unable to list editor articles", error);
      throw apiFailure("Unable to load articles", 500, "internal_error");
    }
  },

  async getArticleContent(request, context) {
    const user = await requireEditor(context);
    const { pendingId, postId } = request;
    if ((pendingId && !UUID.test(pendingId)) || (postId && !UUID.test(postId)) || (!pendingId && !postId)) {
      throw apiFailure("A valid article ID is required", 400, "invalid_article_id");
    }
    const content = await getEditorArticleContent(user.sub, user.isAdmin, pendingId ?? null, pendingId ? null : postId ?? null);
    if (content === null) throw apiFailure("Article not found", 404, "not_found");
    return { content };
  },

  async saveDraft(request, context) {
    const user = await requireEditor(context);
    try {
      const input = parseArticleInput({
        pendingId: request.pendingId ?? null,
        postId: request.postId ?? null,
        locale: request.locale,
        slug: request.slug,
        title: request.title,
        description: request.description,
        content: request.content,
        tags: request.tags,
      });
      return { pendingId: await saveDraft(user.sub, user.isAdmin, input) };
    } catch (error) {
      throw workflowFailure(errorMessage(error, "Editor request failed"), "", true);
    }
  },

  async publishDraft(request, context) {
    const user = await requireEditor(context);
    if (!user.isAdmin) throw apiFailure("Administrator approval is required", 403, "forbidden");
    if (!request.pendingId) throw apiFailure("pendingId is required", 400, "invalid_pending_id");
    const message = request.message.trim();
    if (message.length > 2000) {
      throw apiFailure("Approval message must not exceed 2000 characters", 400, "invalid_message");
    }

    let published;
    try {
      published = await publishDraft(request.pendingId);
    } catch (error) {
      throw workflowFailure(errorMessage(error, "Unable to publish draft"), "");
    }
    revalidateTag("blog-posts", { expire: 0 });
    try {
      await sendBlogApprovalEmail({
        email: published.authorEmail,
        userId: published.authorId,
        pendingId: published.pendingId,
        title: published.title,
        locale: published.locale,
        slug: published.slug,
        message,
      });
      return { ...published, notificationSent: true };
    } catch (emailError) {
      console.error("Pending submission was published but approval notification failed", emailError);
      return { ...published, notificationSent: false };
    }
  },
};

export const adminService: ServiceImpl<typeof AdminService> = {
  async listPending(_request, context) {
    await requireAdmin(context);
    try {
      return { pending: (await listPendingReviews()).map(articleMessage) };
    } catch (error) {
      console.error("Unable to load pending reviews", error);
      throw apiFailure("Unable to load pending reviews", 500, "internal_error");
    }
  },

  async rejectPending(request, context) {
    const user = await requireAdmin(context);
    const reason = reasonOf(request.reason, "rejection");

    let rejection;
    try {
      rejection = await rejectDraft(user.sub, request.pendingId, reason);
    } catch (error) {
      throw workflowFailure(errorMessage(error, "Unable to reject pending submission"), "Draft not found", true);
    }
    let providerEmailId: string;
    try {
      providerEmailId = await sendBlogRejectionEmail({
        email: rejection.email,
        userId: rejection.authorId,
        pendingId: rejection.pendingId,
        title: rejection.title,
        locale: rejection.locale,
        slug: rejection.slug,
        reason: rejection.reason,
      });
    } catch (emailError) {
      const failure = emailError instanceof Error ? emailError.message : "Unknown email error";
      await recordRejectionNotification(rejection.rejectionId, { failure }).catch((auditError) =>
        console.error("Unable to record rejection notification failure", auditError)
      );
      console.error("Pending submission was rejected but notification failed", emailError);
      return { deleted: true, notificationSent: false };
    }
    await recordRejectionNotification(rejection.rejectionId, { providerEmailId }).catch((auditError) =>
      console.error("Email was sent but rejection status could not be updated", auditError)
    );
    return { deleted: true, notificationSent: true };
  },

  async forkPending(request, context) {
    const user = await requireAdmin(context);
    try {
      return { pendingId: await forkDraft(user.sub, request.pendingId) };
    } catch (error) {
      throw workflowFailure(errorMessage(error, "Unable to fork pending submission"), "Draft not found");
    }
  },

  async deleteArticle(request, context) {
    const user = await requireAdmin(context);
    const reason = reasonOf(request.reason, "deletion");

    let deleted;
    try {
      deleted = await deletePublishedArticle(user.sub, request.postId, reason);
    } catch (error) {
      throw workflowFailure(errorMessage(error, "Unable to delete article"), "Article not found", true);
    }
    revalidateTag("blog-posts", { expire: 0 });
    if (!deleted.authorId || !deleted.email) return { deleted: true };
    try {
      await sendBlogDeletionEmail({
        email: deleted.email,
        userId: deleted.authorId,
        postId: deleted.postId,
        title: deleted.title,
        locale: deleted.locale,
        slug: deleted.slug,
        reason: deleted.reason,
      });
      return { deleted: true, notificationSent: true };
    } catch (emailError) {
      console.error("Article was deleted but notification failed", emailError);
      return { deleted: true, notificationSent: false };
    }
  },

  async forkArticle(request, context) {
    const user = await requireAdmin(context);
    try {
      return { pendingId: await forkPublishedArticle(user.sub, request.postId) };
    } catch (error) {
      throw workflowFailure(errorMessage(error, "Unable to fork article"), "Article not found");
    }
  },
};
