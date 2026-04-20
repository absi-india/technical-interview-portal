import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { firebaseAdmin } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const { idToken, name } = await req.json();
    if (!idToken || !name?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify the Firebase ID token
    const decoded = await firebaseAdmin.verifyIdToken(idToken);
    const { uid, email } = decoded;
    if (!email) {
      return NextResponse.json({ error: "Firebase account has no email" }, { status: 400 });
    }

    // Prevent duplicate accounts
    const existing = await prisma.user.findFirst({
      where: { OR: [{ firebaseUid: uid }, { email }] },
    });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    await prisma.user.create({
      data: {
        firebaseUid: uid,
        email,
        name: name.trim(),
        role: "RECRUITER",
        isActive: true,
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
