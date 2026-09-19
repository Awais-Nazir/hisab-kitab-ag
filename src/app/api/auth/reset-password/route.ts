import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
});

// GET: Validate token before displaying reset form
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { valid: false, error: "Reset token is missing." },
      { status: 400 }
    );
  }

  try {
    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: {
        user: {
          select: { email: true, name: true },
        },
      },
    });

    if (!record) {
      return NextResponse.json(
        { valid: false, error: "Invalid password reset link. It may have already been used." },
        { status: 400 }
      );
    }

    if (new Date() > record.expiresAt) {
      // Clean up expired token
      await prisma.passwordResetToken.delete({ where: { token } }).catch(() => {});
      return NextResponse.json(
        { valid: false, error: "This password reset link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      email: record.user.email,
      name: record.user.name,
    });
  } catch (err) {
    console.error("Token verification error:", err);
    return NextResponse.json(
      { valid: false, error: "Failed to verify reset token." },
      { status: 500 }
    );
  }
}

// POST: Execute the password reset
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { token, password } = parsed.data;

    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
      select: { id: true, userId: true, expiresAt: true },
    });

    if (!record) {
      return NextResponse.json(
        { error: "Invalid password reset link. It may have already been used." },
        { status: 400 }
      );
    }

    if (new Date() > record.expiresAt) {
      await prisma.passwordResetToken.delete({ where: { token } }).catch(() => {});
      return NextResponse.json(
        { error: "This password reset link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Hash the new password
    const passwordHash = await hashPassword(password);

    // Atomically update password and delete all reset tokens for user
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { userId: record.userId },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Your password has been successfully reset. You can now log in with your new password.",
    });
  } catch (err) {
    console.error("Password reset error:", err);
    return NextResponse.json(
      { error: "Failed to reset password. Please try again later." },
      { status: 500 }
    );
  }
}
