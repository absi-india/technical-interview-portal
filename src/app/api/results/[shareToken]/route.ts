import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRecordingUrl } from "@/lib/minio";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const { shareToken } = await params;
  const test = await prisma.test.findUnique({
    where: { shareToken },
    include: {
      candidate: { select: { name: true, email: true } },
      questions: { orderBy: { order: "asc" } },
      fraudEvents: { orderBy: { occurredAt: "asc" } },
    },
  });

  if (!test) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const questions = await Promise.all(
    test.questions.map(async (q) => {
      let videoUrl: string | null = null;
      if (q.videoUrl) {
        try {
          videoUrl = await getRecordingUrl(test.id, q.id);
        } catch {
          videoUrl = null;
        }
      }
      return { ...q, presignedVideoUrl: videoUrl };
    })
  );

  return NextResponse.json({ test: { ...test, questions } });
}
