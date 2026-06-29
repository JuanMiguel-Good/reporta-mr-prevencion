import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/common/Button';

export function ForgotPasswordPage() {
  const [emailOrDni, setEmailOrDni] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let email = emailOrDni;

      if (!emailOrDni.includes('@')) {
        const { data, error: dniError } = await supabase.rpc('get_email_from_dni', {
          user_dni: emailOrDni
        });

        if (dniError || !data) {
          throw new Error('No se encontró un usuario con ese DNI. Verifica que el DNI sea correcto.');
        }

        if (data.endsWith('@internal.temp')) {
          throw new Error('Este usuario no tiene un email registrado. Por favor contacta al administrador para resetear tu contraseña.');
        }

        email = data;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        throw resetError;
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Error al enviar el correo de recuperación');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Correo Enviado</h1>
              <p className="text-gray-600">
                Hemos enviado un enlace de recuperación a tu correo electrónico.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                Revisa tu bandeja de entrada y sigue las instrucciones para restablecer tu contraseña.
                Si no recibes el correo en unos minutos, revisa tu carpeta de spam.
              </p>
            </div>

            <Link to="/login">
              <Button variant="secondary" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al inicio de sesión
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-full mb-4">
              <ShieldAlert className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Recuperar Contraseña</h1>
            <p className="text-gray-600 mt-2">
              Ingresa tu email o DNI para recibir un enlace de recuperación
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="emailOrDni" className="block text-sm font-medium text-gray-700 mb-2">
                Email o DNI
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="emailOrDni"
                  type="text"
                  value={emailOrDni}
                  onChange={(e) => setEmailOrDni(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Ingresa tu email o DNI"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              loading={loading}
            >
              Enviar Enlace de Recuperación
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-sm text-gray-600 hover:text-red-600 font-medium"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Volver al inicio de sesión
            </Link>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 text-center">
              <strong>Nota:</strong> Si olvidaste tu contraseña y no tienes acceso a tu email,
              contacta a tu administrador o al soporte de Reporta para que te ayuden a recuperar el acceso.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
