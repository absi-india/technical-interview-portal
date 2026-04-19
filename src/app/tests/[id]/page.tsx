import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { TestResultsClient } from "@/components/results/TestResultsClient";

export default async function TestResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const test = await prisma.test.findUnique({
    where: { id },
    include: {
      candidate: true,
      questions: { orderBy: { order: "asc" } },
      fraudEvents: { orderBy: { occurredAt: "asc" } },
    },
  });

  if (!test) notFound();
  if (session.user.role !== "ADMIN" && test.recruiterId !== session.user.id) {
    redirect("/dashboard");
  }

  const shareUrl = `${process.env.APP_DOMAIN ?? "http://localhost:3000"}/results/share/${test.shareToken}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
        <div className="flex items-center gap-4">
          {test.status === "QUESTIONS_PENDING" && (
            <Link href={`/tests/${id}/review-questions`} className="text-sm bg-yellow-500 text-white px-3 py-1 rounded-lg hover:bg-yellow-600">
              Review Questions
            </Link>
          )}
        </div>
      </nav>
      <TestResultsClient test={JSON.parse(JSON.stringify(test))} shareUrl={shareUrl} />
    </div>
  );
}
