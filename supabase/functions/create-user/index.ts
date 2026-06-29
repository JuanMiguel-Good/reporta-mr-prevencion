import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CreateUserRequest {
  email: string | null;
  dni: string;
  full_name: string;
  role: string;
  company_id: string;
  area?: string | null;
  proyecto?: string | null;
  can_close_reports?: boolean;
  password?: string;
  is_multi_company_manager?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const { data: { user: requestingUser }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !requestingUser) {
      console.error('Auth validation failed:', authError);
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          details: authError?.message || 'Invalid token',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Successfully authenticated user:', requestingUser.id);

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

    const { data: requestingUserProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role, company_id')
      .eq('auth_user_id', requestingUser.id)
      .maybeSingle();

    if (profileError || !requestingUserProfile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (requestingUserProfile.role !== 'super_admin' && requestingUserProfile.role !== 'sst_manager') {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const userData: CreateUserRequest = await req.json();

    const validRoles = ['worker', 'sst_manager', 'hr_observer', 'super_admin'];
    if (!validRoles.includes(userData.role)) {
      return new Response(
        JSON.stringify({ error: 'Rol inválido' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (userData.is_multi_company_manager) {
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('dni')
        .eq('dni', userData.dni)
        .eq('company_id', userData.company_id)
        .maybeSingle();

      if (existingUser) {
        return new Response(
          JSON.stringify({ error: 'Ya existe un usuario con este DNI en esta empresa' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    } else {
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('dni')
        .eq('dni', userData.dni)
        .maybeSingle();

      if (existingUser) {
        return new Response(
          JSON.stringify({ error: 'Ya existe un usuario con este DNI' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    const password = userData.password || userData.dni;
    const email = userData.email?.trim() || null;
    const authEmail = email || `${userData.dni}@internal.temp`;

    let authUserId: string;
    let shouldCreateAuthUser = false;

    if (userData.is_multi_company_manager) {
      const { data: existingUsers } = await supabaseAdmin
        .from('users')
        .select('auth_user_id')
        .eq('dni', userData.dni)
        .limit(1);

      if (existingUsers && existingUsers.length > 0 && existingUsers[0].auth_user_id) {
        authUserId = existingUsers[0].auth_user_id;
      } else {
        const { data: listUsersResult } = await supabaseAdmin.auth.admin.listUsers();
        const matchingAuthUser = listUsersResult?.users?.find(u => u.email === authEmail);

        if (matchingAuthUser) {
          authUserId = matchingAuthUser.id;
        } else {
          const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
            email: authEmail,
            password: password,
            email_confirm: true,
          });

          if (signUpError || !authData.user) {
            return new Response(
              JSON.stringify({ error: signUpError?.message || 'Failed to create auth user' }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }

          authUserId = authData.user.id;
          shouldCreateAuthUser = true;
        }
      }
    } else {
      const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
        email: authEmail,
        password: password,
        email_confirm: true,
      });

      if (signUpError || !authData.user) {
        return new Response(
          JSON.stringify({ error: signUpError?.message || 'Failed to create auth user' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      authUserId = authData.user.id;
    }

    const userInsertData: any = {
      id: crypto.randomUUID(),
      auth_user_id: authUserId,
      email: email,
      dni: userData.dni,
      full_name: userData.full_name,
      role: userData.role,
      company_id: userData.company_id,
      active: true,
      area: userData.area || null,
      proyecto: userData.proyecto || null,
      can_close_reports: userData.can_close_reports || false,
      is_multi_company_manager: userData.is_multi_company_manager || false,
    };

    const { data: insertedUser, error: profileInsertError } = await supabaseAdmin
      .from('users')
      .insert(userInsertData)
      .select()
      .single();

    if (profileInsertError) {
      if (shouldCreateAuthUser && authUserId) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      }
      return new Response(
        JSON.stringify({ error: profileInsertError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, userId: insertedUser.id }),
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
      JSON.stringify({ error: error.message || 'Unknown error' }),
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