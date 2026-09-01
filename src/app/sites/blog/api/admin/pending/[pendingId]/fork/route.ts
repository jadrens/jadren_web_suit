import { NextResponse } from "next/server";
import { editorUser, forkDraft } from "@shared/libs/blog/editor";

interface Props {
  params: Promise<{ pendingId: string }>;
}

export async function POST(request: Request, { params }: Props) {
  const user = await editorUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { pendingId } = await params;
  try {
    return NextResponse.json({ pendingId: await forkDraft(user.sub, pendingId) }, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to fork pending submission";
    return NextResponse.json({ error: detail }, { status: detail === "Draft not found" ? 404 : 409 });
  }
}
