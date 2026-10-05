# Expense Tracker

## Progress

- Added Supabase authentication and per-user cloud sync.
- Changed expense and utility-bill sync to write only the record created, changed, or deleted. Notes sync separately.
- Added expense editing and custom categories, synced per user across devices.
- Kept browser-local storage as a cache and added paginated cloud reads for larger histories.
- Added a receipt-and-check logo for the app header, browser tab, and home-screen icons.
- Added the Supabase table setup, row-level security policies, and legacy-data migration in [supabase-schema.sql](supabase-schema.sql).

## How to Use

1. Create an account or sign in to sync your data across devices.
2. Select **Add expense**, enter an amount, choose a category, and save. To add your own category, enter its name in **Add a category** and select **Add**.
3. Use the edit icon on an expense to change it, or the delete icon to remove it.
4. Open **Utility** to add monthly bills and update their amount or paid status.
5. Open **Notes** to write reminders; notes save automatically.
6. Use the month arrows to browse history. Select a category in the chart to filter expenses, then choose **Show all** to clear the filter.

## Add to Home Screen

- **iPhone or iPad:** Open the deployed app in Safari, tap **Share**, then **Add to Home Screen**.
- **Android:** Open the deployed app in Chrome, open the menu, then tap **Install app** or **Add to Home screen**.

Use the deployed HTTPS address. The app uses the Apple touch icon on iOS and the web app manifest icons on Android.

## Remaining

- Run the updated `supabase-schema.sql` in the Supabase SQL Editor before deploying. It creates the custom-category table and migrates records from `expense_tracker_data` when that table exists.
- Verify the migrated records, configure the Supabase URL/key and authentication redirect URL, then deploy and test the app.
