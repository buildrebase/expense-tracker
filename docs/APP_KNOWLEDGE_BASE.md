# Expense Tracker Knowledge Base

**Last reviewed:** 2026-10-07

This is the working architecture and operations reference for the app. Update the relevant sections and append a dated entry to [Change Log](#change-log) whenever application behavior, schema, authentication, or deployment state changes. Keep **implemented locally** separate from **confirmed deployed**.

## Project Overview

A static, mobile-first expense tracker deployed on Vercel. The browser app uses Supabase Auth and the Supabase Postgres REST API; there is no frontend framework, bundler, or package manifest. Vercel serves `index.html` and the static files directly. Supabase JS v2 is loaded from jsDelivr.

## Folder Map

| Path | Responsibility |
| --- | --- |
| [index.html](../index.html) | Static document, app/auth forms, tabs, dialogs, script and asset references. Vercel entry point; keep at repository root. |
| [src/app.js](../src/app.js) | UI rendering, local cache, username auth, expense/bill/budget operations, Supabase reads/writes. |
| [src/styles.css](../src/styles.css) | Layout, responsive rules, themes, charts, sheets, budget progress styling. |
| [assets/logo.svg](../assets/logo.svg) | Vector brand mark and browser favicon. |
| [assets/manifest.webmanifest](../assets/manifest.webmanifest) | PWA name, standalone display settings, Android icon definitions. |
| [assets/icons](../assets/icons) | 180px Apple touch icon and 192px/512px Android icons. |
| [supabase/setup.sql](../supabase/setup.sql) | Tables, RLS, grants, signup rate-limit function, and legacy JSON-row migration. Run in Supabase SQL Editor when schema changes. |
| [supabase/config.toml](../supabase/config.toml) | Local Supabase CLI project and Edge Function config. |
| [supabase/functions/username-signup/index.ts](../supabase/functions/username-signup/index.ts) | Public, rate-limited username signup endpoint. Admin/service key stays server-side. |
| [scripts/migrate-existing-users.ts](../scripts/migrate-existing-users.ts) | Optional, privileged, one-time conversion of existing email Auth accounts to internal aliases and usernames. Not used for the selected fresh-signup rollout. |
| [scripts/generate-reset-link.ts](../scripts/generate-reset-link.ts) | Admin utility to generate a one-time recovery link after a support request is verified. |
| [README.md](../README.md) | Short user guide, main setup instructions, and home-screen install steps. |

Supabase CLI creates local files in `supabase/.temp/`; treat those as CLI-generated state rather than application source.

## UI and Behavior

The bottom tabs are **Expenses**, **Utility**, **Budget**, and **Notes**. The month navigation is shared: moving month in a view changes the `view` date used by expense, bill, and budget rendering.

- **Expenses:** monthly total, category donut/legend, category filter, dated expense list, add/edit/delete.
- **Utility:** recurring bill definitions with month-specific amounts and paid/due status.
- **Budget:** one optional overall limit and optional per-category limits for each `YYYY-MM`; displays spend, remaining amount, and over-budget state. The overall budget uses the sentinel category `__overall__`.
- **Insights:** compares the selected month with its predecessor, charts totals for six months ending at the selected month, and compares category spending across the two selected months. It is derived from already-loaded expense records; no extra table or schema migration is needed.
- **Notes:** one auto-saved notes document per account.
- **Categories:** built-ins are in `CATS`; user-defined labels are persisted and synced per user. Unknown custom categories use fallback emoji/color.

The floating action button changes by tab: add expense, add monthly bill, or set budget; it is hidden for Notes.

### Common Change Map

| Change request | Main code to inspect/update |
| --- | --- |
| Add or change an expense field | `src/app.js`: `openSheet`, save handler, `render`, `expenseRow`; if persisted as a new DB column, also update `supabase/setup.sql` and cloud hydration. |
| Add or change a tab/view | `index.html` tab/view markup; `src/app.js`: `tab`, relevant renderer, month handlers; `src/styles.css`. |
| Change spending comparisons | `src/app.js`: `renderInsights`; uses `items` and the shared `view` month. No database changes for derived comparisons. |
| Add another per-user cloud entity | `supabase/setup.sql`: table, primary key, RLS, grants; `src/app.js`: per-user cache, hydration, bootstrap, upsert/delete; README and this file. |
| Add a static image/icon | Put it under `assets/`, update `index.html` or `assets/manifest.webmanifest`, and check every referenced path. |
| Change username signup | `supabase/functions/username-signup/index.ts`; deploy with Supabase CLI after testing. |
| Change password recovery | `index.html` reset form, `src/app.js` recovery event handler, `scripts/generate-reset-link.ts`, Supabase redirect URL settings. |
| Add/change a database function or policy | `supabase/setup.sql`; rerun the updated script in the intended Supabase project and inspect SQL Editor warnings before confirming. |

## Authentication and Account Safety

The visible signup/login form accepts a username and password only. Supabase password auth still requires an email-shaped identifier internally, so the app derives `${username}@accounts.expense-tracker.invalid`. It is not a real, deliverable user email.

- Username shape: 3–24 lowercase letters, digits, or underscores (`[a-z0-9_]{3,24}`). Login lowercases the entered name.
- The canonical username is `public.expense_tracker_profiles.username`, unique across the project. The username is also copied to Auth user metadata.
- Signup calls the `username-signup` Edge Function. It validates input, hashes the caller IP with HMAC, invokes `expense_tracker_allow_signup` (limit: 5 attempts/IP hash/hour), creates a confirmed Auth user through the Admin API, and inserts the profile. The function's service-role key must never enter browser code.
- After signup, browser code signs in with the derived internal alias and password.
- Sign-out resets the UI to Sign in. Password recovery uses `mailto:` to ask the app support contact for help; an administrator verifies the request, generates a one-time link with the local script, and sends it manually. The app never sends or reveals a password.
- Existing accounts are **not** converted by `setup.sql`. `migrate-existing-users.ts` changes Auth emails to internal aliases and prints a username mapping while preserving passwords. This is a privileged and user-impacting operation. The selected rollout is fresh signup, so skip that script unless the owner later chooses to migrate existing accounts.

## Data Model

All app data rows are owned by an Auth `user_id`; RLS policies compare it to `auth.uid()`. `expense_tracker_profiles` is intentionally not readable by `anon` or `authenticated`; the signup Edge Function and local admin scripts access it with service role.

| Table | Key and data |
| --- | --- |
| `expense_tracker_expenses` | `(user_id, id)`; amount, category, note, date. Individual inserts/updates/deletes sync one expense row. |
| `expense_tracker_utility_bills` | `(user_id, id)`; name, start month, due day, JSONB month states. Editing amount/status upserts only that bill row. |
| `expense_tracker_notes` | `user_id`; one text document per user. |
| `expense_tracker_categories` | `(user_id, name)`; custom category names. |
| `expense_tracker_budgets` | `(user_id, month, category)`; numeric positive limit. Month must be `YYYY-MM`; `__overall__` means overall budget. |
| `expense_tracker_profiles` | `user_id`; unique normalized username. Client roles have no access. |
| `expense_tracker_signup_attempts` | HMAC IP hash and timestamp for the signup throttle. Client roles have no access. |

`setup.sql` also migrates expenses, bills, custom categories, and notes from `expense_tracker_data` if that legacy table exists. Inserts use `ON CONFLICT DO NOTHING`; it does not drop the legacy table. This JSON migration does not move Auth identity or make old rows visible to a different `user_id`.

### Local Cache and Cloud Load

Browser cache names are namespaced as `<key>:<Supabase user id>` after authentication. Keys include `expenses-v1`, `utility-bills-v2`, `expense-categories-v1`, `expense-budgets-v1`, and `notes-v1`. Legacy unscoped keys are read for local-only/old-client compatibility, but after an authenticated session `loadUserCache(userId)` replaces in-memory data with that account's scoped cache. Thus a fresh account does not import another account's browser cache.

On sign-in, expenses, bills, budgets, categories, and notes are fetched for the current user. If cloud data exists, it becomes the account's cache. If all cloud entities are empty, that user's scoped cache can bootstrap the cloud; new accounts have no scoped cache and start empty. Expense and bill reads are paginated in batches of 1,000; budget reads are similarly paginated.

This app does not currently use Supabase Realtime. Sync is action-based. Concurrent edits from multiple devices can still overwrite the same user's matching row (or notes document), though unrelated expense rows do not replace each other.

## Database Script and Warning

Run the full current [setup.sql](../supabase/setup.sql) before deploying code that relies on a newly added table, including budgets. It creates tables and policies, grants authenticated CRUD only where intended, and defines the signup throttle function.

The Supabase SQL Editor may show its destructive-operation warning because the script has `DROP POLICY` statements before recreating named per-user policies and contains a `DELETE` inside the signup throttle function. The policy statements replace those named policies. The function's delete only prunes expired throttle rows when signup checks run; it does not delete expenses or bills. The script also uses `ON DELETE CASCADE` foreign keys so account deletion can clean up that account's app rows. Read the whole script before confirming it. Re-running it does not drop app tables, but it does recreate the named policies and may re-run the legacy migration.

## Deployment and Local Checks

1. Back up if preserving existing production accounts/data matters; for the selected fresh-signup approach, do not run `migrate-existing-users.ts`.
2. Run the latest `supabase/setup.sql` in the correct Supabase project's SQL Editor.
3. Deploy the signup function: `supabase functions deploy username-signup --project-ref <project-ref>`.
4. Ensure the Vercel HTTPS URL is allowed in Supabase Auth redirect settings; deploy the latest static files to Vercel.
5. Test a new username signup, sign-out/sign-in, expense create/edit/delete, custom category, budget create/edit/delete, and recovery-link flow.

Verified in this workspace during the current work: Supabase CLI 2.120.0 and Deno 2.9.7 were available; `deno check src/app.js scripts/migrate-existing-users.ts scripts/generate-reset-link.ts supabase/functions/username-signup/index.ts` passed after the budget implementation. The `username-signup` deploy command returned exit code 0 in the terminal history.

**Not confirmed here:** whether the latest `setup.sql` was successfully run in the remote Supabase project, whether the latest static app was redeployed to Vercel, or whether signup/recovery/budgets were exercised against the live project. The user selected fresh signup; existing-account migration is intentionally skipped.

## Maintenance Rule

After each feature or operational milestone, update:

1. The relevant section above if architecture, flow, schema, setup, or change ownership moved.
2. The deployment/check status if a command was run or a remote step was confirmed. Never mark SQL/function/Vercel as deployed unless there is explicit command/result evidence.
3. The dated log below with a short entry. Do not store passwords, service-role keys, access tokens, or other secrets here.

## Change Log

- **2026-10-07:** Added Insights with current-vs-previous-month totals, six-month spending trend, and category comparisons. Calculations use existing expense records; no SQL change.
- **2026-10-07:** Added monthly overall/category budgets with per-user cache and Supabase sync; added `expense_tracker_budgets` table/RLS to `supabase/setup.sql`; updated README usage and setup notes. Deno check passed. Remote SQL/Vercel deployment remain unconfirmed.
- **2026-10-07:** Namespaced browser data by Supabase user ID to prevent fresh accounts from importing another account's shared local cache; gated first render while checking cloud session.
- **2026-10-07:** Organized static app source under `src/`, brand assets under `assets/`, Supabase files under `supabase/`, and admin scripts under `scripts/`; updated entry-point and manifest paths.
- **2026-10-07:** Added username/password login, a signup Edge Function, optional existing-user migration, support-mediated password reset-link tools, and the private username profile schema. The fresh-signup path was selected; do not run the existing-user migration unless that decision changes.
- **2026-10-05:** Added edit-expense and custom-category support, persisted per user in Supabase; added app logo and home-screen metadata/icons.
- **2026-10-01:** Replaced whole-state expense/bill cloud saves with per-row mutations and paginated cloud reads; added schema/migration SQL in its own file.
