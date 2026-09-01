import { NextResponse } from "next/server";
import {
  editorUser,
  recordRejectionNotification,
  rejectDraft,
} from "@shared/libs/blog/editor";
import { sendBlogRejectionEmail } from "@shared/libs/auth/mailer";

interface Props {
  params: Promise<{ pendingId: string }>;
}

export async function DELETE(request: Request, { params }: Props) {
  const user = await editorUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { pendingId } = await params;
  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason || reason.length > 2000) {
    return NextResponse.json({ error: "A rejection reason between 1 and 2000 characters is required" }, { status: 400 });
  }

  try {
    const rejection = await rejectDraft(user.sub, pendingId, reason);
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
      return NextResponse.json({ deleted: true, notificationSent: false });
    }
    await recordRejectionNotification(rejection.rejectionId, { providerEmailId }).catch((auditError) =>
      console.error("Email was sent but rejection status could not be updated", auditError)
    );
    return NextResponse.json({ deleted: true, notificationSent: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to reject pending submission";
    const status = detail === "Draft not found" ? 404 : detail.startsWith("Invalid") ? 400 : 409;
    return NextResponse.json({ error: detail }, { status });
  }
}
