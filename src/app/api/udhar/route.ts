import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const createUdharSchema = z.object({
  type: z.enum(["LENA", "DENA"]), // LENA = Maine Diye (Receivable), DENA = Maine Liye (Payable)
  personId: z.string(),
  amount: z.number().positive(),
  accountId: z.string().optional(),
  note: z.string().optional(),
  date: z.string().optional(),
});

export async function GET() {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const entries = await prisma.udharEntry.findMany({
    where: { ownerId: user.id },
    include: {
      person: true,
      account: true,
      settleAccount: true,
    },
    orderBy: { date: "desc" },
  });

  // Calculate totals for unsettled records
  const unsettled = entries.filter((e) => !e.isSettled);

  let totalLena = 0;
  let totalDena = 0;

  // Group by person
  const personMap = new Map<string, { personId: string; name: string; totalLena: number; totalDena: number; netBalance: number; entries: typeof entries }>();

  for (const entry of entries) {
    const pId = entry.personId;
    if (!personMap.has(pId)) {
      personMap.set(pId, {
        personId: pId,
        name: entry.person.name,
        totalLena: 0,
        totalDena: 0,
        netBalance: 0,
        entries: [],
      });
    }
    const rec = personMap.get(pId)!;
    rec.entries.push(entry);

    if (!entry.isSettled) {
      const amt = Number(entry.amount);
      if (entry.type === "LENA") {
        totalLena += amt;
        rec.totalLena += amt;
      } else {
        totalDena += amt;
        rec.totalDena += amt;
      }
    }
  }

  // Calculate net balances per person
  const peopleSummary = Array.from(personMap.values()).map((p) => ({
    ...p,
    netBalance: p.totalLena - p.totalDena,
  }));

  return NextResponse.json({
    entries,
    peopleSummary,
    totalLena,
    totalDena,
    netBalance: totalLena - totalDena,
  });
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const body = await req.json();
  const parsed = createUdharSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { type, personId, amount, accountId, note, date } = parsed.data;

  const contact = await prisma.person.findUnique({
    where: { id: personId },
  });

  if (!contact || contact.ownerId !== user.id || contact.isSelf) {
    return NextResponse.json({ error: "Invalid contact" }, { status: 400 });
  }

  let verifiedAccountId: string | undefined = undefined;
  if (accountId) {
    const acc = await prisma.account.findUnique({ where: { id: accountId } });
    if (acc && acc.ownerId === user.id) {
      verifiedAccountId = acc.id;
    }
  }

  const entryDate = date ? new Date(date) : new Date();

  const result = await prisma.$transaction(async (tx) => {
    const entry = await tx.udharEntry.create({
      data: {
        ownerId: user.id,
        personId,
        type,
        amount,
        note: note ? note.trim() : undefined,
        accountId: verifiedAccountId,
        date: entryDate,
      },
      include: {
        person: true,
        account: true,
      },
    });

    if (verifiedAccountId) {
      if (type === "LENA") {
        // You gave cash/funds out of this account -> decrement
        await tx.account.update({
          where: { id: verifiedAccountId },
          data: { balance: { decrement: amount } },
        });
      } else {
        // You received borrowed cash/funds into this account -> increment
        await tx.account.update({
          where: { id: verifiedAccountId },
          data: { balance: { increment: amount } },
        });
      }
    }

    return entry;
  });

  return NextResponse.json({ entry: result }, { status: 201 });
}
