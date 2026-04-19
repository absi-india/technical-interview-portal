import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where = session.user.role === "ADMIN" ? {} : { recruiterId: session.user.id };
  const candidates = await prisma.candidate.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      tests: { select: { id: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return NextResponse.json({ candidates });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, email, phone } = body;

  if (!name || !email || !phone) {
    return NextResponse.json({ error: "Name, email and phone are required" }, { status: 400 });
  }

  const candidate = await prisma.candidate.create({
    data: { name, email, phone, recruiterId: session.user.id },
  });

  return NextResponse.json({ candidate }, { status: 201 });
}
