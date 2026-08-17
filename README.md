# Stratium BD CRM — standalone setup

This is your CRM as a real, always-on web app with a login, instead of a
Claude artifact. It costs $0/month on the free tiers described below.

You need two accounts: **Supabase** (your private database + login) and
**Vercel** (hosting). Both are free for this use case.

---

## 1. Create your Supabase project

1. Go to https://supabase.com -> **Start your project** -> sign up (GitHub or
   email is fine).
2. Click **New project**. Give it a name (e.g. `stratium-crm`), set a
   database password (save it somewhere -- you won't need it day-to-day, but
   keep it), pick the region closest to you, and create it. It takes ~2
   minutes to provision.
3. Once it's ready, go to **SQL Editor** (left sidebar) -> **New query**.
   Paste in the contents of `sql/schema.sql` from this project and click
   **Run**. This creates the one table the CRM uses and locks it down so
   only your logged-in account can ever read or write your rows.
3a. Run a second query the same way with `sql/storage_setup.sql` -- this
   creates a private file storage bucket for candidate CVs (original +
   formatted), locked to your account the same way. Free tier includes
   500MB-1GB of file storage, more than enough for CVs.
4. Go to **Authentication -> Users** (left sidebar) -> **Add user** ->
   **Create new user**. Enter the email and password you want to log in
   with. Leave "Auto Confirm User" checked. This is the *only* account that
   will exist -- there's no public sign-up screen in the app, so no one else
   can register.
5. Go to **Project Settings -> API**. You'll need two values from this page
   in step 3 below:
   - **Project URL**
   - **anon / public** key (NOT the `service_role` key -- never use that one
     in a browser app)

## 2. Put the code on GitHub

1. Go to https://github.com -> sign up if you don't have an account.
2. Create a new empty repository (e.g. `stratium-crm`) -- don't initialize it
   with a README, you already have one.
3. Easiest path with no local git setup: on the new repo's page, click
   **uploading an existing file**, then drag in every file and folder from
   this project (keep the folder structure -- `src/`, `sql/`, `.env.example`,
   `package.json`, etc.) and commit.
   - If you're comfortable with git/terminal instead, the usual `git init`,
     `git remote add origin <repo-url>`, `git push` works too.
4. **Do not commit your real `.env` file** -- it's already listed in
   `.gitignore` so git won't pick it up by default. Only `.env.example`
   (which has placeholder values) should go up.

## 3. Deploy on Vercel

1. Go to https://vercel.com -> sign up, and choose **Continue with GitHub**
   so it can see your repos.
2. Click **Add New -> Project**, find your `stratium-crm` repo, click
   **Import**. Vercel auto-detects it's a Vite project -- leave the build
   settings as default.
3. Before clicking Deploy, expand **Environment Variables** and add:
   - `VITE_SUPABASE_URL` = the Project URL from Supabase step 1.5
   - `VITE_SUPABASE_ANON_KEY` = the anon/public key from Supabase step 1.5
   - `VITE_WORKSPACE_ID` = your own Supabase Auth User UID (Authentication ->
     Users -> your account -> copy the User UID). This is the shared
     workspace every login reads/writes under -- set once, never changes.
     If you're running `sql/shared_workspace.sql` for multi-user access,
     every teammate's login still points at this same ID.
4. Click **Deploy**. In under a minute you'll get a live URL like
   `stratium-crm.vercel.app`. Open it, sign in with the email/password you
   created in Supabase step 1.4 -- you're live.

## 4. Use your own domain instead of the vercel.app link

Since you already own a domain, you don't need the `.vercel.app` address --
point a subdomain at it instead (e.g. `crm.yourdomain.com`). This costs
nothing extra; you're not buying anything new, just adding a DNS record to
the domain you already have.

1. In your Vercel project, go to **Settings -> Domains** -> enter the
   subdomain you want (e.g. `crm.yourdomain.com`) -> **Add**.
2. Vercel will show you a DNS record to create -- normally a **CNAME**
   record:
   - **Name/Host:** `crm` (just the subdomain part)
   - **Value/Target:** `cname.vercel-dns.com`
3. Go to wherever you manage DNS for your domain (your registrar or DNS
   host -- GoDaddy, Namecheap, Cloudflare, etc.), find the DNS settings, and
   add that exact CNAME record.
4. Back in Vercel, wait for the domain to show **Valid Configuration**
   (usually a few minutes, occasionally up to a few hours depending on DNS
   propagation). Vercel issues the SSL certificate for it automatically --
   no extra step needed.
5. From then on, `crm.yourdomain.com` opens your CRM directly.

Your root domain (`yourdomain.com`) and everything else on it are
untouched -- you're only adding one new subdomain record.

## Day-to-day use

- Every time you push a change to the GitHub repo (or ask me to), Vercel
  redeploys automatically -- no manual steps.
- Your data lives in Supabase, tied to your account. Nobody else can see it
  unless you give them a login.
- If you ever want a second consultant back on the desk with their own
  login, repeat step 1.4 to create their Supabase user -- the app's
  Consultant selector already supports it.

## Local development (optional)

If you ever want to run it on your own machine before deploying:

```
cp .env.example .env      # then fill in your real Supabase values
npm install
npm run dev
```
