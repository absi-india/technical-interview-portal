# Deployment Guide — 100% Free

## Free Services Summary

| Service | What it does | Free tier |
|---|---|---|
| **Vercel** | Hosts the Next.js app + runs cron jobs | 100 GB bandwidth/mo |
| **Turso** | Hosted SQLite database | 9 GB storage, 1B row reads/mo |
| **Google Gemini** | AI question generation & scoring | 1M tokens/day (gemini-1.5-flash) |
| **Resend** *(optional)* | Sends recruiter emails | 3,000 emails/mo |
| **Upstash Redis** *(optional)* | Instant AI rating trigger | 10K cmds/day |

> **Redis is optional.** A Vercel cron job runs every minute to process unrated
> interviews. Skip Redis and ratings just start within ~1 minute of completion.

---

## Step 1 — Get your free API keys

### 1a. Turso (database)
1. Sign up at **https://app.turso.tech** — no credit card
2. Click **"Create database"** → name it `interview-portal` → pick any region
3. On the database page click **"Connect"** → copy the **URL**
   - Looks like: `libsql://interview-portal-yourname.turso.io`
4. Go to **Settings → Tokens** → click **"Create token"** → copy the token

### 1b. Gemini API key
1. Go to **https://aistudio.google.com/app/apikey**
2. Click **"Create API key"** → copy it
   - Starts with `AIza...`
   - Free tier: 15 req/min, 1M tokens/day — no billing needed

### 1c. Resend email *(optional — skip if you don't want email notifications)*
1. Sign up at **https://resend.com**
2. Add and verify your domain
3. Go to **API Keys** → create a key → copy it

### 1d. Upstash Redis *(optional — skip for now)*
1. Sign up at **https://console.upstash.com**
2. Create a **Redis** database → pick the same region as your Vercel deployment
3. Copy the **ioredis URL** (starts with `rediss://`)

---

## Step 2 — Set up Vercel

### 2a. Import your repo
1. Go to **https://vercel.com/new**
2. Connect your GitHub account → select the `technical-interview-portal` repo
3. Framework preset: **Next.js** (auto-detected)
4. Click **"Deploy"** — it will fail the first time because env vars aren't set yet, that's fine

### 2b. Add environment variables on Vercel
Go to your project on Vercel → **Settings → Environment Variables** → add each one:

#### Required (app won't work without these)
| Name | Value | Example |
|---|---|---|
| `DATABASE_URL` | Your Turso URL | `libsql://interview-portal-xxx.turso.io` |
| `DATABASE_AUTH_TOKEN` | Your Turso token | `eyJhb...` |
| `NEXTAUTH_SECRET` | Random 32-char string | run `openssl rand -hex 32` in terminal |
| `NEXTAUTH_URL` | Your Vercel app URL | `https://interview-portal-xxx.vercel.app` |
| `GEMINI_API_KEY` | Your Gemini API key | `AIzaSy...` |
| `CRON_SECRET` | Random string | run `openssl rand -hex 32` in terminal |
| `COMPANY_NAME` | Your company name | `Acme Corp` |

#### Optional — Email notifications
| Name | Value |
|---|---|
| `SMTP_HOST` | `smtp.resend.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `resend` |
| `SMTP_PASS` | Your Resend API key |
| `SMTP_FROM` | `"Company <noreply@yourdomain.com>"` |

#### Optional — Redis (for instant AI rating)
| Name | Value |
|---|---|
| `REDIS_URL` | `rediss://default:xxx@xxx.upstash.io:6379` |

After adding all vars, go to **Deployments** → click the latest → **Redeploy**.

---

## Step 3 — Add GitHub Secrets (for CI/CD auto-deploy)

These 3 secrets let GitHub Actions automatically deploy to Vercel when you push to `main`.

### 3a. Get your Vercel credentials
1. **VERCEL_TOKEN** — Go to https://vercel.com/account/tokens → "Create" → copy
2. **VERCEL_ORG_ID** and **VERCEL_PROJECT_ID** — Run this in the repo:
   ```bash
   npx vercel link
   # Follow prompts to link to your project
   # Then read .vercel/project.json — it has orgId and projectId
   cat .vercel/project.json
   ```

### 3b. Add to GitHub
Go to your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret name | Where to get it |
|---|---|
| `VERCEL_TOKEN` | Vercel account settings → Tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` → `orgId` |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` → `projectId` |

> **Note:** `.vercel/project.json` is gitignored — it's only on your local machine.
> Never commit it.

After adding these 3 secrets, every push to `main` will auto-deploy via GitHub Actions.

---

## Step 4 — Run database migrations

Do this once after Vercel is set up:

```bash
# In your local terminal, with the Turso vars set:
DATABASE_URL="libsql://interview-portal-xxx.turso.io" \
DATABASE_AUTH_TOKEN="your-token" \
npx prisma migrate deploy

# Create the first admin user:
DATABASE_URL="libsql://interview-portal-xxx.turso.io" \
DATABASE_AUTH_TOKEN="your-token" \
ADMIN_EMAIL="you@example.com" \
ADMIN_PASSWORD="your-strong-password" \
npx tsx prisma/seed.ts
```

---

## Step 5 — Verify it works

1. Visit `https://your-app.vercel.app/login`
2. Log in with the admin email/password you used in the seed step
3. Create a test → generate questions → send invite → complete the interview
4. Wait ~60 seconds → check `/results` — AI scores should appear (via the cron job)

---

## How the cron job works

[`src/app/api/cron/rate-interviews/route.ts`](src/app/api/cron/rate-interviews/route.ts)
is called by Vercel every minute (configured in [`vercel.json`](vercel.json)).

- Finds the oldest completed interview with no AI score
- Rates all questions in parallel using Gemini
- Updates scores in Turso and optionally emails the recruiter
- **No separate worker process needed — Vercel runs it automatically**
