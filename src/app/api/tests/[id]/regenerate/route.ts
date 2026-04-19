import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateQuestions } from "@/lib/claude";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const test = await prisma.test.findUnique({ where: { id } });

  if (!test) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.user.role !== "ADMIN" && test.recruiterId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (test.status !== "QUESTIONS_PENDING") {
    return NextResponse.json({ error: "Cannot regenerate after approval" }, { status: 400 });
  }

  const generated = await generateQuestions(test.level, test.jobTitle, test.jobDescription);

  // Delete old questions and create new ones
  await prisma.question.deleteMany({ where: { testId: id } });
  await prisma.question.createMany({
    data: generated.map((q) => ({
      testId: id,
      order: q.id,
      questionText: q.questionText,
      category: q.category,
      expectedSummary: q.expectedAnswerSummary,
      maxScore: q.maxScore,
      codeLanguageHint: q.codeLanguageHint ?? null,
    })),
  });

  return NextResponse.json({ ok: true });
}
