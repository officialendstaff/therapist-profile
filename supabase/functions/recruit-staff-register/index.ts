import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const origin = "https://officialendstaff.github.io";
// Only invite holders can register; the invite is claimed with a compare-and-set update.
const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "content-type,apikey,authorization", "Access-Control-Allow-Methods": "POST,OPTIONS" };
const response = (status: number, message: string) => new Response(JSON.stringify({ message }), { status, headers });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  // Origin checks are not authentication. Invite validation and server-side authorization remain mandatory.
  if (req.method !== "POST" || req.headers.get("origin") !== origin) return response(403, "Forbidden");
  try {
    const input = await req.json();
    const token = String(input.token || "");
    const email = String(input.email || "").trim().toLowerCase();
    const password = String(input.password || "");
    const displayName = String(input.displayName || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
        password.length < 8 || password.length > 128 || !displayName || displayName.length > 50)
      return response(400, "入力内容を確認してください。");
    const now = new Date().toISOString();
    const { data: invite, error: inviteError } = await admin.from("recruit_staff_invites")
      .select("token").eq("token", token).is("claimed_by", null).gt("expires_at", now).maybeSingle();
    if (inviteError) return response(500, "招待情報を確認できませんでした。");
    if (!invite) return response(400, "招待URLが無効または期限切れです。");
    // An existing email must never be modified by an invitation registration attempt.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { recruit_display_name: displayName }
    });
    if (createError || !created.user) return response(400, createError?.message || "登録できませんでした。");
    const userId = created.user.id;
    const { data: claimed, error: claimError } = await admin.from("recruit_staff_invites")
      .update({ claimed_by: userId, claimed_at: new Date().toISOString() })
      .eq("token", token).is("claimed_by", null).gt("expires_at", new Date().toISOString()).select("token");
    if (claimError || claimed?.length !== 1) {
      const { error: cleanupError } = await admin.auth.admin.deleteUser(userId);
      if (cleanupError) console.error("Invite race cleanup failed", { userId, error: cleanupError.message });
      return response(409, "招待URLが使用済み、または期限切れです。");
    }
    const { error: profileError } = await admin.from("recruit_staff_profiles")
      .insert({ user_id: userId, display_name: displayName, role: "pending", stores: [], features: [] });
    if (profileError) {
      // Delete the newly created user before releasing the invitation.
      // Otherwise another request could claim the same invite while cleanup is in progress.
      const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
      if (deleteError) {
        console.error("Registration cleanup failed", { userId, error: deleteError.message });
        return response(500, "登録処理を完了できませんでした。管理者へお問い合わせください。");
      }
      const { error: releaseError } = await admin.from("recruit_staff_invites")
        .update({ claimed_by: null, claimed_at: null }).eq("token", token).eq("claimed_by", userId);
      if (releaseError) console.error("Invite release failed", { error: releaseError.message });
      return response(500, "承認待ち登録に失敗しました。");
    }
    return response(200, "登録申請が完了しました。マスターの承認をお待ちください。");
  } catch {
    return response(500, "登録処理に失敗しました。");
  }
});
