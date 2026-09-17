import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";
import { reconcileAccount } from "@/lib/account-balance";

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") || "all"; // "all" | "personal" | workspaceId
  const accountId = url.searchParams.get("accountId") || "all";
  const category = url.searchParams.get("category") || "all";
  const payer = url.searchParams.get("payer") || "all"; // "all" | "me" | "others"
  const search = url.searchParams.get("search")?.trim().toLowerCase() || "";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  // Determine user's selfPersonId
  const selfPersonId = user.selfPersonId;

  // Base where clauses
  const where: any = {};

  // Scope filtering (personal vs shared vs workspace)
  if (scope === "personal") {
    where.ownerId = user.id;
    where.workspaceId = null;
    where.splits = { none: {} };
    where.payments = { none: {} };
  } else if (scope === "shared") {
    where.OR = [
      { workspaceId: { not: null } },
      { splits: { some: {} } },
      { payments: { some: {} } },
    ];
  } else if (scope !== "all") {
    where.workspaceId = scope;
    where.OR = [
      { workspace: { ownerId: user.id } },
      { workspace: { members: { some: { personId: selfPersonId || "" } } } },
    ];
  } else {
    // All: User is owner OR user is workspace member OR user is participant in splits/payments
    where.OR = [
      { ownerId: user.id },
      ...(selfPersonId
        ? [
            { workspace: { members: { some: { personId: selfPersonId } } } },
            { splits: { some: { personId: selfPersonId } } },
            { payments: { some: { personId: selfPersonId } } },
          ]
        : []),
    ];
  }

  // Account filter
  if (accountId && accountId !== "all") {
    where.accountId = accountId;
  }

  // Category filter
  if (category && category !== "all") {
    where.category = category;
  }

  // Date range filter
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      where.date.lte = toDate;
    }
  }

  // Fetch expenses
  const rawExpenses = await prisma.expense.findMany({
    where,
    include: {
      workspace: { select: { id: true, name: true } },
      account: { select: { id: true, name: true, type: true, color: true, icon: true } },
      splits: {
        include: {
          person: { select: { id: true, name: true, isSelf: true } },
        },
      },
      payments: {
        include: {
          person: { select: { id: true, name: true, isSelf: true } },
        },
      },
    },
    orderBy: { date: "desc" },
  });

  // Post-process computed fields & payer/search filtering
  const processed = rawExpenses.map((exp) => {
    const isPersonal = exp.workspaceId === null && exp.splits.length === 0 && exp.payments.length === 0;
    const amountNum = Number(exp.amount);

    // Compute user's share
    let userShare = 0;
    if (isPersonal) {
      userShare = amountNum;
    } else if (exp.splits.length > 0) {
      const mySplit = exp.splits.find(
        (s) => s.person?.isSelf || s.personId === selfPersonId
      );
      userShare = mySplit ? Number(mySplit.shareAmount) : 0;
    }

    // Compute who paid
    let userPaid = 0;
    const paidBy: { personId: string; name: string; amount: number; isSelf: boolean }[] = [];

    if (isPersonal) {
      userPaid = amountNum;
      paidBy.push({
        personId: selfPersonId || "self",
        name: "You",
        amount: amountNum,
        isSelf: true,
      });
    } else if (exp.payments.length > 0) {
      for (const p of exp.payments) {
        const isSelf = Boolean(p.person?.isSelf || p.personId === selfPersonId);
        const pAmount = Number(p.amountPaid);
        if (isSelf) {
          userPaid += pAmount;
        }
        paidBy.push({
          personId: p.personId,
          name: isSelf ? "You" : p.person?.name || "Unknown",
          amount: pAmount,
          isSelf,
        });
      }
    }

    const splitWith = exp.splits.map((s) => ({
      personId: s.personId,
      name: Boolean(s.person?.isSelf || s.personId === selfPersonId)
        ? "You"
        : s.person?.name || "Unknown",
      amount: Number(s.shareAmount),
      isSelf: Boolean(s.person?.isSelf || s.personId === selfPersonId),
    }));

    return {
      id: exp.id,
      amount: amountNum,
      description: exp.description,
      category: exp.category,
      date: exp.date.toISOString(),
      createdAt: exp.createdAt.toISOString(),
      isPersonal,
      workspaceId: exp.workspaceId,
      workspaceName: exp.workspace?.name || null,
      account: exp.account,
      userShare,
      userPaid,
      paidBy,
      splitWith,
    };
  });

  // Apply payer filter in-memory if requested
  let filtered = processed;
  if (payer === "me") {
    filtered = filtered.filter((exp) => exp.userPaid > 0);
  } else if (payer === "others") {
    filtered = filtered.filter((exp) => exp.userPaid === 0);
  }

  // Apply search query in-memory if requested
  if (search) {
    filtered = filtered.filter(
      (exp) =>
        exp.description.toLowerCase().includes(search) ||
        (exp.category && exp.category.toLowerCase().includes(search)) ||
        (exp.workspaceName && exp.workspaceName.toLowerCase().includes(search)) ||
        (exp.account && exp.account.name.toLowerCase().includes(search)) ||
        exp.paidBy.some((p) => p.name.toLowerCase().includes(search))
    );
  }

  // Calculate totals
  const totalAmount = filtered.reduce((sum, e) => sum + e.amount, 0);
  const totalUserShare = filtered.reduce((sum, e) => sum + e.userShare, 0);
  const totalUserPaid = filtered.reduce((sum, e) => sum + e.userPaid, 0);

  // Collect distinct categories, workspaces, accounts for filter dropdowns
  const [categories, workspaces, accounts] = await Promise.all([
    prisma.category.findMany({
      where: { ownerId: user.id },
      select: { id: true, name: true, icon: true, color: true },
      orderBy: { name: "asc" },
    }),
    prisma.workspace.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          ...(selfPersonId
            ? [{ members: { some: { personId: selfPersonId } } }]
            : []),
        ],
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.account.findMany({
      where: { ownerId: user.id },
      select: { id: true, name: true, type: true, color: true, icon: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    expenses: filtered,
    meta: {
      totalCount: filtered.length,
      totalAmount,
      totalUserShare,
      totalUserPaid,
      categories,
      workspaces,
      accounts,
    },
  });
}

const createShareEntrySchema = z.object({
  personId: z.string(),
  amount: z.number().nonnegative(),
});

const createExpenseSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1),
  category: z.string().optional(),
  accountId: z.string().nullable().optional(),
  date: z.string().optional(),
  isShared: z.boolean().optional().default(false),
  payments: z.array(createShareEntrySchema).optional(),
  splits: z.array(createShareEntrySchema).optional(),
});

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const body = await req.json();
  const parsed = createExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { amount, description, category, accountId, date, isShared, payments, splits } = parsed.data;

  // Validate account
  let targetAccountId: string | null = null;
  if (accountId) {
    const acc = await prisma.account.findUnique({ where: { id: accountId } });
    if (!acc || acc.ownerId !== user.id) {
      return NextResponse.json({ error: "Invalid account" }, { status: 400 });
    }
    targetAccountId = acc.id;
  }

  // If shared expense, validate sums
  if (isShared && splits && splits.length > 0) {
    const splitSum = splits.reduce((s, x) => s + x.amount, 0);
    if (Math.abs(splitSum - amount) > 0.05) {
      return NextResponse.json(
        { error: `Splits sum to ${splitSum.toFixed(2)} but expense is ${amount.toFixed(2)}` },
        { status: 400 }
      );
    }
  }
  if (isShared && payments && payments.length > 0) {
    const paymentSum = payments.reduce((s, x) => s + x.amount, 0);
    if (Math.abs(paymentSum - amount) > 0.05) {
      return NextResponse.json(
        { error: `Payments sum to ${paymentSum.toFixed(2)} but expense is ${amount.toFixed(2)}` },
        { status: 400 }
      );
    }
  }

  try {
    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          ownerId: user.id,
          amount,
          description,
          category,
          accountId: targetAccountId,
          date: date ? new Date(date) : new Date(),
          ...(isShared && splits && splits.length > 0
            ? { splits: { create: splits.map((s) => ({ personId: s.personId, shareAmount: s.amount })) } }
            : {}),
          ...(isShared && payments && payments.length > 0
            ? { payments: { create: payments.map((p) => ({ personId: p.personId, amountPaid: p.amount })) } }
            : {}),
        },
        include: {
          splits: { include: { person: true } },
          payments: { include: { person: true } },
          account: true,
        },
      });

      if (targetAccountId) {
        await reconcileAccount(targetAccountId, tx);
      }

      return created;
    });

    return NextResponse.json({ expense });
  } catch (err: any) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create expense" },
      { status: 400 }
    );
  }
}
