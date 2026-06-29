import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RegisterCompanyRequest {
  company: {
    name: string;
    ruc: string;
    razon_social: string;
    num_trabajadores: number;
    direccion?: string;
    distrito?: string;
    provincia?: string;
    departamento?: string;
    actividad_economica?: string;
  };
  user: {
    full_name: string;
    dni: string;
    whatsapp_country_code: string;
    whatsapp_number: string;
    email: string;
    password: string;
  };
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

    const requestData: RegisterCompanyRequest = await req.json();
    const { company, user } = requestData;

    const { data: existingCompany } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('ruc', company.ruc)
      .maybeSingle();

    if (existingCompany) {
      return new Response(
        JSON.stringify({ error: 'RUC ya está registrado' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: existingUserByEmail } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();

    if (existingUserByEmail) {
      return new Response(
        JSON.stringify({ error: 'Email ya está registrado' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: newCompany, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: company.name,
        ruc: company.ruc,
        razon_social: company.razon_social,
        num_trabajadores: company.num_trabajadores,
        direccion: company.direccion || null,
        distrito: company.distrito || null,
        provincia: company.provincia || null,
        departamento: company.departamento || null,
        actividad_economica: company.actividad_economica || null,
        plan_type: 'free',
        active: true,
      })
      .select()
      .single();

    if (companyError || !newCompany) {
      return new Response(
        JSON.stringify({ error: companyError?.message || 'Error al crear empresa' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: freePlan } = await supabaseAdmin
      .from('plans')
      .select('id, ai_monthly_limit')
      .eq('name', 'Free')
      .maybeSingle();

    if (freePlan) {
      await supabaseAdmin
        .from('company_plans')
        .insert({
          company_id: newCompany.id,
          plan_id: freePlan.id,
        });

      await supabaseAdmin
        .from('company_ai_settings')
        .insert({
          company_id: newCompany.id,
          ai_enabled: true,
          monthly_analysis_limit: freePlan.ai_monthly_limit || 50,
        });
    }

    await supabaseAdmin
      .from('ai_usage_tracking')
      .insert({
        company_id: newCompany.id,
        month: new Date().toISOString().slice(0, 7),
        analysis_count: 0,
        total_cost: 0,
      });

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        full_name: user.full_name,
        dni: user.dni,
      },
    });

    if (authError || !authData.user) {
      await supabaseAdmin.from('companies').delete().eq('id', newCompany.id);

      return new Response(
        JSON.stringify({ error: authError?.message || 'Error al crear usuario' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: newUser, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: crypto.randomUUID(),
        auth_user_id: authData.user.id,
        email: user.email,
        dni: user.dni,
        full_name: user.full_name,
        whatsapp_country_code: user.whatsapp_country_code,
        whatsapp_number: user.whatsapp_number,
        role: 'sst_manager',
        company_id: newCompany.id,
        active: true,
        can_close_reports: true,
      })
      .select()
      .single();

    if (userError || !newUser) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabaseAdmin.from('companies').delete().eq('id', newCompany.id);

      return new Response(
        JSON.stringify({ error: userError?.message || 'Error al crear perfil de usuario' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    await supabaseAdmin.rpc('create_default_categories', {
      company_uuid: newCompany.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        company_id: newCompany.id,
        user_id: newUser.id,
        message: 'Empresa y usuario creados exitosamente',
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
    console.error('Registration error:', error);
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
