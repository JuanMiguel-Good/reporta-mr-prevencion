import { useState } from 'react';
import { X, Key, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../common/Button';

interface ResetPasswordModalProps {
  userId: string;
  userName: string;
  userDni: string;
  onClose: () => void;
}

export function ResetPasswordModal({ userId, userName, userDni, onClose }: ResetPasswordModalProps) {
  const [useDni, setUseDni] = useState(true);
  const [customPassword, setCustomPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleReset = async () => {
    setError('');
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No hay sesión activa');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          user_id: userId,
          use_dni_as_password: useDni,
          custom_password: useDni ? undefined : customPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Error al resetear contraseña');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Error al resetear contraseña');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl max-w-md w-full p-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Contraseña Reseteada</h2>
            <p className="text-gray-600">
              La contraseña de {userName} ha sido reseteada exitosamente.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>Nueva contraseña:</strong> {useDni ? `DNI (${userDni})` : 'Personalizada'}
            </p>
            <p className="text-xs text-blue-700 mt-2">
              Se ha enviado un correo al usuario informándole del cambio.
            </p>
          </div>

          <Button
            onClick={onClose}
            variant="primary"
            className="w-full"
          >
            Cerrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <Key className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Resetear Contraseña</h2>
              <p className="text-sm text-gray-600">{userName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-800 font-medium mb-1">
                  Acción Importante
                </p>
                <p className="text-xs text-yellow-700">
                  Vas a cambiar la contraseña de {userName}. Esta acción se registrará en el sistema
                  y se notificará al usuario por correo electrónico.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 has-[:checked]:border-red-500 has-[:checked]:bg-red-50">
              <input
                type="radio"
                name="passwordType"
                checked={useDni}
                onChange={() => setUseDni(true)}
                className="mt-0.5 w-4 h-4 text-red-600"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900 mb-1">Usar DNI como contraseña</div>
                <div className="text-sm text-gray-600">
                  La contraseña será: <strong>{userDni}</strong>
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 has-[:checked]:border-red-500 has-[:checked]:bg-red-50">
              <input
                type="radio"
                name="passwordType"
                checked={!useDni}
                onChange={() => setUseDni(false)}
                className="mt-0.5 w-4 h-4 text-red-600"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900 mb-1">Contraseña personalizada</div>
                <div className="text-sm text-gray-600 mb-2">
                  Define una contraseña temporal para el usuario
                </div>
                {!useDni && (
                  <input
                    type="text"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                    minLength={6}
                  />
                )}
              </div>
            </label>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            onClick={onClose}
            variant="secondary"
            className="flex-1"
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleReset}
            variant="primary"
            className="flex-1"
            loading={loading}
            disabled={!useDni && customPassword.length < 6}
          >
            Resetear Contraseña
          </Button>
        </div>
      </div>
    </div>
  );
}
