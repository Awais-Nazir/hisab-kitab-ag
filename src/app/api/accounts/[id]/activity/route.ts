import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

export interface AccountActivityItem {
  id: string;
  type: "DEPOSIT" | "EXPENSE" | "TRANSFER_IN" | "TRANSFER_OUT" | "SETTLEMENT_IN" | "SETTLEMENT_OUT";
  direction: "IN" | "OUT";
  amount: number;
  title: string;
  category?: string | null;
  note?: string | null;
  date: string;
  createdAt: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const { id: accountId } = await params;

  const account = await prisma.account.findUnique({
    where: { id: accountId },
  });

  if (!account || account.ownerId !== user.id) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const [deposits, expenses, transfersFrom, transfersTo, settlements, udharOrig, udharSettled] = await Promise.all([
    prisma.accountDeposit.findMany({
      where: { accountId, ownerId: user.id },
      orderBy: { date: "desc" },
    }),
    prisma.expense.findMany({
      where: { accountId },
      include: {
        payments: {
          where: { personId: user.selfPersonId || "" },
        },
      },
      orderBy: { date: "desc" },
    }),
    prisma.accountTransfer.findMany({
      where: { fromAccountId: accountId, ownerId: user.id },
      include: { toAccount: true },
      orderBy: { date: "desc" },
    }),
    prisma.accountTransfer.findMany({
      where: { toAccountId: accountId, ownerId: user.id },
      include: { fromAccount: true },
      orderBy: { date: "desc" },
    }),
    prisma.settlement.findMany({
      where: { accountId },
      include: {
        fromPerson: true,
        toPerson: true,
      },
      orderBy: { date: "desc" },
    }),
    prisma.udharEntry.findMany({
      where: { accountId, ownerId: user.id },
      include: { person: true },
      orderBy: { date: "desc" },
    }),
    prisma.udharEntry.findMany({
      where: { settleAccountId: accountId, ownerId: user.id },
      include: { person: true },
      orderBy: { settledAt: "desc" },
    }),
  ]);

  const items: AccountActivityItem[] = [];

  // 1. Deposits
  for (const dep of deposits) {
    items.push({
      id: `dep_${dep.id}`,
      type: "DEPOSIT",
      direction: "IN",
      amount: Number(dep.amount),
      title: dep.source || "Direct Deposit",
      category: dep.source,
      note: dep.note,
      date: dep.date.toISOString(),
      createdAt: dep.createdAt.toISOString(),
    });
  }

  // 2. Expenses
  for (const exp of expenses) {
    let paidAmt = Number(exp.amount);
    // If it's a shared expense with payments, find what user paid
    if (exp.payments && exp.payments.length > 0) {
      paidAmt = Number(exp.payments[0].amountPaid);
    }
    items.push({
      id: `exp_${exp.id}`,
      type: "EXPENSE",
      direction: "OUT",
      amount: paidAmt,
      title: exp.description,
      category: exp.category,
      note: null,
      date: exp.date.toISOString(),
      createdAt: exp.createdAt.toISOString(),
    });
  }

  // 3. Transfers Out
  for (const t of transfersFrom) {
    items.push({
      id: `tout_${t.id}`,
      type: "TRANSFER_OUT",
      direction: "OUT",
      amount: Number(t.amount),
      title: `Transfer to ${t.toAccount.name}`,
      category: "Transfer",
      note: t.note,
      date: t.date.toISOString(),
      createdAt: t.createdAt.toISOString(),
    });
  }

  // 4. Transfers In
  for (const t of transfersTo) {
    items.push({
      id: `tin_${t.id}`,
      type: "TRANSFER_IN",
      direction: "IN",
      amount: Number(t.amount),
      title: `Transfer from ${t.fromAccount.name}`,
      category: "Transfer",
      note: t.note,
      date: t.date.toISOString(),
      createdAt: t.createdAt.toISOString(),
    });
  }

  // 5. Settlements
  for (const s of settlements) {
    const isReceiving = s.toPersonId === user.selfPersonId;
    items.push({
      id: `set_${s.id}`,
      type: isReceiving ? "SETTLEMENT_IN" : "SETTLEMENT_OUT",
      direction: isReceiving ? "IN" : "OUT",
      amount: Number(s.amount),
      title: isReceiving
        ? `Settlement from ${s.fromPerson.name}`
        : `Settlement to ${s.toPerson.name}`,
      category: "Settlement",
      note: s.note,
      date: s.date.toISOString(),
      createdAt: s.date.toISOString(),
    });
  }

  // 6. Udhar Created from this account
  for (const u of udharOrig) {
    const isGiven = u.type === "LENA"; // user gave money out
    items.push({
      id: `u_${u.id}`,
      type: isGiven ? "TRANSFER_OUT" : "TRANSFER_IN",
      direction: isGiven ? "OUT" : "IN",
      amount: Number(u.amount),
      title: isGiven ? `Udhar given to ${u.person.name}` : `Udhar taken from ${u.person.name}`,
      category: "Udhar Khata",
      note: u.note,
      date: u.date.toISOString(),
      createdAt: u.createdAt.toISOString(),
    });
  }

  // 7. Udhar Settled into/from this account
  for (const us of udharSettled) {
    const isLena = us.type === "LENA"; // user received their loaned money back -> IN
    items.push({
      id: `us_${us.id}`,
      type: isLena ? "SETTLEMENT_IN" : "SETTLEMENT_OUT",
      direction: isLena ? "IN" : "OUT",
      amount: Number(us.amount),
      title: isLena ? `Udhar returned by ${us.person.name}` : `Udhar paid to ${us.person.name}`,
      category: "Udhar Settlement",
      note: us.note,
      date: (us.settledAt || us.date).toISOString(),
      createdAt: (us.settledAt || us.date).toISOString(),
    });
  }

  // Sort all items by date descending
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({
    account,
    activities: items,
  });
}
