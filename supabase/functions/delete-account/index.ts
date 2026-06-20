import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Always reply 200 with { success, error? } — the client checks `success`.
function jsonResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ success: false, error: 'Missing authorization.' });
    }
    const jwt = authHeader.replace('Bearer ', '');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Resolve the caller from their JWT.
    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(jwt);
    if (callerError || !callerData?.user) {
      return jsonResponse({ success: false, error: 'Invalid or expired session.' });
    }
    const caller = callerData.user;

    // Soft-delete: mark the row + ban sign-in for 30 days. A scheduled job can
    // hard-delete rows whose deleted_at is older than the grace period.
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', caller.id);
    if (updateError) {
      return jsonResponse({ success: false, error: 'Could not schedule account deletion.' });
    }

    // Block sign-in attempts at the Auth layer itself for 30 days (720h).
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(caller.id, {
      ban_duration: '720h',
    });
    if (banError) {
      return jsonResponse({ success: false, error: 'Could not lock the account.' });
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ success: false, error: 'Unexpected error deleting account.' });
  }
});
