"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Question = {
  id: string;
  order: number;
  questionText: string;
  category: string;
  expectedSummary: string;
  codeLanguageHint: string | null;
};

type Test = {
  id: string;
  jobTitle: string;
  level: string;
  status: string;
  candidate: { name: string };
  questions: Question[];
};

export default function ReviewQuestionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [test, setTest] = useState<Test | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [expandedSummaries, setExpandedSummaries] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/tests/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setTest(d.test);
        const initial: Record<string, string> = {};
        d.test?.questions?.forEach((q: Question) => { initial[q.id] = q.questionText; });
        setEdits(initial);
      });
  }, [id]);

  async function handleApprove() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/tests/${id}/approve-and-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ edits }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to send invite");
    } else {
      router.push(`/tests/${id}`);
    }
  }

  async function handleRegenerate() {
    if (!confirm("This will replace all current questions. Continue?")) return;
    setRegenerating(true);
    setError("");
    const res = await fetch(`/api/tests/${id}/regenerate`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to regenerate");
      setRegenerating(false);
      return;
    }
    // Reload questions
    fetch(`/api/tests/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setTest(d.test);
        const initial: Record<string, string> = {};
        d.test?.questions?.forEach((q: Question) => { initial[q.id] = q.questionText; });
        setEdits(initial);
        setRegenerating(false);
      });
  }

  if (!test) return <div className="p-8 text-gray-500">Loading…</div>;

  const levelColors: Record<string, string> = {
    BASIC: "bg-green-100 text-green-800",
    INTERMEDIATE: "bg-yellow-100 text-yellow-800",
    ADVANCED: "bg-orange-100 text-orange-800",
    PRACTICAL: "bg-purple-100 text-purple-800",
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-gray-900">{test.candidate.name} — {test.jobTitle}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${levelColors[test.level] ?? "bg-gray-100"}`}>{test.level}</span>
          </div>
          <p className="text-sm text-blue-700">Review the AI-generated questions below. You can edit any question before sending the invite. Once approved, the candidate will receive their email invite.</p>
        </div>

        <div className="space-y-4 mb-8">
          {test.questions.map((q) => {
            const isEdited = edits[q.id] !== q.questionText;
            return (
              <div key={q.id} className="bg-white rounded-xl shadow p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold text-gray-500">Q{q.order}</span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{q.category}</span>
                  {q.codeLanguageHint && (
                    <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">Code: {q.codeLanguageHint}</span>
                  )}
                  {isEdited && (
                    <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">Edited</span>
                  )}
                </div>
                <textarea
                  value={edits[q.id] ?? q.questionText}
                  onChange={(e) => setEdits((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <div className="mt-2">
                  <button
                    onClick={() => setExpandedSummaries((p) => ({ ...p, [q.id]: !p[q.id] }))}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    {expandedSummaries[q.id] ? "Hide" : "Show"} expected answer summary
                  </button>
                  {expandedSummaries[q.id] && (
                    <p className="mt-2 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg">{q.expectedSummary}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <div className="flex gap-4">
          <button
            onClick={handleApprove}
            disabled={loading || regenerating}
            className="flex-1 bg-blue-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Sending invite…" : "Approve & Send Invite"}
          </button>
          <button
            onClick={handleRegenerate}
            disabled={loading || regenerating}
            className="px-6 py-3 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {regenerating ? "Regenerating…" : "Regenerate All Questions"}
          </button>
        </div>
      </div>
    </div>
  );
}
