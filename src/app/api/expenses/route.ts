import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

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

  // Scope filtering (personal vs workspace)
  if (scope === "personal") {
    where.ownerId = user.id;
    where.workspaceId = null;
  } else if (scope !== "all") {
    where.workspaceId = scope;
    where.OR = [
      { workspace: { ownerId: user.id } },
      { workspace: { members: { some: { personId: selfPersonId || "" } } } },
    ];
  } else {
    // All: Personal OR Workspaces where user is owner or member
    where.OR = [
      { ownerId: user.id, workspaceId: null },
      { workspace: { ownerId: user.id } },
      ...(selfPersonId
        ? [{ workspace: { members: { some: { personId: selfPersonId } } } }]
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
    const isPersonal = exp.workspaceId === null;
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
