import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDailySummaryEmail } from "@/lib/sendEmail";
import { requireUser } from "@/lib/requireUser";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const secretParam = url.searchParams.get("secret");
  const force = url.searchParams.get("force") === "true" || url.searchParams.get("test") === "true";
  const authHeader = req.headers.get("authorization");

  const isSecretValid =
    (authHeader && authHeader === `Bearer ${process.env.CRON_SECRET}`) ||
    (secretParam && secretParam === process.env.CRON_SECRET);

  let targetUsers: Array<{
    id: string;
    email: string;
    name: string;
    currency: string;
    selfPersonId: string | null;
  }> = [];

  if (isSecretValid) {
    targetUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        currency: true,
        selfPersonId: true,
      },
    });
  } else {
    // If not authenticated via secret, check if caller is a logged in session user testing manually
    const { user } = await requireUser();
    if (user) {
      targetUsers = [
        {
          id: user.id,
          email: user.email,
          name: user.name,
          currency: user.currency || "PKR",
          selfPersonId: user.selfPersonId,
        },
      ];
    } else {
      return NextResponse.json(
        {
          error: "Unauthorized",
          hint: "Authenticate via Authorization: Bearer <CRON_SECRET>, ?secret=<CRON_SECRET>, or be logged in as a session user.",
        },
        { status: 401 }
      );
    }
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  let emailsSent = 0;
  const sentDetails: { email: string; personalTotal: number; sharedTotal: number }[] = [];

  for (const user of targetUsers) {
    if (!user.selfPersonId) continue;

    const personalExpenses = await prisma.expense.findMany({
      where: {
        ownerId: user.id,
        workspaceId: null,
        splits: { none: {} },
        payments: { none: {} },
        date: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        account: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    });
    const personalTotal = personalExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    const mySplitsToday = await prisma.expenseSplit.findMany({
      where: {
        personId: user.selfPersonId,
        expense: {
          date: { gte: startOfDay, lte: endOfDay },
        },
      },
      include: {
        expense: {
          include: {
            workspace: { select: { id: true, name: true } },
            account: { select: { id: true, name: true } },
            payments: {
              include: {
                person: { select: { id: true, name: true, isSelf: true } },
              },
            },
            splits: {
              include: {
                person: { select: { id: true, name: true, isSelf: true } },
              },
            },
          },
        },
      },
      orderBy: { expense: { date: "desc" } },
    });

    const workspaceMap = new Map<
      string,
      {
        workspaceName: string;
        total: number;
        expenses: Array<{
          id: string;
          description: string;
          workspaceName: string;
          totalAmount: number;
          myShare: number;
          category?: string | null;
          paidBy?: string;
          accountName?: string | null;
          splitCount?: number;
        }>;
      }
    >();

    for (const split of mySplitsToday) {
      const exp = split.expense;
      const wsName = exp.workspace?.name ?? "Shared Workspace";

      if (!workspaceMap.has(wsName)) {
        workspaceMap.set(wsName, {
          workspaceName: wsName,
          total: 0,
          expenses: [],
        });
      }

      const wsGroup = workspaceMap.get(wsName)!;
      const shareAmount = Number(split.shareAmount);
      wsGroup.total += shareAmount;

      let paidBy = "Workspace";
      if (exp.payments && exp.payments.length > 0) {
        const payers = exp.payments.map((p) =>
          p.person.id === user.selfPersonId || p.person.isSelf ? "You" : p.person.name
        );
        paidBy = payers.join(", ");
      }

      wsGroup.expenses.push({
        id: exp.id,
        description: exp.description,
        workspaceName: wsName,
        totalAmount: Number(exp.amount),
        myShare: shareAmount,
        category: exp.category,
        paidBy,
        accountName: exp.account?.name || null,
        splitCount: exp.splits ? exp.splits.length : 1,
      });
    }

    const workspaceSummaries = Array.from(workspaceMap.values());
    const sharedTotal = workspaceSummaries.reduce((s, w) => s + w.total, 0);

    if (personalTotal > 0 || workspaceSummaries.length > 0 || force) {
      await sendDailySummaryEmail(
        user.email,
        user.name,
        personalTotal,
        workspaceSummaries,
        {
          currency: user.currency || "PKR",
          personalExpenses: personalExpenses.map((e) => ({
            description: e.description,
            amount: Number(e.amount),
            category: e.category,
            accountName: e.account?.name || null,
          })),
        }
      );
      emailsSent++;
      sentDetails.push({ email: user.email, personalTotal, sharedTotal });
    }
  }

  return NextResponse.json({
    success: true,
    emailsSent,
    sentDetails,
    hint: "To test anytime with zero spending, add ?test=true (e.g. /api/cron/daily-summary?secret=...&test=true)",
  });
}