// Scheduled offer-expiry sweep (SPEC §4.2.3, §7.3): offers lapse
// server-side, never by clients noticing a countdown hit zero.
// Schedule hourly (see docs/DEPLOYMENT.md). Runs with the service role —
// public.expire_offers() is EXECUTE-revoked for end users.

import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async () => {
  const { data, error } = await supabase.rpc('expire_offers')
  if (error) return new Response(error.message, { status: 500 })
  return Response.json({ expired: data })
})
