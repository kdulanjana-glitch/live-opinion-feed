import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const jwt = authHeader.replace('Bearer ', '');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    // Separate, anon-keyed client used only to verify the current password.
    // Kept apart from supabaseAdmin so that signing in on it doesn't swap
    // out the admin client's auth context before the admin call later.
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(jwt);
    if (callerError || !callerData?.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const caller = callerData.user;

    if (!caller.email?.endsWith('@phone.peolia.invalid')) {
      return new Response(
        JSON.stringify({ error: 'This account does not sign in with a phone number.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { newPhone, currentPassword } = await req.json();
    if (!newPhone || !currentPassword) {
      return new Response(
        JSON.stringify({ error: 'New phone number and current password are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: passwordError } = await supabaseAnon.auth.signInWithPassword({
      email: caller.email,
      password: currentPassword,
    });
    if (passwordError) {
      return new Response(
        JSON.stringify({ error: 'Current password is incorrect.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newDigits = digitsOnly(newPhone);
    if (newDigits.length < 8) {
      return new Response(
        JSON.stringify({ error: 'That does not look like a valid phone number.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const newSyntheticEmail = `${newDigits}@phone.peolia.invalid`;

    if (newSyntheticEmail === caller.email) {
      return new Response(
        JSON.stringify({ error: 'That is already your current phone number.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(caller.id, {
      email: newSyntheticEmail,
      email_confirm: true,
    });

    if (updateError) {
      const message = updateError.message?.includes('already')
        ? 'That phone number is already in use.'
        : updateError.message;
      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Phone lives in the private table (own-row RLS); admin client bypasses RLS.
    await supabaseAdmin
      .from('user_private')
      .upsert({ user_id: caller.id, phone: `+${newDigits}` }, { onConflict: 'user_id' });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Unexpected error updating phone number.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
