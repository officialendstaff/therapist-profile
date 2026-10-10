// Supabase Edge Function: interview-push
// Prerequisites: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_DISPATCH_SECRET,
// PUSH_RECIPIENT_USER_ID, and a server-only Supabase service-role credential.
// This function is NOT public: requests must present X-Push-Dispatch-Secret.
// The function does not accept arbitrary notification content or destinations.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const types: Record<string, string> = {
  interview_new: '新しい面接予定',
  interview_cancel: '面接キャンセル',
  interview_reschedule: '面接日程変更',
  interview_form: '面接フォーム記入完了',
  interview_help: 'HELP｜面接フォーム',
};

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = Deno.env.get('PUSH_DISPATCH_SECRET');
  const presented = request.headers.get('x-push-dispatch-secret');
  if (!secret || !presented || presented.length !== secret.length) return new Response('Unauthorized', { status: 401 });
  // Constant-time comparison of secret bytes.
  const a = new TextEncoder().encode(secret);
  const b = new TextEncoder().encode(presented);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) return new Response('Unauthorized', { status: 401 });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const userId = Deno.env.get('PUSH_RECIPIENT_USER_ID');
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  if (![url, serviceKey, userId, publicKey, privateKey].every(Boolean)) {
    return new Response('Missing server configuration', { status: 503 });
  }
  webpush.setVapidDetails('mailto:admin@example.invalid', publicKey!, privateKey!);
  const db = createClient(url!, serviceKey!, { auth: { persistSession: false } });
  // A single dispatcher should be scheduled. Do not schedule overlapping calls
  // until an atomic claim/lease mechanism is added to the queue.
  const { data: events, error: eventError } = await db.from('staff_push_events')
    .select('id,event_type,payload,attempts').is('delivered_at', null)
    .lt('attempts', 5).order('created_at', { ascending: true }).limit(20);
  if (eventError) return new Response('Queue unavailable', { status: 500 });
  const { data: subscriptions, error: subscriptionError } = await db.from('staff_push_subscriptions')
    .select('id,subscription').eq('user_id', userId!);
  if (subscriptionError) return new Response('Subscriptions unavailable', { status: 500 });
  if (!subscriptions?.length) return Response.json({ pending: events?.length || 0, sent: 0, reason: 'no_subscriptions' });
  let delivered = 0, failed = 0;
  for (const event of events || []) {
    if (!(event.event_type in types)) continue;
    const shop = String(event.payload?.shop || '').slice(0, 50);
    const message = JSON.stringify({
      type: event.event_type,
      event_id: event.id,
      body: shop ? shop + '｜管理ページをご確認ください。' : '管理ページをご確認ください。',
    });
    let allSent = true;
    for (const entry of subscriptions) {
      try {
        await webpush.sendNotification(entry.subscription, message, { TTL: 3600 });
        delivered++;
      } catch (err) {
        const status = Number((err as { statusCode?: number }).statusCode);
        if (status === 404 || status === 410) {
          await db.from('staff_push_subscriptions').delete().eq('id', entry.id);
        } else {
          allSent = false;
        }
        failed++;
      }
    }
    await db.from('staff_push_events').update({
      attempts: (event.attempts || 0) + 1,
      ...(allSent ? { delivered_at: new Date().toISOString(), last_error: null } : { last_error: 'One or more push deliveries failed' }),
    }).eq('id', event.id).is('delivered_at', null);
  }
  return Response.json({ events: events?.length || 0, delivered, failed });
});
