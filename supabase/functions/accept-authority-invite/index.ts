import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { code, email, password, full_name } = await req.json();
    if (!code || !email || !password || password.length < 8 || !full_name) {
      return new Response(
        JSON.stringify({ error: 'code, email, full_name and a password of at least 8 characters are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Atomic single-use claim of the invite code.
    const { data: claimed, error: claimError } = await admin.rpc('claim_authority_invite', {
      p_code: code.trim().toUpperCase(),
      p_email: String(email).trim().toLowerCase(),
    });
    if (claimError || !claimed) {
      return new Response(
        JSON.stringify({ error: 'This invite code is invalid, expired, already used, or the email does not match the invitation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: String(email).trim().toLowerCase(),
      password: String(password),
      email_confirm: true,
      user_metadata: { full_name: String(full_name).trim() },
    });
    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Promote to authority in their profile (trigger created it as citizen).
    const { error: promoteError } = await admin
      .from('profiles')
      .update({ role: 'authority' })
      .eq('id', created.user.id);
    if (promoteError) {
      return new Response(JSON.stringify({ error: 'Account created but role setup failed; contact an administrator' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
