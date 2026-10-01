# Expense Tracker

## Progress

- Added Supabase authentication and per-user cloud sync.
- Changed expense and utility-bill sync to write only the record created, changed, or deleted. Notes sync separately.
- Added expense editing and custom categories, synced per user across devices.
- Kept browser-local storage as a cache and added paginated cloud reads for larger histories.
- Added the Supabase table setup, row-level security policies, and legacy-data migration in [supabase-schema.sql](supabase-schema.sql).

## Remaining

- Run the updated `supabase-schema.sql` in the Supabase SQL Editor before deploying. It creates the custom-category table and migrates records from `expense_tracker_data` when that table exists.
- Verify the migrated records, configure the Supabase URL/key and authentication redirect URL, then deploy and test the app.
