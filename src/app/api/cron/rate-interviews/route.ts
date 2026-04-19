import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateAnswer } from "@/lib/claude";
import { sendRatingCompleteEmail } from "@/lib/mailer";

export const maxDuration = 60;

const RATING_LABELS: Array<[number, string]> = [
  [9, "Excellent"],
  [8, "Good"],
  [6, "Average"],
  [4, "Below Average"],
  [0, "Poor"],
];

function getRatingLabel(score: number): string {
  for (const [threshold, label] of RATING_LABELS) {
    if (score >= threshold) return label;
  }
  return "Poor";
}

export async function GET(req: NextRequest) {
  // Secure the cron endpoint
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find the oldest completed-but-unrated test
  const test = await prisma.test.findFirst({
    where: { status: "COMPLETED", overallScore: null },
    orderBy: { completedAt: "asc" },
    include: {
      questions: true,
      recruiter: { select: { email: true } },
      candidate: { select: { name: true } },
    },
  });

  if (!test) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  const ratings = await Promise.all(
    test.questions.map(async (q) => {
      const result = await rateAnswer(
        q.questionText,
        q.category,
        q.expectedSummary,
        q.transcript,
        q.codeResponse,
        test.level
      );
      await prisma.question.update({
        where: { id: q.id },
        data: { aiScore: result.score, aiRationale: result.rationale },
      });
      return result.score;
    })
  );

  const overallScore =
    Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
  const overallRating = getRatingLabel(overallScore);

  await prisma.test.update({
    where: { id: test.id },
    data: { overallScore, overallRating },
  });

  try {
    await sendRatingCompleteEmail(
      test.recruiter.email,
      test.candidate.name,
      overallRating,
      overallScore,
      test.id
    );
  } catch {
    // SMTP may not be configured
  }

  return NextResponse.json({ ok: true, processed: 1, testId: test.id, overallRating });
}
