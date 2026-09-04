import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const depositSchema = z.object({
  amount: z.number().positive(),
  source: z.string().default("Salary"), // Salary, Freelance, Gift, Deposit, Profit, Other
  note: z.string().optional(),
  date: z.string().optional(),
});

export async function POST(
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

  const body = await req.json();
  const parsed = depositSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { amount, source, note, date } = parsed.data;

  const depositDate = date ? new Date(date) : new Date();

  const [deposit, updatedAccount] = await prisma.$transaction([
    prisma.accountDeposit.create({
      data: {
        ownerId: user.id,
        accountId,
        amount,
        source,
        note,
        date: depositDate,
      },
    }),
    prisma.account.update({
      where: { id: accountId },
      data: {
        balance: { increment: amount },
      },
    }),
  ]);

  return NextResponse.json({ deposit, account: updatedAccount }, { status: 201 });
}
