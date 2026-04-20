import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface Check {
  ok: boolean;
  message: string;
}

async function checkDatabase(): Promise<Check> {
  const url = process.env.DATABASE_URL;
  if (!url) return { ok: false, message: "DATABASE_URL not set" };

  const isFile = url.startsWith("file:");
  if (isFile) return { ok: false, message: "DATABASE_URL is a local file path — won't work on Vercel" };

  const isLibsql = url.startsWith("libsql://") || url.startsWith("https://") || url.startsWith("wss://");
  if (!isLibsql) return { ok: false, message: `Unrecognized scheme in DATABASE_URL: ${url.split(":")[0]}` };

  const hasToken = !!process.env.DATABASE_AUTH_TOKEN;
  if (!hasToken) return { ok: false, message: "DATABASE_AUTH_TOKEN not set" };

  try {
    // Dynamic import to avoid build-time side effects
    const { prisma } = await import("@/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, message: "Connected" };
  } catch (e) {
    return { ok: false, message: `Query failed: ${(e as Error).message}` };
  }
}

function checkFirebase(): Check {
  const required = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) return { ok: false, message: `Missing: ${missing.join(", ")}` };

  const adminRequired = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"];
  const adminMissing = adminRequired.filter((k) => !process.env[k]);
  if (adminMissing.length > 0) return { ok: false, message: `Admin SDK missing: ${adminMissing.join(", ")}` };

  return { ok: true, message: "Config present" };
}

function checkAI(): Check {
  const gemini = process.env.GEMINI_API_KEY;
  const anthropic = process.env.ANTHROPIC_API_KEY;
  if (!gemini && !anthropic) return { ok: false, message: "No AI API key set (GEMINI_API_KEY or ANTHROPIC_API_KEY)" };
  const provider = anthropic ? "Anthropic" : "Gemini";
  return { ok: true, message: `${provider} key present` };
}

function checkAuth(): Check {
  if (!process.env.AUTH_SECRET) return { ok: false, message: "AUTH_SECRET not set" };
  return { ok: true, message: "AUTH_SECRET set" };
}

export async function GET() {
  const [db, firebase, ai, auth] = await Promise.all([
    checkDatabase(),
    Promise.resolve(checkFirebase()),
    Promise.resolve(checkAI()),
    Promise.resolve(checkAuth()),
  ]);

  const checks = { db, firebase, ai, auth };
  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    { ok: allOk, checks, node: process.version },
    { status: allOk ? 200 : 503 },
  );
}
