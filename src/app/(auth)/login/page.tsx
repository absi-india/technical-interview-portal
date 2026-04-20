"use client";
import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

interface ServiceCheck {
  ok: boolean;
  message: string;
}

interface HealthData {
  ok: boolean;
  checks: {
    db: ServiceCheck;
    firebase: ServiceCheck;
    ai: ServiceCheck;
    auth: ServiceCheck;
  };
  node: string;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${ok ? "bg-green-500" : "bg-red-500"}`}
    />
  );
}

function HealthPanel() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data: HealthData) => {
        setHealth(data);
        if (!data.ok) setExpanded(true);
      })
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
        <span className="inline-block w-2 h-2 rounded-full bg-gray-300 animate-pulse" />
        Checking system status…
      </div>
    );
  }

  if (!health) {
    return (
      <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-400">
        System status unavailable
      </div>
    );
  }

  const labels: Record<keyof HealthData["checks"], string> = {
    db: "Database",
    firebase: "Firebase",
    ai: "AI Service",
    auth: "Auth Secret",
  };

  return (
    <div className="mt-6 pt-4 border-t border-gray-100">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 w-full text-left"
      >
        <StatusDot ok={health.ok} />
        <span className="flex-1">
          {health.ok ? "All systems operational" : "System issues detected"}
        </span>
        <span className="text-gray-400">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {(Object.entries(health.checks) as [keyof HealthData["checks"], ServiceCheck][]).map(
            ([key, check]) => (
              <div key={key} className="flex items-start gap-2 text-xs">
                <StatusDot ok={check.ok} />
                <span className="font-medium text-gray-600 w-20 flex-shrink-0">{labels[key]}</span>
                <span className={check.ok ? "text-gray-400" : "text-red-600"}>{check.message}</span>
              </div>
            ),
          )}
          <p className="text-xs text-gray-400 pt-1">Node {health.node}</p>
        </div>
      )}
    </div>
  );
}

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email);
      setStatus("sent");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/user-not-found" || code === "auth/invalid-email") {
        // Don't reveal whether the email exists — just say sent
        setStatus("sent");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
        setStatus("error");
      } else {
        setError("Unable to send reset email. Check your Firebase configuration.");
        setStatus("error");
      }
    }
  }

  if (status === "sent") {
    return (
      <div className="text-center">
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4">
          If an account exists for <strong>{email}</strong>, a password reset link has been sent.
          Check your inbox (and spam folder).
        </p>
        <button onClick={onBack} className="text-sm text-blue-600 hover:underline">
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Reset password</h2>
      <p className="text-sm text-gray-500 mb-6">
        Enter your email and we&apos;ll send a reset link via Firebase.
      </p>
      <form onSubmit={handleReset} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="you@example.com"
          />
        </div>
        {status === "error" && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={status === "sending"}
          className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {status === "sending" ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <button
        onClick={onBack}
        className="mt-4 w-full text-sm text-gray-500 hover:text-gray-700 text-center"
      >
        Back to sign in
      </button>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Sign in with Firebase to get an ID token
      const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      const idToken = await credential.user.getIdToken();

      // Exchange the Firebase token for a Next-Auth session
      const result = await signIn("credentials", { idToken, redirect: false });
      if (result?.error) {
        setError("Account not found or inactive. Contact your administrator.");
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
        setLoading(false);
        return;
      }
      // Firebase user not found, wrong password, SDK not configured, or any other
      // Firebase error → fall back to legacy bcrypt credentials (covers seeded admin accounts).
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("Invalid email or password");
      } else {
        router.push("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-8">
        {showReset ? (
          <ForgotPasswordForm onBack={() => setShowReset(false)} />
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Interview Portal</h1>
            <p className="text-gray-500 mb-8 text-sm">Sign in to your account</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <button
                    type="button"
                    onClick={() => setShowReset(true)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-gray-500">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-blue-600 hover:underline font-medium">
                Create account
              </Link>
            </p>
          </>
        )}
        <HealthPanel />
      </div>
    </div>
  );
}
