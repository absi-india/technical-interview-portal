"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const CodeEditor = dynamic(() => import("./CodeEditor"), { ssr: false });

type Question = {
  id: string;
  order: number;
  questionText: string;
  category: string;
  codeLanguageHint: string | null;
};

type Props = {
  inviteToken: string;
  candidateName: string;
  jobTitle: string;
  level: string;
  questions: Question[];
  initialStatus: string;
};

const TOTAL_SECONDS = 30 * 60; // 30-minute limit
const RULES = [
  "Your camera and microphone will be active for the entire interview",
  "You must remain in fullscreen mode at all times",
  "Switching tabs or windows will be flagged and may terminate your interview",
  "Copy-paste is disabled in all response fields",
  "Your face must remain visible on camera throughout",
  "Use of a second device or phone is prohibited",
  "The interview session is monitored and recorded",
];

export function InterviewExperience({ inviteToken, candidateName, jobTitle, level, questions, initialStatus }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<"prechecks" | "interview" | "done">(
    initialStatus === "IN_PROGRESS" ? "interview" : "prechecks"
  );
  const [agreed, setAgreed] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TOTAL_SECONDS);
  const [fraudCount, setFraudCount] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [codeResponse, setCodeResponse] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showFullscreenOverlay, setShowFullscreenOverlay] = useState(false);
  const [fullscreenExits, setFullscreenExits] = useState(0);
  const [tabSwitches, setTabSwitches] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionShownAt = useRef<number>(Date.now());

  const logFraud = useCallback(
    async (type: string, severity: string, detail: string) => {
      setFraudCount((c) => c + 1);
      fetch(`/api/interview/${inviteToken}/fraud-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, severity, detail }),
      }).catch(() => undefined);
    },
    [inviteToken]
  );

  async function requestCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraReady(true);
    } catch {
      setCameraError("Camera/microphone access denied. Please allow access and try again.");
    }
  }

  async function beginInterview() {
    await fetch(`/api/interview/${inviteToken}/start`, { method: "POST" });
    try { await document.documentElement.requestFullscreen(); } catch { /* ignore */ }
    setPhase("interview");
    startTimer();
    startRecordingForQuestion();
  }

  function startTimer() {
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          handleAutoSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  function startRecordingForQuestion() {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setTranscript("");
    setCodeResponse("");
    questionShownAt.current = Date.now();

    try {
      const recorder = new MediaRecorder(streamRef.current, { mimeType: "video/webm" });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(1000);
      recorderRef.current = recorder;
    } catch { /* MediaRecorder not available */ }

    // Speech recognition
    const SpeechRecognitionAPI =
      ("SpeechRecognition" in window ? (window as Window).SpeechRecognition : null) ??
      ("webkitSpeechRecognition" in window ? (window as Window).webkitSpeechRecognition : null);
    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript;
          else interim += event.results[i][0].transcript;
        }
        if (final) setTranscript((t) => t + " " + final);
        else if (interim) setTranscript((t) => t.replace(/\[interim:.*?\]/, "") + ` [interim:${interim}]`);
      };
      recognition.start();
      recognitionRef.current = recognition;
    }
  }

  function stopRecording(): Promise<Blob | null> {
    recognitionRef.current?.stop();
    return new Promise((resolve) => {
      if (!recorderRef.current || recorderRef.current.state === "inactive") {
        resolve(null);
        return;
      }
      recorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        resolve(blob.size > 0 ? blob : null);
      };
      recorderRef.current.stop();
    });
  }

  async function handleNext() {
    const q = questions[currentIdx];
    const timeSpent = (Date.now() - questionShownAt.current) / 1000;

    // Log rapid answer
    if (timeSpent < 15 && ["INTERMEDIATE", "ADVANCED", "PRACTICAL"].includes(level)) {
      logFraud("RAPID_ANSWER", "LOW", `Answered in ${Math.round(timeSpent)}s`);
    }

    setUploading(true);
    const blob = await stopRecording();
    const cleanTranscript = transcript.replace(/\[interim:.*?\]/g, "").trim();

    const formData = new FormData();
    formData.append("questionId", q.id);
    if (cleanTranscript) formData.append("transcript", cleanTranscript);
    if (codeResponse) formData.append("codeResponse", codeResponse);
    if (blob) formData.append("video", blob, `${q.id}.webm`);

    await fetch(`/api/interview/${inviteToken}/upload`, { method: "POST", body: formData });
    setUploading(false);

    if (currentIdx + 1 >= questions.length) {
      await handleAutoSubmit();
    } else {
      setCurrentIdx((i) => i + 1);
      startRecordingForQuestion();
    }
  }

  async function handleAutoSubmit() {
    clearInterval(timerRef.current!);
    await stopRecording();
    await fetch(`/api/interview/${inviteToken}/submit`, { method: "POST" });
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    router.push(`/interview/${inviteToken}/complete`);
  }

  // Fullscreen enforcement
  useEffect(() => {
    if (phase !== "interview") return;
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        setShowFullscreenOverlay(true);
        setFullscreenExits((c) => {
          const newCount = c + 1;
          logFraud("FULLSCREEN_EXIT", "HIGH", `Exit #${newCount}`);
          if (newCount >= 3) handleAutoSubmit();
          return newCount;
        });
      } else {
        setShowFullscreenOverlay(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Tab/window blur detection
  useEffect(() => {
    if (phase !== "interview") return;
    const handleVisibility = () => {
      if (document.hidden) {
        setTabSwitches((c) => {
          const newCount = c + 1;
          logFraud("TAB_SWITCH", "MEDIUM", `Switch #${newCount}`);
          if (newCount >= 5) handleAutoSubmit();
          return newCount;
        });
      }
    };
    const handleBlur = () => {
      logFraud("WINDOW_BLUR", "MEDIUM", "Window lost focus");
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Copy-paste prevention
  useEffect(() => {
    if (phase !== "interview") return;
    const block = (e: Event) => { e.preventDefault(); logFraud("COPY_PASTE_DETECTED", "MEDIUM", e.type); };
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("paste", block);
    return () => {
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("paste", block);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");
  const q = questions[currentIdx];
  const isPractical = level === "PRACTICAL";

  // Pre-checks screen
  if (phase === "prechecks") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Technical Interview</h1>
          <p className="text-gray-500 mb-6">{candidateName} — {jobTitle} ({level})</p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
            <h2 className="font-semibold text-amber-900 mb-3">Interview Rules</h2>
            <ul className="space-y-2">
              {RULES.map((r) => (
                <li key={r} className="flex items-start gap-2 text-sm text-amber-800">
                  <span className="mt-0.5">•</span><span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="font-semibold text-gray-900">Camera Setup</h2>
              {cameraReady && <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Ready</span>}
            </div>
            {!cameraReady && !cameraError && (
              <button onClick={requestCamera} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                Allow Camera & Microphone
              </button>
            )}
            {cameraError && <p className="text-red-600 text-sm">{cameraError}</p>}
            <video ref={videoRef} autoPlay muted playsInline className={`mt-3 rounded-lg w-64 ${cameraReady ? "" : "hidden"}`} />
          </div>

          <div className="flex items-center gap-3 mb-6">
            <input
              type="checkbox"
              id="agree"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="agree" className="text-sm text-gray-700">
              I understand and agree to all interview conditions above
            </label>
          </div>

          <div className="text-sm text-gray-500 mb-4">
            {questions.length} questions • 30-minute limit • Chrome or Edge required
          </div>

          <button
            onClick={beginInterview}
            disabled={!agreed || !cameraReady}
            className="w-full bg-blue-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
          >
            Begin Interview
          </button>
        </div>
      </div>
    );
  }

  // Interview screen
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Fullscreen overlay */}
      {showFullscreenOverlay && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
          <div className="bg-white rounded-xl p-8 max-w-sm text-center">
            <h2 className="text-xl font-bold text-red-600 mb-2">Fullscreen Required</h2>
            <p className="text-gray-600 mb-4">Please return to fullscreen to continue your interview.</p>
            <button
              onClick={() => document.documentElement.requestFullscreen()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg"
            >
              Return to Fullscreen
            </button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="bg-gray-800 text-white px-6 py-3 flex justify-between items-center">
        <span className="text-sm font-medium">Question {currentIdx + 1} of {questions.length}</span>
        <div className="flex items-center gap-4">
          {fraudCount > 0 && (
            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
              ⚠ {fraudCount} warning{fraudCount !== 1 ? "s" : ""}
            </span>
          )}
          <span className={`text-lg font-mono font-bold ${timeLeft < 300 ? "text-red-400" : "text-white"}`}>
            {mm}:{ss}
          </span>
        </div>
      </div>

      {/* Main content */}
      {isPractical ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Code editor */}
          <div className="flex-[3] flex flex-col">
            <CodeEditor
              language={q.codeLanguageHint ?? "javascript"}
              value={codeResponse}
              onChange={setCodeResponse}
            />
          </div>
          {/* Right: Camera + question */}
          <div className="flex-[2] flex flex-col bg-gray-850 border-l border-gray-700 p-4">
            <video ref={videoRef} autoPlay muted playsInline className="w-full rounded-lg bg-black mb-4" style={{ maxHeight: "200px", objectFit: "cover" }} />
            <div className="flex-1 overflow-auto">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{q.category}</p>
              <p className="text-white text-sm leading-relaxed">{q.questionText}</p>
            </div>
            <button
              onClick={handleNext}
              disabled={uploading}
              className="mt-4 w-full bg-blue-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : currentIdx + 1 >= questions.length ? "Submit Interview" : "Next Question"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col flex-1 p-8 max-w-3xl mx-auto w-full">
          <div className="bg-gray-800 rounded-xl p-6 mb-6 flex-1">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">{q.category}</p>
            <p className="text-white text-xl leading-relaxed">{q.questionText}</p>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400 mb-6">
            <span>🎤 Recording your spoken response</span>
            {transcript && <span className="text-green-400 text-xs line-clamp-1">{transcript.replace(/\[interim:.*?\]/g, "").slice(-80)}</span>}
          </div>
          <video ref={videoRef} autoPlay muted playsInline className="w-32 rounded-lg bg-black mb-6 self-end" />
          <button
            onClick={handleNext}
            disabled={uploading}
            className="w-full bg-blue-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : currentIdx + 1 >= questions.length ? "Submit Interview" : "Next Question →"}
          </button>
        </div>
      )}
    </div>
  );
}
