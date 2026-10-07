import { createClient } from "npm:@supabase/supabase-js@2";

const username = Deno.args[0]?.trim().toLowerCase();
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const appUrl = Deno.env.get("APP_URL");
if (!username) throw new Error("Usage: deno run --allow-env --allow-net scripts/generate-reset-link.ts <username>");
if (!supabaseUrl || !serviceRoleKey || !appUrl) throw new Error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and APP_URL in your local shell.");

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: profile, error: profileError } = await admin.from("expense_tracker_profiles").select("user_id").eq("username", username).maybeSingle();
if (profileError) throw profileError;
if (!profile) throw new Error("No account found for that username.");

const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.user_id);
if (userError || !userData.user?.email) throw userError || new Error("Could not locate the account.");

const { data, error } = await admin.auth.admin.generateLink({
  type: "recovery",
  email: userData.user.email,
  options: { redirectTo: appUrl },
});
if (error) throw error;
const link = data.properties?.action_link;
if (!link) throw new Error("Supabase did not return a recovery link.");
console.log(link);
console.log("Send this one-time link only after verifying the requester. Never share the service-role key.");
