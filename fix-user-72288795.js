// Script temporal para arreglar el usuario 72288795
// Este script se ejecuta una sola vez y luego se puede eliminar

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yrkjelaleitrfinopdzy.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY no está configurada');
  console.log('Por favor ejecuta:');
  console.log('export SUPABASE_SERVICE_ROLE_KEY="tu-service-role-key"');
  console.log('node fix-user-72288795.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixUser() {
  console.log('Buscando usuario con DNI 72288795...');

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('dni', '72288795')
    .maybeSingle();

  if (userError || !userData) {
    console.error('Usuario no encontrado:', userError);
    process.exit(1);
  }

  console.log('Usuario encontrado:', userData.full_name);
  console.log('Email:', userData.email);
  console.log('auth_user_id actual:', userData.auth_user_id);

  if (userData.auth_user_id) {
    console.log('El usuario ya tiene auth_user_id. No se necesita arreglar.');
    process.exit(0);
  }

  const authEmail = userData.email || `${userData.dni}@internal.temp`;
  const password = userData.dni; // Usar DNI como contraseña

  console.log('\nCreando usuario de autenticación...');
  console.log('Email:', authEmail);
  console.log('Password:', password);

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: authEmail,
    password: password,
    email_confirm: true,
  });

  if (authError) {
    console.error('Error creando usuario auth:', authError);
    process.exit(1);
  }

  console.log('Usuario auth creado exitosamente:', authData.user.id);

  console.log('\nActualizando registro en tabla users...');
  const { error: updateError } = await supabase
    .from('users')
    .update({ auth_user_id: authData.user.id })
    .eq('id', userData.id);

  if (updateError) {
    console.error('Error actualizando usuario:', updateError);
    process.exit(1);
  }

  console.log('\n✅ Usuario arreglado exitosamente!');
  console.log('\nAhora puede iniciar sesión con:');
  console.log('DNI:', userData.dni);
  console.log('Contraseña:', password);
}

fixUser().catch(console.error);
