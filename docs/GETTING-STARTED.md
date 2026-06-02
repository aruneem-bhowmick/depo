# Getting Started

This guide covers local setup and production deployment.

---

## Prerequisites

- **Node.js** ≥ 18 and **npm** ≥ 9
- A **GitHub account**
- A **GitHub OAuth App** (created below)

---

## 1. Create a GitHub OAuth app

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

## 2. Clone and install

```bash
git clone https://github.com/AruneemB/depo.git
cd depo
npm install
```

---

## 3. Configure environment variables

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

## 4. Run locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000). You will see the Depo landing page with a "Sign in with GitHub" button.

**How the sign-in flow works**:
1. The server generates a random CSRF nonce, stores it in an `httpOnly` `depo_oauth_state` cookie, and renders the OAuth URL containing the same nonce as `state`.
2. Clicking "Sign in with GitHub" navigates to GitHub, which asks you to authorise the `public_repo` and `delete_repo` scopes.
3. GitHub redirects back to `http://localhost:3000/api/auth/callback` with a `code` and the `state` you sent.
4. The callback validates `state` against the `depo_oauth_state` cookie, exchanges `code` for an access token, writes the session, and redirects to `/repos`.

If anything goes wrong (state mismatch, bad code, network error), you are redirected to `/?error=auth_failed` and shown an inline error message. You can simply click "Sign in with GitHub" again to restart the flow.

---

## Configuration notes

**`next.config.ts` uses TypeScript**: Depo's Next.js config file is `next.config.ts`, not `next.config.mjs`. Do not rename it — the ts-jest path alias resolution and TypeScript tooling expect the `.ts` extension.

**GitHub avatar image domain**: `next.config.ts` allowlists `avatars.githubusercontent.com` under `images.domains`. This allows Next.js's `<Image>` component to proxy and optimize GitHub profile pictures. Removing this entry causes avatar images to fail with a Next.js `400` error.

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
