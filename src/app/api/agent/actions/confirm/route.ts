import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";

const API_URL = process.env.HISAB_AGENT_API_URL || "http://127.0.0.1:8000";
const SECRET = process.env.HISAB_AGENT_SECRET || "test-for-now";

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  try {
    const { action_id, session_id } = await req.json();

    if (!action_id) {
      return NextResponse.json(
        { error: "action_id is required" },
        { status: 400 }
      );
    }

    const cookie = req.headers.get("cookie");
    const token = req.cookies.get("token")?.value;

    const headers: Record<string, string> = {
      "X-Agent-Secret": SECRET,
      "Cookie": cookie ?? "",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    if (user?.id) {
      headers["X-User-Id"] = user.id;
    }

    const url = new URL(`${API_URL}/actions/${action_id}/confirm`);
    if (session_id) {
      url.searchParams.set("session_id", session_id);
    }

    const res = await fetch(url.toString(), {
      method: "POST",
      headers,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error("Error confirming agent action:", err);
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
