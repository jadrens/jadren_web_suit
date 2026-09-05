import { NextResponse } from "next/server";
import {
  editorUser,
  getEditorArticleContent,
} from "@lib/publishing/editor";

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(request: Request) {
  const user = await editorUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const pendingId = params.get("pendingId");
  const postId = params.get("postId");
  if (
    (pendingId && !UUID.test(pendingId)) ||
    (postId && !UUID.test(postId)) ||
    (!pendingId && !postId)
  ) {
    return NextResponse.json({ error: "A valid article ID is required" }, { status: 400 });
  }

  const content = await getEditorArticleContent(
    user.sub,
    user.isAdmin,
    pendingId,
    pendingId ? null : postId
  );
  if (content === null) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }
  return NextResponse.json({ content });
}
