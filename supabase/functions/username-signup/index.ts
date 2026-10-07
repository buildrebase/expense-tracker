import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const usernamePattern = /^[a-z0-9_]{3,24}$/;

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

async function hashIp(ip: string, keyText: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(keyText), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(ip)));
  return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return reply(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return reply(500, { error: "Sign-up is temporarily unavailable" });

  let body: { username?: unknown; password?: unknown; fullName?: unknown };
  try {
    body = await request.json();
  } catch {
    return reply(400, { error: "Invalid request" });
  }

  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim().slice(0, 80) : "";
  if (!usernamePattern.test(username)) return reply(400, { error: "Use 3–24 letters, numbers, or underscores for the username" });
  if (password.length < 6 || password.length > 72) return reply(400, { error: "Password must be at least 6 characters" });

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  const clientIp = request.headers.get("cf-connecting-ip") || forwardedFor || "unknown";
  try {
    const ipHash = await hashIp(clientIp, serviceRoleKey);
    const { data: allowed, error: rateLimitError } = await serviceClient.rpc("expense_tracker_allow_signup", { p_ip_hash: ipHash });
    if (rateLimitError) throw rateLimitError;
    if (!allowed) return reply(429, { error: "Too many sign-up attempts. Try again later." });

    const internalEmail = `${username}@accounts.expense-tracker.invalid`;
    const { data: userData, error: createError } = await serviceClient.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: { username, full_name: fullName || username },
    });
    if (createError || !userData.user) return reply(409, { error: "That username may already be in use" });

    const { error: profileError } = await serviceClient.from("expense_tracker_profiles").insert({ user_id: userData.user.id, username });
    if (profileError) {
      await serviceClient.auth.admin.deleteUser(userData.user.id);
      return reply(409, { error: "That username may already be in use" });
    }

    return reply(201, { created: true });
  } catch (error) {
    console.error("Username sign-up failed", error);
    return reply(500, { error: "Sign-up is temporarily unavailable" });
  }
});
