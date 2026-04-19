import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { TestResultsClient } from "@/components/results/TestResultsClient";

export default async function ShareResultsPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  const test = await prisma.test.findUnique({
    where: { shareToken },
    include: {
      candidate: true,
      questions: { orderBy: { order: "asc" } },
      fraudEvents: { orderBy: { occurredAt: "asc" } },
    },
  });

  if (!test) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Interview Results</h1>
      </nav>
      <TestResultsClient test={JSON.parse(JSON.stringify(test))} />
      <div className="text-center py-8 text-xs text-gray-400">
        Powered by {process.env.COMPANY_NAME ?? "Interview Portal"}
      </div>
    </div>
  );
}
