import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WASSIST_API_URL = "https://backend.wassist.app";

export async function GET() {
  const apiKey = process.env.WASSIST_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "WASSIST_API_KEY is not configured" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${WASSIST_API_URL}/api/v1/conversations/`, {
      headers: { "X-API-Key": apiKey },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch conversations from messaging provider" },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 502 }
    );
  }
}
