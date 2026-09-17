import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

function pairwiseDeltaForExpense(
  selfId: string,
  otherId: string,
  splits: { personId: string; shareAmount: number }[],
  payments: { personId: string; amountPaid: number }[],
  total: number
): number {
  if (total <= 0) return 0;
  let delta = 0;
  for (const split of splits) {
    for (const payment of payments) {
      if (split.personId === payment.personId) continue;
      const portion = split.shareAmount * (payment.amountPaid / total);
      if (portion <= 0.0001) continue;
      if (split.personId === selfId && payment.personId === otherId) {
        delta -= portion;
      } else if (payment.personId === selfId && split.personId === otherId) {
        delta += portion;
      }
    }
  }
  return delta;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;
  if (!user.selfPersonId) {
    return NextResponse.json({ error: "Account setup incomplete" }, { status: 500 });
  }

  const { id: personId } = await params;
  const person = await prisma.person.findUnique({ where: { id: personId } });
  if (!person || person.ownerId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Workspaces where person is member and user is owner or member
  const memberships = await prisma.workspaceMember.findMany({
    where: {
      personId,
      workspace: {
        OR: [
          { ownerId: user.id },
          { members: { some: { personId: user.selfPersonId } } },
        ],
      },
    },
    select: { workspaceId: true },
  });
  const workspaceIds = memberships.map((m) => m.workspaceId);

  const [rawExpenses, rawSettlements] = await Promise.all([
    prisma.expense.findMany({
      where: {
        OR: [
          { splits: { some: { personId } } },
          { payments: { some: { personId } } },
          ...(workspaceIds.length > 0 ? [{ workspaceId: { in: workspaceIds } }] : []),
        ],
      },
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
    }),
    prisma.settlement.findMany({
      where: {
        OR: [
          { fromPersonId: personId, toPersonId: user.selfPersonId },
          { fromPersonId: user.selfPersonId, toPersonId: personId },
        ],
      },
      include: {
        workspace: { select: { id: true, name: true } },
        account: { select: { id: true, name: true, type: true, color: true, icon: true } },
        fromPerson: { select: { id: true, name: true, isSelf: true } },
        toPerson: { select: { id: true, name: true, isSelf: true } },
      },
      orderBy: { date: "desc" },
    }),
  ]);

  const dayKey = (d: string | Date) => new Date(d).toISOString().slice(0, 10);

  // Group raw items into day buckets
  const daysMap: Record<
    string,
    {
      date: string;
      items: any[];
    }
  > = {};

  function getDayBucket(dStr: string) {
    if (!daysMap[dStr]) {
      daysMap[dStr] = {
        date: dStr,
        items: [],
      };
    }
    return daysMap[dStr];
  }

  let totalExpensesCount = 0;
  let totalSettlementsCount = 0;

  for (const e of rawExpenses) {
    const total = Number(e.amount);
    const splits = e.splits.map((s) => ({
      personId: s.personId,
      name: s.person?.name || "Unknown",
      isSelf: Boolean(s.person?.isSelf || s.personId === user.selfPersonId),
      shareAmount: Number(s.shareAmount),
    }));
    const payments = e.payments.map((p) => ({
      personId: p.personId,
      name: p.person?.name || "Unknown",
      isSelf: Boolean(p.person?.isSelf || p.personId === user.selfPersonId),
      amountPaid: Number(p.amountPaid),
    }));

    const delta = pairwiseDeltaForExpense(user.selfPersonId, personId, splits, payments, total);
    const personSplit = splits.find((s) => s.personId === personId);
    const personPayment = payments.find((p) => p.personId === personId);
    const selfSplit = splits.find((s) => s.personId === user.selfPersonId);
    const selfPayment = payments.find((p) => p.personId === user.selfPersonId);

    // Relevant if person paid, split, or has balance impact
    const isRelevant = personSplit || personPayment || Math.abs(delta) > 0.0001;
    if (!isRelevant) continue;

    totalExpensesCount++;
    const key = dayKey(e.date);
    const bucket = getDayBucket(key);

    bucket.items.push({
      type: "expense",
      id: e.id,
      description: e.description,
      category: e.category,
      date: e.date.toISOString(),
      workspace: e.workspace || { id: e.workspaceId, name: "Shared Workspace" },
      account: e.account || null,
      totalAmount: total,
      personShare: personSplit ? personSplit.shareAmount : 0,
      personPaid: personPayment ? personPayment.amountPaid : 0,
      selfShare: selfSplit ? selfSplit.shareAmount : 0,
      selfPaid: selfPayment ? selfPayment.amountPaid : 0,
      pairwiseDelta: Math.round(delta * 100) / 100,
      payments: payments.map((p) => ({
        personId: p.personId,
        name: p.isSelf ? "You" : p.name,
        amount: p.amountPaid,
        isSelf: p.isSelf,
      })),
      splits: splits.map((s) => ({
        personId: s.personId,
        name: s.isSelf ? "You" : s.name,
        amount: s.shareAmount,
        isSelf: s.isSelf,
      })),
    });
  }

  for (const s of rawSettlements) {
    const amount = Number(s.amount);
    let delta = 0;
    if (s.fromPersonId === personId && s.toPersonId === user.selfPersonId) {
      // Contact paid user -> debt owed by contact to user decreases
      delta = -amount;
    } else if (s.fromPersonId === user.selfPersonId && s.toPersonId === personId) {
      // User paid contact -> debt owed by user to contact cleared / contact owes user more
      delta = +amount;
    }

    totalSettlementsCount++;
    const key = dayKey(s.date);
    const bucket = getDayBucket(key);

    bucket.items.push({
      type: "settlement",
      id: s.id,
      date: s.date.toISOString(),
      workspace: s.workspace || { id: s.workspaceId, name: "Shared Workspace" },
      account: s.account || null,
      amount,
      fromPerson: {
        id: s.fromPerson.id,
        name: s.fromPerson.isSelf || s.fromPersonId === user.selfPersonId ? "You" : s.fromPerson.name,
        isSelf: Boolean(s.fromPerson.isSelf || s.fromPersonId === user.selfPersonId),
      },
      toPerson: {
        id: s.toPerson.id,
        name: s.toPerson.isSelf || s.toPersonId === user.selfPersonId ? "You" : s.toPerson.name,
        isSelf: Boolean(s.toPerson.isSelf || s.toPersonId === user.selfPersonId),
      },
      pairwiseDelta: Math.round(delta * 100) / 100,
      note: s.note,
    });
  }

  // Sort chronologically to compute cumulative running total & day breakdown
  const sortedDates = Object.keys(daysMap).sort();
  let running = 0;

  const chronological = sortedDates.map((day) => {
    const bucket = daysMap[day];
    const openingBalance = running;

    let dayExpenseDelta = 0;
    let dayExpenseLena = 0;
    let dayExpenseDena = 0;
    let daySettlementDelta = 0;
    let daySettledAmount = 0;

    for (const item of bucket.items) {
      if (item.type === "expense") {
        dayExpenseDelta += item.pairwiseDelta;
        if (item.pairwiseDelta > 0) {
          dayExpenseLena += item.pairwiseDelta;
        } else if (item.pairwiseDelta < 0) {
          dayExpenseDena += Math.abs(item.pairwiseDelta);
        }
      } else if (item.type === "settlement") {
        daySettlementDelta += item.pairwiseDelta;
        daySettledAmount += item.amount;
      }
    }

    const dayNetDelta = Math.round((dayExpenseDelta + daySettlementDelta) * 100) / 100;
    running = Math.round((running + dayNetDelta) * 100) / 100;
    const closingBalance = running;

    // Sort items within each day by time descending
    const items = [...bucket.items].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return {
      date: day,
      dayExpenseDelta: Math.round(dayExpenseDelta * 100) / 100,
      dayExpenseLena: Math.round(dayExpenseLena * 100) / 100,
      dayExpenseDena: Math.round(dayExpenseDena * 100) / 100,
      daySettlementDelta: Math.round(daySettlementDelta * 100) / 100,
      daySettledAmount: Math.round(daySettledAmount * 100) / 100,
      dayNetDelta,
      delta: dayNetDelta,
      openingBalance: Math.round(openingBalance * 100) / 100,
      closingBalance,
      runningTotal: closingBalance,
      isSettled: Math.abs(closingBalance) < 0.01,
      items,
    };
  });

  // Reverse chronological (newest days first) for UI
  const days = [...chronological].reverse();
  const total = chronological.length > 0 ? chronological[chronological.length - 1].runningTotal : 0;

  return NextResponse.json({
    personId,
    personName: person.name,
    total,
    totalExpensesCount,
    totalSettlementsCount,
    days,
  });
}
