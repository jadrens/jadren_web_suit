import { NextResponse } from "next/server";
import {
  editorUser,
  listEditorArticles,
  parseArticleInput,
  saveDraft,
} from "@lib/publishing/editor";

function message(error: unknown) {
  return error instanceof Error ? error.message : "Editor request failed";
}

export async function GET(request: Request) {
  const user = await editorUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({
      articles: await listEditorArticles(user.sub, user.isAdmin),
      isAdmin: user.isAdmin,
    });
  } catch (error) {
    console.error("Unable to list editor articles", error);
    return NextResponse.json({ error: "Unable to load articles" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await editorUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = parseArticleInput(await request.json());
    const pendingId = await saveDraft(user.sub, user.isAdmin, input);
    return NextResponse.json({ pendingId }, { status: 201 });
  } catch (error) {
    const detail = message(error);
    const status = detail.startsWith("Invalid") ? 400 : detail.endsWith("not found") ? 404 : 409;
    return NextResponse.json({ error: detail }, { status });
  }
}
