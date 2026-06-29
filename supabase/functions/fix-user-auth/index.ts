import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface FixUserAuthRequest {
  user_id: string;
  password?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: requestingUserProfile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('auth_user_id', requestingUser.id)
      .maybeSingle();

    if (!requestingUserProfile || requestingUserProfile.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Solo super admins pueden ejecutar esta función' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { user_id, password }: FixUserAuthRequest = await req.json();

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', user_id)
      .maybeSingle();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ error: 'Usuario no encontrado' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (userData.auth_user_id) {
      return new Response(
        JSON.stringify({ error: 'El usuario ya tiene una cuenta de autenticación' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const userPassword = password || userData.dni;
    const authEmail = userData.email?.trim() || `${userData.dni}@internal.temp`;

    const { data: listUsersResult } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = listUsersResult?.users?.find(u => u.email === authEmail);

    let authUserId: string;

    if (existingAuthUser) {
      authUserId = existingAuthUser.id;

      const { error: updatePasswordError } = await supabaseAdmin.auth.admin.updateUserById(
        authUserId,
        { password: userPassword }
      );

      if (updatePasswordError) {
        return new Response(
          JSON.stringify({ error: `Error actualizando contraseña: ${updatePasswordError.message}` }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    } else {
      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: authEmail,
        password: userPassword,
        email_confirm: true,
      });

      if (createError || !authData.user) {
        return new Response(
          JSON.stringify({ error: `Error creando usuario auth: ${createError?.message}` }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      authUserId = authData.user.id;
    }

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ auth_user_id: authUserId })
      .eq('id', user_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: `Error actualizando usuario: ${updateError.message}` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cuenta de autenticación creada exitosamente',
        auth_user_id: authUserId,
        email: authEmail
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Error desconocido' }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
