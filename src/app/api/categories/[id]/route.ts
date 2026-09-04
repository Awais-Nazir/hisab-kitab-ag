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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const { id: paramId } = await params;
  const body = await req.json();
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Find existing by ID or by name
  let existing = await prisma.category.findFirst({
    where: {
      ownerId: user.id,
      OR: [{ id: paramId }, { name: paramId }],
    },
  });

  const { name: newName, budget, color, icon } = parsed.data;

  if (!existing) {
    // If it's a default category being updated for the first time
    const created = await prisma.category.create({
      data: {
        ownerId: user.id,
        name: newName || paramId,
        budget: budget ?? 1000,
        color: color ?? "#0F5C53",
        icon: icon ?? "tag",
      },
    });
    return NextResponse.json({ category: created });
  }

  const oldName = existing.name;

  const updated = await prisma.$transaction(async (tx) => {
    if (newName && newName !== oldName) {
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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const { id: paramId } = await params;

  const existing = await prisma.category.findFirst({
    where: {
      ownerId: user.id,
      OR: [{ id: paramId }, { name: paramId }],
    },
  });

  const categoryName = existing ? existing.name : paramId;

  // Check if any expenses are logged under this category
  const personalCount = await prisma.expense.count({
    where: {
      ownerId: user.id,
      category: categoryName,
    },
  });

  if (personalCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete "${categoryName}" because ${personalCount} expense(s) are logged under it.` },
      { status: 400 }
    );
  }

  if (existing) {
    await prisma.category.delete({
      where: { id: existing.id },
    });
  }

  return NextResponse.json({ success: true, deleted: categoryName });
}
