import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WASSIST_API_URL = "https://backend.wassist.app";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const apiKey = process.env.WASSIST_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "WhatsApp integration is not available" },
      { status: 503 }
    );
  }

  const { id } = params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json(
      { error: "Invalid conversation ID format" },
      { status: 400 }
    );
  }

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
