"use client";
import { useState } from "react";

type Question = {
  id: string;
  order: number;
  questionText: string;
  category: string;
  transcript: string | null;
  codeResponse: string | null;
  videoUrl: string | null;
  aiScore: number | null;
  aiRationale: string | null;
};

type FraudEvent = {
  id: string;
  type: string;
  severity: string;
  detail: string;
  occurredAt: string;
};

type Test = {
  id: string;
  jobTitle: string;
  level: string;
  status: string;
  overallScore: number | null;
  overallRating: string | null;
  startedAt: string | null;
  completedAt: string | null;
  timeUsedSeconds: number | null;
  candidate: { name: string; email: string };
  questions: Question[];
  fraudEvents: FraudEvent[];
};

const SCORE_COLOR: Record<string, string> = {
  Excellent: "text-green-600",
  Good: "text-blue-600",
  Average: "text-yellow-600",
  "Below Average": "text-orange-600",
  Poor: "text-red-600",
};

const SEVERITY_COLOR: Record<string, string> = {
  HIGH: "text-red-600 bg-red-50",
  MEDIUM: "text-amber-600 bg-amber-50",
  LOW: "text-yellow-600 bg-yellow-50",
};

export function TestResultsClient({ test, shareUrl }: { test: Test; shareUrl?: string }) {
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fraudOpen, setFraudOpen] = useState(false);

  function copyShare() {
    if (shareUrl) navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const highCount = test.fraudEvents.filter((e) => e.severity === "HIGH").length;
  const mediumCount = test.fraudEvents.filter((e) => e.severity === "MEDIUM").length;
  const lowCount = test.fraudEvents.filter((e) => e.severity === "LOW").length;

  const scoreColor = SCORE_COLOR[test.overallRating ?? ""] ?? "text-gray-900";

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{test.candidate.name}</h1>
            <p className="text-gray-500">{test.jobTitle} • {test.level}</p>
            <p className="text-sm text-gray-400 mt-1">
              {test.completedAt ? `Completed ${new Date(test.completedAt).toLocaleString()}` : `Status: ${test.status}`}
              {test.timeUsedSeconds ? ` • ${Math.floor(test.timeUsedSeconds / 60)}m ${test.timeUsedSeconds % 60}s` : ""}
            </p>
          </div>
          <div className="text-right">
            {test.overallScore !== null ? (
              <>
                <div className={`text-5xl font-bold ${scoreColor}`}>{test.overallScore.toFixed(1)}</div>
                <div className="text-sm text-gray-500">/ 10</div>
                <div className={`text-sm font-medium mt-1 ${scoreColor}`}>{test.overallRating}</div>
              </>
            ) : (
              <div className="text-gray-400 text-sm">
                {test.status === "COMPLETED" ? "Rating in progress…" : test.status.replace(/_/g, " ")}
              </div>
            )}
          </div>
        </div>
        {shareUrl && (
          <button
            onClick={copyShare}
            className="mt-4 text-sm bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg"
          >
            {copied ? "Copied!" : "Copy Share Link"}
          </button>
        )}
      </div>

      {/* Fraud summary */}
      {test.fraudEvents.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <button
            className="w-full flex justify-between items-center text-left"
            onClick={() => setFraudOpen((o) => !o)}
          >
            <h2 className="text-lg font-semibold text-gray-900">Interview Integrity Report</h2>
            <div className="flex gap-3 text-sm">
              {highCount > 0 && <span className="text-red-600 font-medium">HIGH: {highCount}</span>}
              {mediumCount > 0 && <span className="text-amber-600 font-medium">MEDIUM: {mediumCount}</span>}
              {lowCount > 0 && <span className="text-yellow-600 font-medium">LOW: {lowCount}</span>}
              <span className="text-gray-400">{fraudOpen ? "▲" : "▼"}</span>
            </div>
          </button>
          {fraudOpen && (
            <div className="mt-4 space-y-2">
              {test.fraudEvents.map((e) => (
                <div key={e.id} className={`flex justify-between items-center px-3 py-2 rounded-lg text-sm ${SEVERITY_COLOR[e.severity] ?? "bg-gray-50"}`}>
                  <div>
                    <span className="font-medium">{e.type.replace(/_/g, " ")}</span>
                    {e.detail && <span className="ml-2 text-xs opacity-70">{e.detail}</span>}
                  </div>
                  <span className="text-xs opacity-70">{new Date(e.occurredAt).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Questions accordion */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Question Responses</h2>
      <div className="space-y-3">
        {test.questions.map((q) => (
          <div key={q.id} className="bg-white rounded-xl shadow overflow-hidden">
            <button
              className="w-full flex justify-between items-center px-6 py-4 text-left hover:bg-gray-50"
              onClick={() => setOpenQuestion(openQuestion === q.id ? null : q.id)}
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-gray-500 text-sm">Q{q.order}</span>
                <span className="text-sm font-medium text-gray-900 line-clamp-1">{q.questionText}</span>
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{q.category}</span>
              </div>
              <div className="flex items-center gap-3">
                {q.aiScore !== null && (
                  <span className={`text-sm font-bold ${q.aiScore >= 8 ? "text-green-600" : q.aiScore >= 6 ? "text-yellow-600" : "text-red-600"}`}>
                    {q.aiScore}/10
                  </span>
                )}
                <span className="text-gray-400 text-sm">{openQuestion === q.id ? "▲" : "▼"}</span>
              </div>
            </button>
            {openQuestion === q.id && (
              <div className="px-6 pb-6 border-t border-gray-100">
                <p className="text-sm text-gray-700 mt-4 font-medium mb-3">{q.questionText}</p>
                {q.videoUrl && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 mb-1">Video Response</p>
                    <video controls className="w-full max-w-2xl rounded-lg bg-black" src={q.videoUrl} />
                  </div>
                )}
                {q.transcript && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 mb-1">Transcript</p>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{q.transcript}</p>
                  </div>
                )}
                {q.codeResponse && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 mb-1">Code Response</p>
                    <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto">{q.codeResponse}</pre>
                  </div>
                )}
                {q.aiScore !== null && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-lg font-bold ${q.aiScore >= 8 ? "text-green-600" : q.aiScore >= 6 ? "text-yellow-600" : "text-red-600"}`}>{q.aiScore}/10</span>
                    </div>
                    {q.aiRationale && <p className="text-sm text-gray-700">{q.aiRationale}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
