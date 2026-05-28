# Getting Started

This guide covers everything you need to run Depo locally and deploy it to production.

---

## Prerequisites

- **Node.js** ≥ 18 and **npm** ≥ 9
- A **GitHub account**
- A **GitHub OAuth App** (created below)

---

## 1. Create a GitHub OAuth App

Depo authenticates users via GitHub OAuth and requests `public_repo` + `delete_repo` scopes.

1. Go to **GitHub → Settings → Developer Settings → OAuth Apps → New OAuth App**
2. Fill in the fields:

   | Field | Value |
   |-------|-------|
   | **Application name** | `Depo` (or anything you like) |
   | **Homepage URL** | `http://localhost:3000` (update after deploying) |
   | **Authorization callback URL** | `http://localhost:3000/api/auth/callback` |

3. Click **Register application**
4. On the next screen, copy the **Client ID**
5. Click **Generate a new client secret** and copy the secret immediately — it is only shown once

> **Note on the `delete_repo` scope**: GitHub shows users a prominent warning when granting this scope. This is expected behavior and is intentional — Depo is a destructive-action tool and the friction is a feature.

---

## 2. Clone and Install

```bash
git clone https://github.com/AruneemB/depo.git
cd depo
npm install
```

---

## 3. Configure Environment Variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in each value:

```bash
# From your GitHub OAuth App page
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here

# A random 32+ character string used to encrypt the session cookie
# Generate one with: openssl rand -base64 32
SESSION_SECRET=your_random_secret_here

# The full URL of this app — no trailing slash
# For local development:
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Never commit `.env.local`.** It is already in `.gitignore`.

---

## 4. Run Locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000). Sign in with GitHub to test the full OAuth flow.

---

## Deploying to Vercel

Vercel is the recommended deployment target — `vercel.json` is already configured with a 60-second timeout on the delete route for large batches.

1. Push the repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo
3. In the project's **Settings → Environment Variables**, add all four variables from `.env.example`:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `SESSION_SECRET`
   - `NEXT_PUBLIC_APP_URL` — set to your Vercel deployment URL (e.g., `https://depo.vercel.app`)
4. Deploy
5. Go back to your GitHub OAuth App settings and update:
   - **Homepage URL** → your Vercel URL
   - **Authorization callback URL** → `https://your-deployment.vercel.app/api/auth/callback`
