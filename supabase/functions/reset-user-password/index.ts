import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ResetPasswordRequest {
  user_id: string;
  use_dni_as_password: boolean;
  custom_password?: string;
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
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
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

    const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

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

    const { data: adminUser } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('auth_user_id', authUser.id)
      .maybeSingle();

    if (!adminUser || adminUser.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Solo super admins pueden resetear contraseñas' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const requestData: ResetPasswordRequest = await req.json();
    const { user_id, use_dni_as_password, custom_password } = requestData;

    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('auth_user_id, dni, email, full_name')
      .eq('id', user_id)
      .maybeSingle();

    if (userError || !targetUser) {
      return new Response(
        JSON.stringify({ error: 'Usuario no encontrado' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let newPassword: string;
    if (use_dni_as_password) {
      newPassword = targetUser.dni;
    } else if (custom_password && custom_password.length >= 6) {
      newPassword = custom_password;
    } else {
      return new Response(
        JSON.stringify({ error: 'Contraseña inválida. Debe tener al menos 6 caracteres.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUser.auth_user_id,
      {
        password: newPassword,
      }
    );

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message || 'Error al actualizar contraseña' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (targetUser.email && !targetUser.email.endsWith('@internal.temp')) {
      const apiUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`;

      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify({
          to: targetUser.email,
          subject: 'Tu contraseña ha sido reseteada',
          html: `
            <h2>Contraseña Reseteada</h2>
            <p>Hola ${targetUser.full_name},</p>
            <p>Tu contraseña ha sido reseteada por un administrador del sistema.</p>
            ${use_dni_as_password ? '<p><strong>Tu nueva contraseña es tu DNI.</strong></p>' : '<p><strong>Se te ha asignado una nueva contraseña personalizada.</strong></p>'}
            <p>Por motivos de seguridad, te recomendamos cambiar tu contraseña después de iniciar sesión.</p>
            <p>Puedes iniciar sesión aquí: <a href="${Deno.env.get('SITE_URL')}/login">${Deno.env.get('SITE_URL')}/login</a></p>
          `,
        }),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Contraseña reseteada exitosamente',
        password_set_to: use_dni_as_password ? 'DNI' : 'Custom',
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
    console.error('Reset password error:', error);
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
