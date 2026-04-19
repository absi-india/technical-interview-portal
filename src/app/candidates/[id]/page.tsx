import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

const STATUS_COLOR: Record<string, string> = {
  QUESTIONS_PENDING: "bg-yellow-100 text-yellow-800",
  INVITED: "bg-indigo-100 text-indigo-800",
  IN_PROGRESS: "bg-orange-100 text-orange-800",
  COMPLETED: "bg-green-100 text-green-800",
  EXPIRED: "bg-gray-100 text-gray-600",
};

export default async function CandidateProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
      tests: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!candidate) notFound();
  if (session.user.role !== "ADMIN" && candidate.recruiterId !== session.user.id) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
        </div>

        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{candidate.name}</h1>
              <p className="text-gray-500">{candidate.email} • {candidate.phone}</p>
            </div>
            <Link
              href={`/tests/new?candidateId=${candidate.id}`}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Schedule Test
            </Link>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-gray-800 mb-3">Test History</h2>
        {candidate.tests.length === 0 ? (
          <p className="text-gray-500 text-sm">No tests yet.</p>
        ) : (
          <div className="space-y-3">
            {candidate.tests.map((test) => (
              <div key={test.id} className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{test.jobTitle}</p>
                  <p className="text-xs text-gray-500">{test.level} • {new Date(test.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[test.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {test.status.replace(/_/g, " ")}
                  </span>
                  {test.status === "QUESTIONS_PENDING" && (
                    <Link href={`/tests/${test.id}/review-questions`} className="text-sm text-blue-600 hover:underline">Review</Link>
                  )}
                  {["COMPLETED", "IN_PROGRESS"].includes(test.status) && (
                    <Link href={`/tests/${test.id}`} className="text-sm text-blue-600 hover:underline">Results</Link>
                  )}
                  {test.overallScore !== null && (
                    <span className="font-bold text-gray-900">{test.overallScore?.toFixed(1)}/10</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
