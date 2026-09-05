import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const updateCategorySchema = z.object({
  name: z.string().min(1).max(40).optional(),
  budget: z.number().positive().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const { id: paramId } = await params;
  const decodedId = decodeURIComponent(paramId).trim();
  const queryName = req.nextUrl.searchParams.get("name")?.trim();

  // Find category by ID or case-insensitive name
  const existing = await prisma.category.findFirst({
    where: {
      ownerId: user.id,
      OR: [
        { id: decodedId },
        { name: { equals: decodedId, mode: "insensitive" as const } },
        ...(queryName ? [{ name: { equals: queryName, mode: "insensitive" as const } }] : []),
      ],
    },
  });

  const categoryName = existing
    ? existing.name
    : queryName || (decodedId.startsWith("def-") ? "" : decodedId);

  if (!categoryName) {
    return NextResponse.json({
      categoryName: "",
      category: null,
      expenses: [],
      totalSpent: 0,
      count: 0,
    });
  }

  const isSharedCategory = categoryName.toLowerCase().trim() === "shared";
  const isOtherCategory = categoryName.toLowerCase().trim() === "other";

  // Fetch personal expenses for this category
  const personalExpenses = await prisma.expense.findMany({
    where: {
      ownerId: user.id,
      ...(isOtherCategory
        ? {
            OR: [
              { category: { equals: "Other", mode: "insensitive" as const } },
              { category: null },
              { category: "" },
            ],
          }
        : isSharedCategory
        ? {
            category: { equals: "Shared", mode: "insensitive" as const },
          }
        : {
            category: {
              equals: categoryName,
              mode: "insensitive" as const,
            },
          }),
    },
    include: {
      account: { select: { id: true, name: true, color: true } },
    },
    orderBy: { date: "desc" },
  });

  // Also include shared splits for this category if user has a selfPersonId
  let sharedExpenses: Array<{
    id: string;
    amount: number;
    description: string;
    category: string | null;
    date: Date;
    account: { id: string; name: string; color: string | null } | null;
  }> = [];

  if (user.selfPersonId) {
    const splits = await prisma.expenseSplit.findMany({
      where: {
        personId: user.selfPersonId,
        expense: isSharedCategory
          ? {
              OR: [
                { category: { equals: "Shared", mode: "insensitive" as const } },
                { category: null },
                { category: "" },
              ],
            }
          : {
              category: {
                equals: categoryName,
                mode: "insensitive" as const,
              },
            },
      },
      include: {
        expense: {
          include: {
            account: { select: { id: true, name: true, color: true } },
            workspace: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { expense: { date: "desc" } },
    });

    sharedExpenses = splits.map((s) => ({
      id: s.expense.id,
      amount: Number(s.shareAmount),
      description: `${s.expense.description} (${s.expense.workspace?.name || "Shared Split"})`,
      category: s.expense.category || "Shared",
      date: s.expense.date,
      account: s.expense.account,
    }));
  }

  const allExpenses = [...personalExpenses, ...sharedExpenses].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const totalSpent = allExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return NextResponse.json({
    categoryName,
    category: existing,
    expenses: allExpenses,
    totalSpent,
    count: allExpenses.length,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const { id: paramId } = await params;
  const decodedId = decodeURIComponent(paramId).trim();
  const queryName = req.nextUrl.searchParams.get("name")?.trim();

  const body = await req.json();
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Find existing by ID or by name
  let existing = await prisma.category.findFirst({
    where: {
      ownerId: user.id,
      OR: [
        { id: decodedId },
        { name: { equals: decodedId, mode: "insensitive" as const } },
        ...(queryName ? [{ name: { equals: queryName, mode: "insensitive" as const } }] : []),
      ],
    },
  });

  const { name: newName, budget, color, icon } = parsed.data;

  if (!existing) {
    // If category record doesn't exist yet, create it
    const created = await prisma.category.create({
      data: {
        ownerId: user.id,
        name: newName || queryName || decodedId,
        budget: budget ?? 1000,
        color: color ?? "#0F5C53",
        icon: icon ?? "tag",
      },
    });
    return NextResponse.json({ category: created });
  }

  const oldName = existing.name;

  const updated = await prisma.$transaction(async (tx) => {
    if (newName && newName.toLowerCase().trim() !== oldName.toLowerCase().trim()) {
      // Check if target name already exists
      const conflict = await tx.category.findUnique({
        where: { ownerId_name: { ownerId: user.id, name: newName } },
      });
      if (conflict && conflict.id !== existing.id) {
        throw new Error("A category with this name already exists");
      }

      // Update all personal expenses with the old name
      await tx.expense.updateMany({
        where: { ownerId: user.id, category: oldName },
        data: { category: newName },
      });
    }

    return await tx.category.update({
      where: { id: existing.id },
      data: {
        name: newName ?? existing.name,
        budget: budget ?? existing.budget,
        color: color ?? existing.color,
        icon: icon ?? existing.icon,
      },
    });
  });

  return NextResponse.json({ category: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const { id: paramId } = await params;
  const decodedId = decodeURIComponent(paramId).trim();
  const queryName = req.nextUrl.searchParams.get("name")?.trim();

  const existing = await prisma.category.findFirst({
    where: {
      ownerId: user.id,
      OR: [
        { id: decodedId },
        { name: { equals: decodedId, mode: "insensitive" as const } },
        ...(queryName ? [{ name: { equals: queryName, mode: "insensitive" as const } }] : []),
      ],
    },
  });

  const categoryName = existing ? existing.name : (queryName || decodedId);

  // Check if any expenses are logged under this category (personal or shared splits)
  const personalCount = await prisma.expense.count({
    where: {
      ownerId: user.id,
      category: {
        equals: categoryName,
        mode: "insensitive" as const,
      },
    },
  });

  const sharedCount = user.selfPersonId
    ? await prisma.expenseSplit.count({
        where: {
          personId: user.selfPersonId,
          expense: {
            category: {
              equals: categoryName,
              mode: "insensitive" as const,
            },
          },
        },
      })
    : 0;

  const totalExpenseCount = personalCount + sharedCount;

  if (totalExpenseCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete "${categoryName}" because ${totalExpenseCount} expense(s) are logged under it.` },
      { status: 400 }
    );
  }

  // Delete category from database
  await prisma.category.deleteMany({
    where: {
      ownerId: user.id,
      OR: [
        { id: decodedId },
        { name: { equals: categoryName, mode: "insensitive" as const } },
        ...(existing ? [{ id: existing.id }] : []),
      ],
    },
  });

  return NextResponse.json({ success: true, deleted: categoryName });
}
