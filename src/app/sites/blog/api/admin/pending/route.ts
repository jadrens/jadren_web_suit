import { NextResponse } from "next/server";
import { editorUser, listPendingReviews } from "@shared/libs/blog/editor";

export async function GET(request: Request) {
  const user = await editorUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    return NextResponse.json({ pending: await listPendingReviews() });
  } catch (error) {
    console.error("Unable to load pending reviews", error);
    return NextResponse.json({ error: "Unable to load pending reviews" }, { status: 500 });
  }
}
