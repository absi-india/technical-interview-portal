import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";

const STATUS_LABEL: Record<string, string> = {
  QUESTIONS_PENDING: "Questions Pending",
  QUESTIONS_APPROVED: "Questions Approved",
  INVITED: "Invited",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
};

const STATUS_COLOR: Record<string, string> = {
  QUESTIONS_PENDING: "bg-yellow-100 text-yellow-800",
  QUESTIONS_APPROVED: "bg-blue-100 text-blue-800",
  INVITED: "bg-indigo-100 text-indigo-800",
  IN_PROGRESS: "bg-orange-100 text-orange-800",
  COMPLETED: "bg-green-100 text-green-800",
  EXPIRED: "bg-gray-100 text-gray-600",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const where = session.user.role === "ADMIN" ? {} : { recruiterId: session.user.id };
  const candidates = await prisma.candidate.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      tests: { select: { id: true, status: true, jobTitle: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-semibold text-gray-900">Interview Portal</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{session.user.name} ({session.user.role})</span>
          {session.user.role === "ADMIN" && (
            <Link href="/admin" className="text-sm text-blue-600 hover:underline">Admin Panel</Link>
          )}
          <SignOutButton />
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Candidates</h2>
          <Link
            href="/candidates/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Add Candidate
          </Link>
        </div>

        {candidates.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            No candidates yet. <Link href="/candidates/new" className="text-blue-600 hover:underline">Add your first candidate</Link>.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Candidate</th>
                  <th className="text-left px-4 py-3 font-medium">Latest Test</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {candidates.map((c) => {
                  const latest = c.tests[0];
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/candidates/${c.id}`} className="font-medium text-gray-900 hover:text-blue-600">{c.name}</Link>
                        <div className="text-gray-500 text-xs">{c.email}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{latest?.jobTitle ?? "—"}</td>
                      <td className="px-4 py-3">
                        {latest ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[latest.status] ?? "bg-gray-100"}`}>
                            {STATUS_LABEL[latest.status] ?? latest.status}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">No tests</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Link href={`/candidates/${c.id}`} className="text-blue-600 hover:underline">View</Link>
                          <Link href={`/tests/new?candidateId=${c.id}`} className="text-green-600 hover:underline">Schedule Test</Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
