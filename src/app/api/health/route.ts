import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const required = ["AUTH_SECRET", "DATABASE_URL", "DATABASE_AUTH_TOKEN", "GEMINI_API_KEY"];
  const missing = required.filter((k) => !process.env[k]);
  const dbUrl = process.env.DATABASE_URL ?? "(unset — defaults to file:./dev.db)";
  const isFileDb = dbUrl.startsWith("file:");

  return NextResponse.json({
    ok: missing.length === 0 && !isFileDb,
    missing,
    warnings: isFileDb ? ["DATABASE_URL is a local file path — won't work on Vercel"] : [],
    node: process.version,
  });
}
