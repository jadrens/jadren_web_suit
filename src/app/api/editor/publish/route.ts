import { NextResponse } from "next/server";
import { editorUser, publishDraft } from "@lib/publishing/editor";
import { revalidateTag } from "next/cache";
import { sendBlogApprovalEmail } from "@lib/auth/mailer";

export async function POST(request: Request) {
  const user = await editorUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Administrator approval is required" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (typeof body?.pendingId !== "string") {
    return NextResponse.json({ error: "pendingId is required" }, { status: 400 });
  }
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (message.length > 2000) {
    return NextResponse.json({ error: "Approval message must not exceed 2000 characters" }, { status: 400 });
  }
  try {
    const published = await publishDraft(body.pendingId);
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
      return NextResponse.json({ ...published, notificationSent: true });
    } catch (emailError) {
      console.error("Pending submission was published but approval notification failed", emailError);
      return NextResponse.json({ ...published, notificationSent: false });
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to publish draft";
    const status = detail.endsWith("not found") ? 404 : 409;
    return NextResponse.json({ error: detail }, { status });
  }
}
