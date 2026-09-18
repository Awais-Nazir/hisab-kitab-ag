import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

export const dynamic = "force-dynamic";

const updateNoteSchema = z.object({
  title: z.string().trim().min(1, "Title cannot be empty").max(120, "Title is too long").optional(),
  content: z.string().trim().min(1, "Content cannot be empty").optional(),
  category: z.string().optional(),
  color: z.string().optional(),
  isPinned: z.boolean().optional(),
  date: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const { id } = await params;
  const note = await prisma.note.findFirst({
    where: { id, ownerId: user.id },
  });

  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return NextResponse.json({ note });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const { id } = await params;
  const existing = await prisma.note.findFirst({
    where: { id, ownerId: user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = updateNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const dataToUpdate: Record<string, any> = {};
    if (parsed.data.title !== undefined) dataToUpdate.title = parsed.data.title;
    if (parsed.data.content !== undefined) dataToUpdate.content = parsed.data.content;
    if (parsed.data.category !== undefined) dataToUpdate.category = parsed.data.category;
    if (parsed.data.color !== undefined) dataToUpdate.color = parsed.data.color;
    if (parsed.data.isPinned !== undefined) dataToUpdate.isPinned = parsed.data.isPinned;
    if (parsed.data.date !== undefined) {
      const parsedDate = new Date(parsed.data.date);
      if (!isNaN(parsedDate.getTime())) {
        dataToUpdate.date = parsedDate;
      }
    }

    const note = await prisma.note.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({ note });
  } catch (err) {
    console.error("Failed to update note:", err);
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const { id } = await params;
  const existing = await prisma.note.findFirst({
    where: { id, ownerId: user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  try {
    await prisma.note.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete note:", err);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
