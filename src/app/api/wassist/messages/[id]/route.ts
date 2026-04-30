import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WASSIST_API_URL = "https://backend.wassist.app";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const apiKey = process.env.WASSIST_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "WASSIST_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const { id } = params;

  try {
    const res = await fetch(
      `${WASSIST_API_URL}/api/v1/conversations/${id}/messages/?limit=100`,
      { headers: { "X-API-Key": apiKey } }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `Wassist API error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
