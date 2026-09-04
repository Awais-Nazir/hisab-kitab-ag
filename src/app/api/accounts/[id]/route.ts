import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const updateAccountSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  type: z.enum(["CASH", "BANK", "WALLET", "UDHAR_KHATA"]).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const { id: accountId } = await params;

  const existing = await prisma.account.findUnique({
    where: { id: accountId },
  });

  if (!existing || existing.ownerId !== user.id) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, type, color, icon } = parsed.data;

  if (name && name !== existing.name) {
    const duplicate = await prisma.account.findUnique({
      where: { ownerId_name: { ownerId: user.id, name } },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "Another account with this name already exists" },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.account.update({
    where: { id: accountId },
    data: {
      ...(name ? { name } : {}),
      ...(type ? { type } : {}),
      ...(color !== undefined ? { color } : {}),
      ...(icon !== undefined ? { icon } : {}),
    },
  });

  return NextResponse.json({ account: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const { id: accountId } = await params;

  const existing = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      expenses: { take: 1 },
      transfersFrom: { take: 1 },
      transfersTo: { take: 1 },
      deposits: { take: 1 },
      settlements: { take: 1 },
    },
  });

  if (!existing || existing.ownerId !== user.id) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const hasHistory =
    existing.expenses.length > 0 ||
    existing.transfersFrom.length > 0 ||
    existing.transfersTo.length > 0 ||
    existing.deposits.length > 0 ||
    existing.settlements.length > 0;

  if (hasHistory) {
    return NextResponse.json(
      { error: "Cannot delete account with existing transactions. You can rename it instead." },
      { status: 400 }
    );
  }

  await prisma.account.delete({ where: { id: accountId } });
  return NextResponse.json({ success: true });
}
