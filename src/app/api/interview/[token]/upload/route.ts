import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadRecording } from "@/lib/minio";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const test = await prisma.test.findUnique({ where: { inviteToken: token } });
  if (!test || test.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Invalid or inactive interview" }, { status: 400 });
  }

  const formData = await req.formData();
  const questionId = formData.get("questionId") as string;
  const transcript = formData.get("transcript") as string | null;
  const codeResponse = formData.get("codeResponse") as string | null;
  const videoBlob = formData.get("video") as File | null;

  if (!questionId) return NextResponse.json({ error: "questionId required" }, { status: 400 });

  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question || question.testId !== test.id) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  let videoUrl: string | null = null;
  if (videoBlob && videoBlob.size > 0) {
    try {
      const buffer = Buffer.from(await videoBlob.arrayBuffer());
      await uploadRecording(test.id, questionId, buffer);
      videoUrl = `${test.id}/${questionId}.webm`;
    } catch {
      // MinIO may not be running in dev — continue without video
    }
  }

  await prisma.question.update({
    where: { id: questionId },
    data: {
      transcript: transcript ?? undefined,
      codeResponse: codeResponse ?? undefined,
      videoUrl: videoUrl ?? undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
