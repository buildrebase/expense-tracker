-- Run this script in the Supabase SQL Editor.
-- It creates the normalized tables used by the app and migrates data from
-- expense_tracker_data when that legacy table exists. Existing Auth accounts
-- need the local scripts/migrate-existing-users.ts migration before username login.

create table if not exists public.expense_tracker_expenses (
	user_id uuid not null references auth.users(id) on delete cascade,
	id bigint not null,
	amount numeric not null check (amount > 0),
	category text not null,
	note text not null default '',
	date date not null,
	primary key (user_id, id)
);

create table if not exists public.expense_tracker_utility_bills (
	user_id uuid not null references auth.users(id) on delete cascade,
	id bigint not null,
	name text not null,
	start_month text not null,
	due_day smallint not null default 1,
	months jsonb not null default '{}'::jsonb,
	primary key (user_id, id)
);

create table if not exists public.expense_tracker_notes (
	user_id uuid primary key references auth.users(id) on delete cascade,
	content text not null default ''
);

create table if not exists public.expense_tracker_categories (
	user_id uuid not null references auth.users(id) on delete cascade,
	name text not null check (char_length(btrim(name)) between 1 and 32),
	primary key (user_id, name)
);

create table if not exists public.expense_tracker_profiles (
	user_id uuid primary key references auth.users(id) on delete cascade,
	username text not null unique check (username = lower(btrim(username)) and username ~ '^[a-z0-9_]{3,24}$')
);

create table if not exists public.expense_tracker_signup_attempts (
	ip_hash text not null,
	created_at timestamptz not null default now()
);

alter table public.expense_tracker_expenses enable row level security;
alter table public.expense_tracker_utility_bills enable row level security;
alter table public.expense_tracker_notes enable row level security;
alter table public.expense_tracker_categories enable row level security;
alter table public.expense_tracker_profiles enable row level security;
alter table public.expense_tracker_signup_attempts enable row level security;

grant select, insert, update, delete on public.expense_tracker_expenses to authenticated;
grant select, insert, update, delete on public.expense_tracker_utility_bills to authenticated;
grant select, insert, update, delete on public.expense_tracker_notes to authenticated;
grant select, insert, update, delete on public.expense_tracker_categories to authenticated;
revoke all on public.expense_tracker_profiles from anon, authenticated;
revoke all on public.expense_tracker_signup_attempts from anon, authenticated;
grant all on public.expense_tracker_profiles to service_role;
grant all on public.expense_tracker_signup_attempts to service_role;

create or replace function public.expense_tracker_allow_signup(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
	recent_attempts integer;
begin
	perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_ip_hash));
	delete from public.expense_tracker_signup_attempts
	where ip_hash = p_ip_hash and created_at < pg_catalog.now() - interval '1 hour';
	select count(*) into recent_attempts
	from public.expense_tracker_signup_attempts
	where ip_hash = p_ip_hash and created_at >= pg_catalog.now() - interval '1 hour';
	if recent_attempts >= 5 then
		return false;
	end if;
	insert into public.expense_tracker_signup_attempts (ip_hash) values (p_ip_hash);
	return true;
end;
$$;

revoke all on function public.expense_tracker_allow_signup(text) from public, anon, authenticated;
grant execute on function public.expense_tracker_allow_signup(text) to service_role;

drop policy if exists "Users manage their own expenses" on public.expense_tracker_expenses;
create policy "Users manage their own expenses"
	on public.expense_tracker_expenses for all to authenticated
	using ((select auth.uid()) = user_id)
	with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own utility bills" on public.expense_tracker_utility_bills;
create policy "Users manage their own utility bills"
	on public.expense_tracker_utility_bills for all to authenticated
	using ((select auth.uid()) = user_id)
	with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own notes" on public.expense_tracker_notes;
create policy "Users manage their own notes"
	on public.expense_tracker_notes for all to authenticated
	using ((select auth.uid()) = user_id)
	with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own categories" on public.expense_tracker_categories;
create policy "Users manage their own categories"
	on public.expense_tracker_categories for all to authenticated
	using ((select auth.uid()) = user_id)
	with check ((select auth.uid()) = user_id);

-- Migrate existing data once. This block safely does nothing for new projects
-- without the legacy expense_tracker_data table. It is safe to run repeatedly.
do $$
begin
	if to_regclass('public.expense_tracker_data') is not null then
		execute $migration$
			insert into public.expense_tracker_expenses (user_id, id, amount, category, note, date)
			select d.user_id,
				(item.value->>'id')::bigint,
				(item.value->>'amount')::numeric,
				coalesce(item.value->>'cat', 'Other'),
				coalesce(item.value->>'note', ''),
				(item.value->>'date')::date
			from public.expense_tracker_data d
			cross join lateral jsonb_array_elements(coalesce(d.expenses, '[]'::jsonb)) as item(value)
			on conflict (user_id, id) do nothing;

			insert into public.expense_tracker_utility_bills (user_id, id, name, start_month, due_day, months)
			select d.user_id,
				(item.value->>'id')::bigint,
				item.value->>'name',
				item.value->>'startMonth',
				coalesce(nullif(item.value->>'dueDay', '')::smallint, 1),
				coalesce(item.value->'months', '{}'::jsonb)
			from public.expense_tracker_data d
			cross join lateral jsonb_array_elements(coalesce(d.utility_bills, '[]'::jsonb)) as item(value)
			on conflict (user_id, id) do nothing;

			insert into public.expense_tracker_categories (user_id, name)
			select distinct on (d.user_id, lower(btrim(item.value->>'cat')))
				d.user_id, btrim(item.value->>'cat')
			from public.expense_tracker_data d
			cross join lateral jsonb_array_elements(coalesce(d.expenses, '[]'::jsonb)) as item(value)
			where nullif(btrim(item.value->>'cat'), '') is not null
				and lower(btrim(item.value->>'cat')) not in ('food', 'transport', 'bills', 'shopping', 'health', 'fun', 'other')
			order by d.user_id, lower(btrim(item.value->>'cat')), btrim(item.value->>'cat')
			on conflict (user_id, name) do nothing;

			insert into public.expense_tracker_notes (user_id, content)
			select user_id, coalesce(notes, '')
			from public.expense_tracker_data
			on conflict (user_id) do nothing;
		$migration$;
	end if;
end
$$;
