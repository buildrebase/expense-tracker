# Expense Tracker

## Progress

- Added Supabase authentication and per-user cloud sync.
- Changed expense and utility-bill sync to write only the record created, changed, or deleted. Notes sync separately.
- Added expense editing and custom categories, synced per user across devices.
- Scoped browser caches by Supabase user ID so new accounts do not inherit another account's local records.
- Kept browser-local storage as a cache and added paginated cloud reads for larger histories.
- Added a receipt-and-check logo for the app header, browser tab, and home-screen icons.
- Replaced visible email sign-in with username/password accounts and a support-mediated password reset flow.
- Added the Supabase table setup, row-level security policies, and legacy-data migration in [supabase/setup.sql](supabase/setup.sql).

## How to Use

1. Create an account with a username and password, or sign in with those credentials. The app does not ask users for an email address.
2. Select **Add expense**, enter an amount, choose a category, and save. To add your own category, enter its name in **Add a category** and select **Add**.
3. Use the edit icon on an expense to change it, or the delete icon to remove it.
4. Open **Utility** to add monthly bills and update their amount or paid status.
5. Open **Notes** to write reminders; notes save automatically.
6. Use the month arrows to browse history. Select a category in the chart to filter expenses, then choose **Show all** to clear the filter.

## Add to Home Screen

- **iPhone or iPad:** Open the deployed app in Safari, tap **Share**, then **Add to Home Screen**.
- **Android:** Open the deployed app in Chrome, open the menu, then tap **Install app** or **Add to Home screen**.

Use the deployed HTTPS address. The app uses the Apple touch icon on iOS and the web app manifest icons on Android.

## Username Authentication Setup

New accounts use an internal, non-deliverable Auth identifier; users do not enter or need an email address.

1. Run `supabase/setup.sql` in the Supabase SQL Editor.
2. Deploy the public signup function:

	```sh
	supabase login
	supabase link --project-ref <project-ref>
	supabase functions deploy username-signup
	```

	The function uses Supabase’s server-side service-role secret; never put that key in `app.js` or any browser code.
3. Add your Vercel URL to Supabase Authentication’s allowed redirect URLs, then deploy the app.

This fresh-signup path does not migrate or delete old Auth accounts. Existing accounts and their data remain in Supabase, but users must create new username accounts to use the new login. Their old data will not appear in the new accounts.

To preserve existing account access instead, back up the project and run `scripts/migrate-existing-users.ts` before deploying. It preserves passwords, replaces Auth email identifiers with internal aliases, and prints a username mapping to share with users.

## Password Recovery

Users enter their username and select **Forgot password?**. This opens an email addressed to the app support contact, `lazychess08@gmail.com`. Verify the requester before generating a reset link. With `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `APP_URL` set in your local shell, run:

```sh
deno run --allow-env --allow-net scripts/generate-reset-link.ts <username>
```

Send the generated one-time link to the requester; they set their own new password in the app. Never send or ask users to disclose a password. Keep the service-role key private and do not commit it.

## Remaining

- Run the SQL, deploy the signup function, and deploy the app. Existing accounts will need new signups unless you choose the backup-and-migrate path above.
