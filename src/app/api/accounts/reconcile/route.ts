import { NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { reconcileUserAccounts } from "@/lib/account-balance";

export async function POST() {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  try {
    const balances = await reconcileUserAccounts(user.id);
    return NextResponse.json({ success: true, balances });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to reconcile accounts" },
      { status: 500 }
    );
  }
}
