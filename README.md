# pocketledger / ExpensePro

A personal expense dashboard built with React, Node.js, and Supabase. Supabase Auth manages accounts, and PostgreSQL row-level security limits expense access to the signed-in user. The Vite client can be deployed as a static site on Vercel; the small Express function only retains a health endpoint and retires the previous local-file API.

## Local setup

1. Install Node.js 20 or newer and run `npm install`.
2. Copy `.env.example` to `.env.local` in the repository root and set:
   - `VITE_SUPABASE_URL`: the Supabase project URL.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: the project's browser-safe publishable key. A legacy anon key is also accepted. Never use a secret/service-role key in the client.
3. In the Supabase SQL Editor, run [`supabase/migrations/202610070001_expense_schema.sql`](./supabase/migrations/202610070001_expense_schema.sql).
4. In Supabase Authentication → URL Configuration, set the Site URL to your production domain and add that domain plus `http://localhost:5173` to the Redirect URLs allow-list. For Vercel, set `VITE_APP_URL` to the production origin (for example, `https://expense-gjae.vercel.app`) so signup confirmation, resend, and password-reset links return to the deployed app. Leave it unset locally to use the current local origin.
5. Run `npm run dev` and open `http://localhost:5173`. The UI talks directly to Supabase; `npm run dev:server` is optional and starts the Node health endpoint separately.

If the Supabase variables are not configured, the client shows setup instructions rather than silently falling back to local/demo data.

## Supabase signup email limits

The Supabase Auth email rate limit is enforced by the project's email provider, not by this React app. The app displays a sign-in shortcut when signup returns an email-rate-limit error; repeated signup attempts cannot bypass the provider limit. For an account that has already been created, sign in (or use the password-reset flow). For new signups, wait for the configured limit window to reset or configure custom SMTP and review the project's Authentication email rate-limit settings.

## Data and security

- Supabase Auth owns passwords and sessions. The app never stores credentials in spreadsheets or its Node API.
- Profiles are keyed to `auth.users`. Each expense has a required `user_id` and RLS policies require it to match `auth.uid()` for reads, creates, edits, and deletes.
- Categories and currencies are shared read-only reference tables; the migration seeds the requested categories and common currencies.
- Amounts are stored in their original currency. Reports and charts do not add unlike currencies or assume exchange rates.
- Apply schema changes using Supabase migrations/SQL Editor before deploying frontend changes that depend on them.

## Reports and sharing

Reports support daily, weekly, monthly, yearly, and custom date ranges. “Save as PDF” opens the browser print dialog, where a PDF can be saved. “Export Excel CSV” downloads a UTF-8 CSV file that opens in Excel. Email and WhatsApp sharing open the user's own mail or WhatsApp client with a text summary; no third-party credentials are embedded.

## Vercel

Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_APP_URL=https://expense-gjae.vercel.app` in the Vercel Production environment, then redeploy. Keep the repository root as the project root. The Supabase URL, publishable key, and app URL are public client configuration; access control is enforced by Supabase RLS, not by hiding these values. Never configure a secret/service-role key as a `VITE_` variable.

The former SQLite/XLSX-backed API and demo seed data are no longer used. Existing local SQLite or workbook records are not imported automatically; export and migrate any records you need before retiring those local files.
