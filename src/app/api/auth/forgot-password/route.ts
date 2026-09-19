import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/sendEmail";

export const dynamic = "force-dynamic";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address").toLowerCase().trim(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid email" },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    // To prevent account enumeration, return success even if user is not found
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "If an account with that email exists, a password reset link has been sent.",
      });
    }

    // Delete existing reset tokens for this user to ensure only latest token is active
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    // Generate secure 32-byte (64 hex characters) random token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity

    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    // Resolve base origin URL
    const originHeader = req.headers.get("origin");
    const hostHeader = req.headers.get("host");
    const protocol = req.headers.get("x-forwarded-proto") || (hostHeader?.includes("localhost") ? "http" : "https");
    const baseUrl = originHeader || (hostHeader ? `${protocol}://${hostHeader}` : process.env.NEXTAUTH_URL || "http://localhost:3000");

    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // Send email via SendGrid
    await sendPasswordResetEmail(user.email, user.name, resetUrl);

    return NextResponse.json({
      success: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 }
    );
  }
}
