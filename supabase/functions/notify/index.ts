// Notification dispatch Edge Function (SPEC §4.2.3, §7.3).
// Drains public.notifications rows with dispatched = false and attempts
// delivery in priority order: (1) SMS via Twilio, (2) push via FCM,
// (3) email. Every channel is attempted for critical events; per-channel
// outcomes are written back to the row's `channels` jsonb.
//
// Schedule every minute (see docs/DEPLOYMENT.md), or invoke after events.
// Runs with the service role — RLS does not apply here by design.

import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

type Outcome = { channel: 'sms' | 'push' | 'email'; status: 'sent' | 'skipped' | 'failed' }

async function sendSms(to: string, body: string): Promise<Outcome['status']> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const token = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from = Deno.env.get('TWILIO_FROM_NUMBER')
  if (!sid || !token || !from) return 'skipped' // credentials not configured (§4.9)
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${sid}:${token}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  })
  return res.ok ? 'sent' : 'failed'
}

async function sendPush(userId: string, body: string): Promise<Outcome['status']> {
  // FCM HTTP v1. Device tokens live in a push_tokens table the PWA
  // populates on notification opt-in; absent tokens mean 'skipped'.
  const projectId = Deno.env.get('FCM_PROJECT_ID')
  const accessToken = Deno.env.get('FCM_ACCESS_TOKEN') // minted by a token broker in production
  if (!projectId || !accessToken) return 'skipped'
  const { data: tokens } = await supabase.from('push_tokens').select('token').eq('user_id', userId)
  if (!tokens || tokens.length === 0) return 'skipped'
  let ok = false
  for (const t of tokens) {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: { token: t.token, notification: { title: 'Iqaluit Daycare Network', body } },
        }),
      }
    )
    ok = ok || res.ok
  }
  return ok ? 'sent' : 'failed'
}

async function sendEmail(to: string, body: string): Promise<Outcome['status']> {
  const apiKey = Deno.env.get('RESEND_API_KEY') // or any SMTP relay
  const from = Deno.env.get('EMAIL_FROM')
  if (!apiKey || !from) return 'skipped'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject: 'Iqaluit Daycare Network', text: body }),
  })
  return res.ok ? 'sent' : 'failed'
}

Deno.serve(async () => {
  const { data: pending, error } = await supabase
    .from('notifications')
    .select('id, user_id, body, profiles(mobile, email, notify_sms, notify_push, notify_email)')
    .eq('dispatched', false)
    .limit(100)
  if (error) return new Response(error.message, { status: 500 })

  let processed = 0
  for (const n of pending ?? []) {
    const p = n.profiles as unknown as {
      mobile: string | null
      email: string
      notify_sms: boolean
      notify_push: boolean
      notify_email: boolean
    }
    const outcomes: Outcome[] = [
      {
        channel: 'sms',
        status: p.notify_sms && p.mobile ? await sendSms(p.mobile, n.body) : 'skipped',
      },
      { channel: 'push', status: p.notify_push ? await sendPush(n.user_id, n.body) : 'skipped' },
      { channel: 'email', status: p.notify_email ? await sendEmail(p.email, n.body) : 'skipped' },
    ]
    await supabase
      .from('notifications')
      .update({ channels: outcomes, dispatched: true })
      .eq('id', n.id)
    processed++
  }
  return Response.json({ processed })
})
