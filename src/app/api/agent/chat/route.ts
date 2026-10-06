import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";

const API_URL = process.env.HISAB_AGENT_API_URL || "http://127.0.0.1:8000";
const SECRET = process.env.HISAB_AGENT_SECRET || "test-for-now";

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  try {
    const body = await req.json();

    if (!body || typeof body.message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const cookie = req.headers.get("cookie");
    const token = req.cookies.get("token")?.value;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Agent-Secret": SECRET,
      "Cookie": cookie ?? "",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const userId = user.id || user.email;
    if (userId) {
      headers["X-Hisab-User-Id"] = userId;
      headers["X-User-Id"] = userId;
    }

    const res = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: body.message,
        session_id: body.session_id ?? null,
      }),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error("Error communicating with AI agent backend:", err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          "Could not connect to Hisab AI Agent backend. Make sure FastAPI server is running.",
      },
      { status: 502 }
    );
  }
}
