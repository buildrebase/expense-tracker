import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceRoleKey) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your local shell.");

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const usernamePattern = /^[a-z0-9_]{3,24}$/;
const internalEmail = (username: string) => `${username}@accounts.expense-tracker.invalid`;

function generatedUsername(email: string | undefined, userId: string) {
  const localPart = (email || "user").split("@")[0];
  const base = localPart.normalize("NFKD").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 15) || "user";
  return `${base}_${userId.replaceAll("-", "").slice(0, 8)}`;
}

let page = 1;
let migrated = 0;
while (true) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 500 });
  if (error) throw error;
  if (!data.users.length) break;

  const ids = data.users.map(user => user.id);
  const { data: profiles, error: profileReadError } = await admin.from("expense_tracker_profiles").select("user_id,username").in("user_id", ids);
  if (profileReadError) throw profileReadError;
  const usernames = new Map((profiles || []).map(profile => [profile.user_id, profile.username]));

  for (const user of data.users) {
    const existing = usernames.get(user.id);
    const metadataName = typeof user.user_metadata?.username === "string" ? user.user_metadata.username.trim().toLowerCase() : "";
    const username = existing || (usernamePattern.test(metadataName) ? metadataName : generatedUsername(user.email, user.id));

    if (!existing) {
      const { error: insertError } = await admin.from("expense_tracker_profiles").insert({ user_id: user.id, username });
      if (insertError) throw new Error(`Could not assign a username for ${user.email || user.id}: ${insertError.message}`);
    }

    const alias = internalEmail(username);
    if (user.email !== alias) {
      const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
        email: alias,
        email_confirm: true,
        user_metadata: { ...user.user_metadata, username },
      });
      if (updateError) throw new Error(`Could not migrate ${user.email || user.id}: ${updateError.message}`);
    }

    console.log(`${user.email || user.id}\t${username}`);
    migrated++;
  }

  if (data.users.length < 500) break;
  page++;
}

console.log(`Processed ${migrated} accounts. Save the username mapping and share each username with its owner.`);
