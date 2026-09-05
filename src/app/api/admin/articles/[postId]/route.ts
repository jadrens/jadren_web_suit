import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { deletePublishedArticle, editorUser } from "@lib/publishing/editor";
import { sendBlogDeletionEmail } from "@lib/auth/mailer";

interface Props {
  params: Promise<{ postId: string }>;
}

export async function DELETE(request: Request, { params }: Props) {
  const user = await editorUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { postId } = await params;
  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason || reason.length > 2000) {
    return NextResponse.json({ error: "A deletion reason between 1 and 2000 characters is required" }, { status: 400 });
  }

  try {
    const deleted = await deletePublishedArticle(user.sub, postId, reason);
    revalidateTag("blog-posts", { expire: 0 });
    if (!deleted.authorId || !deleted.email) {
      return NextResponse.json({ deleted: true, notificationSent: null });
    }
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
      return NextResponse.json({ deleted: true, notificationSent: true });
    } catch (emailError) {
      console.error("Article was deleted but notification failed", emailError);
      return NextResponse.json({ deleted: true, notificationSent: false });
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to delete article";
    const status = detail === "Article not found" ? 404 : detail.startsWith("Invalid") ? 400 : 409;
    return NextResponse.json({ error: detail }, { status });
  }
}
