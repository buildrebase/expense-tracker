# expense-tracker
Expnse tracker web-app

## Cloud Sync Setup

The app uses Supabase Auth and a per-user Postgres row to sync expenses, recurring utility bills, and notes across devices. Until configured, the app continues to work with browser-local storage.

1. Create a Supabase project.
2. In the Supabase SQL Editor, run:

```sql
create table if not exists public.expense_tracker_data (
	user_id uuid primary key references auth.users(id) on delete cascade,
	expenses jsonb not null default '[]'::jsonb,
	utility_bills jsonb not null default '[]'::jsonb,
	notes text not null default '',
	updated_at timestamptz not null default now()
);

alter table public.expense_tracker_data enable row level security;

create policy "Users can read their own expense data"
	on public.expense_tracker_data for select
	to authenticated
	using ((select auth.uid()) = user_id);

create policy "Users can insert their own expense data"
	on public.expense_tracker_data for insert
	to authenticated
	with check ((select auth.uid()) = user_id);

create policy "Users can update their own expense data"
	on public.expense_tracker_data for update
	to authenticated
	using ((select auth.uid()) = user_id)
	with check ((select auth.uid()) = user_id);
```

3. In `index.html`, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the Project URL and publishable/anon key from Supabase project settings. These are browser-visible values; never put a service-role key in the page. Row-level security protects each user's row.
4. In Supabase Authentication URL settings, add your Vercel deployment URL to the allowed site/redirect URLs. Email confirmation can remain enabled; new users will be prompted to confirm before signing in.
5. Deploy the updated page to Vercel and create an account in the app.

On first sign-in, if the account has no cloud record, data already stored in that browser is uploaded. If the account already has cloud data, that cloud record is loaded into the browser instead. Subsequent expense, bill, and notes changes sync automatically. Sign in with the same account on other devices to access the same data.

Keep a separate export/backup of important records; local storage remains a cache, but it is not a substitute for backups.
