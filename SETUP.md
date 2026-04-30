# Context Layer — Environment Setup Guide

This guide explains how to fill in the `.env` files. You'll need to touch three files:

- `apps/api/.env` (copy from `apps/api/.env.example`)
- `apps/workers/.env` (copy from `apps/workers/.env.example`)
- `apps/web/.env` (copy from `apps/web/.env.example`)

Each section below tells you exactly where to get each value.

---

## 1. Clerk — Authentication

Clerk handles user sign-in, organizations, and session tokens.

**How to get these values:**

1. Go to [clerk.com](https://clerk.com) and create a free account.
2. Create a new application. Name it "Context Layer".
3. On the left sidebar, click **API Keys**.
4. You'll see two keys displayed:
   - **Publishable Key** — starts with `pk_test_` (safe to share publicly)
   - **Secret Key** — starts with `sk_test_` (keep this private — never commit to git)

**Where to put them:**

In `apps/api/.env`:
```
CLERK_SECRET_KEY=sk_test_your_key_here
CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
```

In `apps/web/.env`:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here
```

**One more step — set up a webhook:**

Context Layer needs to know when a new organization signs up so it can create an account in the database.

1. In Clerk, go to **Webhooks** in the left sidebar.
2. Click **Add Endpoint**.
3. Enter the URL: `http://localhost:3001/webhooks/clerk` (for local dev) or your production API URL.
4. Under **Events**, select `organization.created`.
5. Click **Create**. Copy the **Signing Secret** shown.
6. Add it to `apps/api/.env`:
   ```
   CLERK_WEBHOOK_SECRET=whsec_your_signing_secret
   ```

---

## 2. Supabase — Database

Supabase hosts the PostgreSQL database.

**How to get these values:**

1. Go to [supabase.com](https://supabase.com) and create a free account.
2. Click **New project**. Choose a name and a strong database password (save this somewhere).
3. Wait for the project to finish setting up (about 2 minutes).
4. On the left sidebar, click **Settings** → **Database**.
5. Scroll down to **Connection string**. Select the **URI** tab.
6. Copy the connection string. It looks like:
   ```
   postgresql://postgres:your-password@db.xxxx.supabase.co:5432/postgres
   ```

**Where to put it:**

In `apps/api/.env` and `apps/workers/.env`:
```
DATABASE_URL=postgresql://postgres:your-password@db.xxxx.supabase.co:5432/postgres
DATABASE_SSL=true
```

> **Important:** You must also enable the `pgvector` extension. In Supabase, go to
> **Database** → **Extensions**, search for "vector", and enable it.

---

## 3. Upstash Redis — Background Jobs & Caching

Upstash is a serverless Redis service used for job queues and caching.

**How to get these values:**

1. Go to [upstash.com](https://upstash.com) and create a free account.
2. Click **Create Database**. Choose a region close to you.
3. After creation, click on your database. Go to the **Details** tab.
4. Find the **Redis URL** — it looks like:
   ```
   redis://default:password@us1-xxxx.upstash.io:6379
   ```
   or for TLS: `rediss://default:password@...`

**Where to put it:**

In `apps/api/.env` and `apps/workers/.env`:
```
REDIS_URL=redis://default:your-password@your-host.upstash.io:6379
```

> **For local development:** If you're running the Docker Compose setup (`bash infrastructure/docker/docker-compose.dev.sh`),
> you can use `redis://localhost:6379` instead and skip Upstash entirely.

---

## 4. Anthropic — AI (Claude)

Used for analyzing reports and extracting metric definitions.

**How to get this value:**

1. Go to [console.anthropic.com](https://console.anthropic.com) and sign in.
2. Click **API Keys** in the left sidebar.
3. Click **Create Key**. Give it a name like "Context Layer".
4. Copy the key — it starts with `sk-ant-`.

**Where to put it:**

In `apps/api/.env` and `apps/workers/.env`:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

---

## 5. OpenAI — Embeddings (for semantic field search)

Context Layer uses vector embeddings to power semantic search (e.g., "find all fields related to ARR" returns the right field even if it's named `Annual_Revenue__c`). This requires an OpenAI API key.

**How to get this value:**

1. Go to [platform.openai.com](https://platform.openai.com) and sign in.
2. Click your profile icon → **API Keys**.
3. Click **Create new secret key**. Give it a name like "Context Layer".
4. Copy the key — it starts with `sk-`.

> Note: The embeddings model (`text-embedding-3-small`) costs approximately $0.02 per million tokens. A typical Salesforce org with ~10,000 fields costs less than $0.10 to embed in full.

**Where to put it:**

In `apps/workers/.env`:
```
OPENAI_API_KEY=sk-your-key-here
```

> If `OPENAI_API_KEY` is missing, embeddings are silently skipped and semantic search won't work — but all other features (schema crawl, report analysis, MCP serving) still function.

---

## 6. Salesforce Connected App

This is what allows Context Layer to read your Salesforce data. You only need this when connecting a Salesforce org through the admin UI.

**How to create it:**

1. Log into Salesforce as an **Administrator**.
2. Click the gear icon ⚙ in the top-right → **Setup**.
3. In the left sidebar search box, type **App Manager** and click it.
4. Click **New Connected App** (top-right button).
5. Fill in:
   - **Connected App Name:** `Context Layer`
   - **Contact Email:** your email address
6. Check the box **Enable OAuth Settings**.
7. In the **Callback URL** field, paste:
   - Local dev: `http://localhost:3001/api/v1/connectors/salesforce/callback`
   - Production: `https://your-api-domain.com/api/v1/connectors/salesforce/callback`
8. Under **Selected OAuth Scopes**, add both:
   - `Access and manage your data (api)`
   - `Perform requests on your behalf at any time (refresh_token, offline_access)`
9. Click **Save** → **Continue**.
10. **Wait 2–10 minutes.** Salesforce takes time to activate the app.
11. Click **Manage Consumer Details**. Copy:
    - **Consumer Key** → this is your `SALESFORCE_CLIENT_ID`
    - **Consumer Secret** → this is your `SALESFORCE_CLIENT_SECRET`

**Where to put them:**

In `apps/api/.env`:
```
SALESFORCE_CLIENT_ID=your_consumer_key_here
SALESFORCE_CLIENT_SECRET=your_consumer_secret_here
SALESFORCE_REDIRECT_URI=http://localhost:3001/api/v1/connectors/salesforce/callback
```

---

## 7. HubSpot OAuth App

This is only needed when connecting a HubSpot account through the admin UI.

**How to create it:**

1. Go to [developers.hubspot.com](https://developers.hubspot.com) and log in with your HubSpot account.
2. Click **Manage Apps** → **Create app**.
3. Give it a name like `Context Layer` and click **Create app**.
4. Click the **Auth** tab on the app page.
5. Under **Redirect URLs**, click **Add redirect URL** and enter:
   - Local dev: `http://localhost:3001/api/v1/connectors/hubspot/callback`
   - Production: `https://your-api-domain.com/api/v1/connectors/hubspot/callback`
6. Under **Scopes**, click **Add new scope** and add each of the following:
   - `crm.objects.contacts.read`
   - `crm.objects.deals.read`
   - `crm.objects.companies.read`
   - `crm.schemas.contacts.read`
   - `crm.schemas.deals.read`
   - `crm.schemas.companies.read`
   - `crm.objects.owners.read`
7. Click **Save changes**.
8. At the top of the **Auth** tab, copy:
   - **Client ID** → this is your `HUBSPOT_CLIENT_ID`
   - **Client secret** → this is your `HUBSPOT_CLIENT_SECRET`

**Where to put them:**

In `apps/api/.env` and `apps/workers/.env`:
```
HUBSPOT_CLIENT_ID=your_client_id_here
HUBSPOT_CLIENT_SECRET=your_client_secret_here
HUBSPOT_REDIRECT_URI=http://localhost:3001/api/v1/connectors/hubspot/callback
```

> Note: The redirect URI in your .env must exactly match what you entered in step 5. Any mismatch causes OAuth to fail with "redirect_uri mismatch".

---

## 8. Credential Encryption Key

This key encrypts the Salesforce (and future connector) credentials before storing them in the database. Think of it like a master password for your database.

**Generate a secure key:**

Run this command in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output (it will look like a long string of random letters and numbers).

**Where to put it:**

In `apps/api/.env`:
```
CREDENTIAL_ENCRYPTION_KEY=the_64_character_hex_string_you_just_generated
```

> **Critical:** Never change this key after you've connected any systems. If you change it, all stored credentials will become unreadable. Store a backup of this key somewhere safe (like 1Password or your password manager).

---

## 8. Full .env File Examples

### `apps/api/.env`
```
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:your-password@db.xxxx.supabase.co:5432/postgres
DATABASE_SSL=true
REDIS_URL=redis://localhost:6379
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
ANTHROPIC_API_KEY=sk-ant-...
MEILISEARCH_URL=http://localhost:7700
MEILISEARCH_MASTER_KEY=dev_master_key_change_in_prod
CREDENTIAL_ENCRYPTION_KEY=your_64_char_hex_key_here
CORS_ORIGINS=http://localhost:3000
WEB_URL=http://localhost:3000
SALESFORCE_CLIENT_ID=your_consumer_key
SALESFORCE_CLIENT_SECRET=your_consumer_secret
SALESFORCE_REDIRECT_URI=http://localhost:3001/api/v1/connectors/salesforce/callback
HUBSPOT_CLIENT_ID=your_hubspot_client_id
HUBSPOT_CLIENT_SECRET=your_hubspot_client_secret
HUBSPOT_REDIRECT_URI=http://localhost:3001/api/v1/connectors/hubspot/callback
```

### `apps/workers/.env`
```
DATABASE_URL=postgresql://postgres:your-password@db.xxxx.supabase.co:5432/postgres
DATABASE_SSL=true
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
CREDENTIAL_ENCRYPTION_KEY=your_64_char_hex_key_here
HUBSPOT_CLIENT_ID=your_hubspot_client_id
HUBSPOT_CLIENT_SECRET=your_hubspot_client_secret
```

### `apps/web/.env`
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 8. After Updating .env Files

Whenever you change a `.env` file, you must **restart the affected service** for the changes to take effect:

- Changed `apps/api/.env` → restart the API (`Ctrl+C` in the API terminal, then run `pnpm dev` again from the `apps/api` folder, or restart the whole monorepo with `pnpm dev` from the root).
- Changed `apps/workers/.env` → restart the workers process.
- Changed `apps/web/.env` → restart the Next.js dev server.

---

## Common Mistakes

| Symptom | Likely cause |
|---|---|
| "Invalid environment variables" on API startup | A required value is missing or misspelled in `apps/api/.env` |
| Can't sign in | `CLERK_SECRET_KEY` or `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is wrong |
| Database connection error | `DATABASE_URL` is wrong, or `DATABASE_SSL=true` is missing for Supabase |
| Salesforce OAuth gives "invalid_client" | `SALESFORCE_CLIENT_ID` or `SALESFORCE_CLIENT_SECRET` is wrong, or the Connected App hasn't activated yet (wait 10 min) |
| Salesforce OAuth gives "redirect_uri_mismatch" | The `SALESFORCE_REDIRECT_URI` in your .env doesn't match the Callback URL you entered in Salesforce Setup |
| HubSpot OAuth gives "redirect_uri mismatch" | The `HUBSPOT_REDIRECT_URI` in your .env doesn't match the Redirect URL in your HubSpot app's Auth tab |
| HubSpot connector returns 501 | `HUBSPOT_CLIENT_ID` or `HUBSPOT_CLIENT_SECRET` is missing from `apps/api/.env` |
| Snowflake connection fails | Check the account identifier format — it should be `<account>.<region>` (e.g. `xy12345.us-east-1`), not the full URL |
| Gong gives "Invalid credentials" | The Access Key and Access Key Secret must both come from the same Gong API key pair; confirm they're not swapped |
| Jobs not processing | `REDIS_URL` is wrong, or Redis/Upstash isn't reachable |
