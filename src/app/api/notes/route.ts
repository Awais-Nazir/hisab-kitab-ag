import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

export const dynamic = "force-dynamic";

const createNoteSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120, "Title is too long"),
  content: z.string().trim().min(1, "Content is required"),
  category: z.string().optional().default("General"),
  color: z.string().optional().default("emerald"),
  isPinned: z.boolean().optional().default(false),
  date: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const category = searchParams.get("category")?.trim();
  const pinnedOnly = searchParams.get("pinned") === "true";

  const whereClause: Record<string, any> = {
    ownerId: user.id,
  };

  if (pinnedOnly) {
    whereClause.isPinned = true;
  }

  if (category && category.toLowerCase() !== "all") {
    whereClause.category = { equals: category, mode: "insensitive" };
  }

  if (q) {
    whereClause.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { content: { contains: q, mode: "insensitive" } },
    ];
  }

  const notes = await prisma.note.findMany({
    where: whereClause,
    orderBy: [
      { isPinned: "desc" },
      { date: "desc" },
      { createdAt: "desc" },
    ],
  });

  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  try {
    const body = await req.json();
    const parsed = createNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { title, content, category, color, isPinned, date } = parsed.data;
    const noteDate = date ? new Date(date) : new Date();

    const note = await prisma.note.create({
      data: {
        ownerId: user.id,
        title,
        content,
        category: category || "General",
        color: color || "emerald",
        isPinned: Boolean(isPinned),
        date: isNaN(noteDate.getTime()) ? new Date() : noteDate,
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    console.error("Failed to create note:", err);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}
