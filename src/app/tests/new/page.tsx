"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Candidate = { id: string; name: string; email: string };

interface AiDebugInfo {
  systemPrompt: string;
  userPrompt: string;
  rawResponse: string;
}

const LEVELS = [
  { value: "BASIC", label: "Basic", desc: "Definitions, fundamentals, conceptual" },
  { value: "INTERMEDIATE", label: "Intermediate", desc: "Applied knowledge, scenario-based" },
  { value: "ADVANCED", label: "Advanced", desc: "Architecture, system design, edge cases" },
  { value: "PRACTICAL", label: "Practical", desc: "Live hands-on coding / implementation" },
];

function AiConversationPanel({ debug }: { debug: AiDebugInfo }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6 border border-purple-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 text-sm font-medium text-purple-800 hover:bg-purple-100"
      >
        <span className="flex items-center gap-2">
          <span className="text-base">🤖</span> AI Conversation Log
        </span>
        <span className="text-purple-500 text-xs">{open ? "▲ hide" : "▼ show"}</span>
      </button>

      {open && (
        <div className="divide-y divide-gray-100">
          {/* System prompt */}
          <div className="p-4 bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">System Prompt</span>
              <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">sent to AI</span>
            </div>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono bg-white border border-gray-200 rounded p-3 max-h-48 overflow-y-auto">
              {debug.systemPrompt}
            </pre>
          </div>

          {/* User prompt */}
          <div className="p-4 bg-blue-50">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">User Prompt</span>
              <span className="text-xs px-1.5 py-0.5 bg-blue-200 text-blue-700 rounded">job details</span>
            </div>
            <pre className="text-xs text-blue-900 whitespace-pre-wrap font-mono bg-white border border-blue-200 rounded p-3 max-h-48 overflow-y-auto">
              {debug.userPrompt}
            </pre>
          </div>

          {/* Raw response */}
          <div className="p-4 bg-green-50">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">AI Response</span>
              <span className="text-xs px-1.5 py-0.5 bg-green-200 text-green-700 rounded">raw output</span>
            </div>
            <pre className="text-xs text-green-900 whitespace-pre-wrap font-mono bg-white border border-green-200 rounded p-3 max-h-64 overflow-y-auto">
              {debug.rawResponse}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleTestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get("candidateId") ?? "";

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateId, setCandidateId] = useState(preselectedId);
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [level, setLevel] = useState("BASIC");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [debug, setDebug] = useState<AiDebugInfo | null>(null);
  const [generatedTestId, setGeneratedTestId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/candidates")
      .then((r) => r.json())
      .then((d) => setCandidates(d.candidates ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!candidateId) { setError("Select a candidate"); return; }
    setLoading(true);
    setError("");
    setDebug(null);
    setGeneratedTestId(null);

    const res = await fetch("/api/tests/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId, jobTitle, jobDescription, level }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to generate questions");
      return;
    }

    // Store debug info so review-questions page can display it
    if (data.debug) {
      setDebug(data.debug);
      setGeneratedTestId(data.testId);
      try {
        sessionStorage.setItem(`ai_debug_${data.testId}`, JSON.stringify(data.debug));
      } catch {
        // sessionStorage not available (e.g., private browsing)
      }
    } else {
      router.push(`/tests/${data.testId}/review-questions`);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
        </div>
        <div className="bg-white rounded-xl shadow p-8">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Schedule Technical Interview</h1>
          <p className="text-sm text-gray-500 mb-8">AI will generate 10 questions based on the job description. You can review and edit before sending the invite.</p>

          {!generatedTestId ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Candidate *</label>
                <select
                  value={candidateId}
                  onChange={(e) => setCandidateId(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select candidate…</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  required
                  placeholder="e.g. Senior React Engineer"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Description *</label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  required
                  rows={8}
                  placeholder="Paste the full job description here. The AI will use this to generate targeted questions…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Interview Level *</label>
                <div className="grid grid-cols-2 gap-3">
                  {LEVELS.map((l) => (
                    <label
                      key={l.value}
                      className={`flex items-start gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                        level === l.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="level"
                        value={l.value}
                        checked={level === l.value}
                        onChange={() => setLevel(l.value)}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="font-medium text-sm text-gray-900">{l.label}</div>
                        <div className="text-xs text-gray-500">{l.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {error && <p className="text-red-600 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Generating questions with AI…" : "Generate Questions"}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-semibold text-green-800">10 questions generated!</p>
                  <p className="text-sm text-green-700">Review the AI conversation below, then proceed to review questions.</p>
                </div>
              </div>

              {debug && <AiConversationPanel debug={debug} />}

              <button
                onClick={() => router.push(`/tests/${generatedTestId}/review-questions`)}
                className="w-full bg-blue-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-blue-700"
              >
                Review & Edit Questions →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ScheduleTestPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Loading…</div>}>
      <ScheduleTestForm />
    </Suspense>
  );
}
