import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

export interface SearchResultItem {
  id: string;
  category: "transaction" | "udhar" | "person" | "account" | "workspace";
  title: string;
  subtitle: string;
  amount?: number;
  badge?: string;
  url: string;
}

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const results: SearchResultItem[] = [];

  // Concurrently fetch matching entities
  const [expenses, udharList, people, accounts, workspaces] = await Promise.all([
    // 1. Expenses
    prisma.expense.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { workspace: { ownerId: user.id } },
          { workspace: { members: { some: { personId: user.selfPersonId || "" } } } },
        ],
        AND: [
          {
            OR: [
              { description: { contains: q, mode: "insensitive" } },
              { category: { contains: q, mode: "insensitive" } },
            ],
          },
        ],
      },
      include: {
        workspace: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
      },
      take: 5,
      orderBy: { date: "desc" },
    }),

    // 2. Udhar entries
    prisma.udharEntry.findMany({
      where: {
        ownerId: user.id,
        OR: [
          { person: { name: { contains: q, mode: "insensitive" } } },
          { note: { contains: q, mode: "insensitive" } },
        ],
      },
      include: {
        person: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
      },
      take: 4,
      orderBy: { date: "desc" },
    }),

    // 3. People / Contacts
    prisma.person.findMany({
      where: {
        ownerId: user.id,
        isSelf: false,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 4,
      orderBy: { name: "asc" },
    }),

    // 4. Accounts
    prisma.account.findMany({
      where: {
        ownerId: user.id,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { type: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 4,
      orderBy: { name: "asc" },
    }),

    // 5. Workspaces
    prisma.workspace.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { members: { some: { personId: user.selfPersonId || "" } } },
        ],
        name: { contains: q, mode: "insensitive" },
      },
      take: 4,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Format Expenses
  for (const exp of expenses) {
    results.push({
      id: `exp-${exp.id}`,
      category: "transaction",
      title: exp.description,
      subtitle: exp.workspace ? `Shared in ${exp.workspace.name}` : `Personal • ${exp.category || "General"}`,
      amount: Number(exp.amount),
      badge: exp.workspace ? exp.workspace.name : "Personal",
      url: exp.workspaceId ? `/workspaces/${exp.workspaceId}` : `/dashboard`,
    });
  }

  // Format Udhar
  for (const u of udharList) {
    const isLena = u.type === "LENA";
    results.push({
      id: `udh-${u.id}`,
      category: "udhar",
      title: `${isLena ? "Lena" : "Dena"} • ${u.person.name}`,
      subtitle: u.note ? u.note : (u.isSettled ? "Settled" : "Active Udhar Khata"),
      amount: Number(u.amount),
      badge: isLena ? "Lena Hai" : "Dena Hai",
      url: `/accounts?tab=udhar`,
    });
  }

  // Format People
  for (const p of people) {
    results.push({
      id: `per-${p.id}`,
      category: "person",
      title: p.name,
      subtitle: p.email || "Contact",
      badge: "Contact",
      url: `/people`,
    });
  }

  // Format Accounts
  for (const acc of accounts) {
    results.push({
      id: `acc-${acc.id}`,
      category: "account",
      title: acc.name,
      subtitle: `${acc.type} account`,
      amount: Number(acc.balance),
      badge: acc.type,
      url: `/accounts?accountId=${acc.id}`,
    });
  }

  // Format Workspaces
  for (const ws of workspaces) {
    results.push({
      id: `ws-${ws.id}`,
      category: "workspace",
      title: ws.name,
      subtitle: "Shared Workspace",
      badge: "Workspace",
      url: `/workspaces/${ws.id}`,
    });
  }

  return NextResponse.json({ results });
}
