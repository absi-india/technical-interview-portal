"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

type User = { id: string; name: string; email: string; role: string; isActive: boolean; testCount: number };
type Test = { id: string; jobTitle: string; level: string; status: string; createdAt: string; candidate: { name: string }; recruiter: { name: string }; overallScore: number | null };
type Analytics = {
  totalCandidates: number;
  totalCompleted: number;
  testsThisMonth: number;
  fraudThisMonth: number;
  avgByLevel: { level: string; avg: number; count: number }[];
};

export default function AdminPage() {
  const [tab, setTab] = useState<"users" | "tests" | "analytics">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "" });
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    if (tab === "users") fetch("/api/users").then((r) => r.json()).then((d) => setUsers(d.users ?? []));
    if (tab === "tests") fetch("/api/tests").then((r) => r.json()).then((d) => setTests(d.tests ?? []));
    if (tab === "analytics") fetch("/api/admin/analytics").then((r) => r.json()).then(setAnalytics);
  }, [tab]);

  async function toggleUser(userId: string, isActive: boolean) {
    await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    setUsers((u) => u.map((x) => x.id === userId ? { ...x, isActive } : x));
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    const data = await res.json();
    if (!res.ok) { setCreateError(data.error); return; }
    setUsers((u) => [{ ...data.user, testCount: 0 }, ...u]);
    setShowCreateUser(false);
    setNewUser({ name: "", email: "", password: "" });
  }

  const STATUS_COLOR: Record<string, string> = {
    COMPLETED: "bg-green-100 text-green-800",
    IN_PROGRESS: "bg-orange-100 text-orange-800",
    INVITED: "bg-indigo-100 text-indigo-800",
    QUESTIONS_PENDING: "bg-yellow-100 text-yellow-800",
    EXPIRED: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-semibold text-gray-900">Admin Panel</h1>
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-1 mb-8 bg-white rounded-xl shadow p-1 w-fit">
          {(["users", "tests", "analytics"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {tab === "users" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recruiters</h2>
              <button
                onClick={() => setShowCreateUser(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
              >
                + Create Recruiter
              </button>
            </div>
            {showCreateUser && (
              <div className="bg-white rounded-xl shadow p-6 mb-4">
                <h3 className="font-medium text-gray-900 mb-4">New Recruiter</h3>
                <form onSubmit={createUser} className="grid grid-cols-3 gap-4">
                  <input placeholder="Name" required value={newUser.name} onChange={(e) => setNewUser((n) => ({ ...n, name: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="Email" type="email" required value={newUser.email} onChange={(e) => setNewUser((n) => ({ ...n, email: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="Password" type="password" required value={newUser.password} onChange={(e) => setNewUser((n) => ({ ...n, password: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  {createError && <p className="col-span-3 text-red-600 text-sm">{createError}</p>}
                  <div className="col-span-3 flex gap-2">
                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Create</button>
                    <button type="button" onClick={() => setShowCreateUser(false)} className="border border-gray-300 px-4 py-2 rounded-lg text-sm">Cancel</button>
                  </div>
                </form>
              </div>
            )}
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium">Email</th>
                    <th className="text-left px-4 py-3 font-medium">Tests</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                      <td className="px-4 py-3 text-gray-600">{u.email}</td>
                      <td className="px-4 py-3 text-gray-600">{u.testCount}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleUser(u.id, !u.isActive)}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {u.isActive ? "Deactivate" : "Reactivate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tests Tab */}
        {tab === "tests" && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">All Tests</h2>
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Candidate</th>
                    <th className="text-left px-4 py-3 font-medium">Position</th>
                    <th className="text-left px-4 py-3 font-medium">Level</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Score</th>
                    <th className="text-left px-4 py-3 font-medium">Recruiter</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tests.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/tests/${t.id}`} className="font-medium text-blue-600 hover:underline">{t.candidate?.name}</Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{t.jobTitle}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{t.level}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[t.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {t.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{t.overallScore != null ? `${t.overallScore.toFixed(1)}/10` : "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{t.recruiter?.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {tab === "analytics" && analytics && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Analytics</h2>
            <div className="grid grid-cols-4 gap-4 mb-8">
              {[
                { label: "Total Candidates", value: analytics.totalCandidates },
                { label: "Tests Completed", value: analytics.totalCompleted },
                { label: "Tests This Month", value: analytics.testsThisMonth },
                { label: "Fraud Events (Month)", value: analytics.fraudThisMonth },
              ].map((card) => (
                <div key={card.label} className="bg-white rounded-xl shadow p-5">
                  <div className="text-3xl font-bold text-gray-900">{card.value}</div>
                  <div className="text-sm text-gray-500 mt-1">{card.label}</div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Average Score by Level</h3>
              <div className="space-y-3">
                {analytics.avgByLevel.map((item) => (
                  <div key={item.level} className="flex items-center gap-4">
                    <div className="w-24 text-sm text-gray-600">{item.level}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${(item.avg / 10) * 100}%` }}
                      />
                    </div>
                    <div className="text-sm font-medium text-gray-900 w-16">
                      {item.avg > 0 ? `${item.avg}/10` : "—"} <span className="text-gray-400 text-xs">({item.count})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
