import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendInterviewInvite } from "@/lib/mailer";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const test = await prisma.test.findUnique({
    where: { id },
    include: { candidate: true, questions: true },
  });

  if (!test) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.user.role !== "ADMIN" && test.recruiterId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (test.status !== "QUESTIONS_PENDING") {
    return NextResponse.json({ error: "Test is not in review state" }, { status: 400 });
  }

  const body = await req.json();
  const { edits } = body as { edits: Record<string, string> };

  // Save any edited question text
  await Promise.all(
    Object.entries(edits ?? {}).map(([questionId, newText]) => {
      const original = test.questions.find((q) => q.id === questionId);
      if (!original || original.questionText === newText) return Promise.resolve();
      return prisma.question.update({
        where: { id: questionId },
        data: { questionText: newText, isModified: true },
      });
    })
  );

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.test.update({
    where: { id },
    data: { status: "INVITED", inviteExpiresAt: expiresAt },
  });

  await sendInterviewInvite(
    test.candidate.name,
    test.candidate.email,
    test.jobTitle,
    test.inviteToken
  );

  return NextResponse.json({ ok: true });
}
