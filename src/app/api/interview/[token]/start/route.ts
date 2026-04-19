import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const test = await prisma.test.findUnique({ where: { inviteToken: token } });

  if (!test) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  if (test.status === "COMPLETED") return NextResponse.json({ error: "Already completed" }, { status: 409 });
  if (test.inviteExpiresAt && test.inviteExpiresAt < new Date()) {
    return NextResponse.json({ error: "Link expired" }, { status: 410 });
  }

  if (test.status === "INVITED") {
    await prisma.test.update({
      where: { id: test.id },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
