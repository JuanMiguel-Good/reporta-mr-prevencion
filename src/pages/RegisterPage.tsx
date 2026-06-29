import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Eye, EyeOff, Building2, User, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/common/Button';

const COUNTRY_CODES = [
  { code: '+51', country: 'Perú', flag: '🇵🇪' },
  { code: '+1', country: 'Estados Unidos', flag: '🇺🇸' },
  { code: '+52', country: 'México', flag: '🇲🇽' },
  { code: '+54', country: 'Argentina', flag: '🇦🇷' },
  { code: '+55', country: 'Brasil', flag: '🇧🇷' },
  { code: '+56', country: 'Chile', flag: '🇨🇱' },
  { code: '+57', country: 'Colombia', flag: '🇨🇴' },
  { code: '+58', country: 'Venezuela', flag: '🇻🇪' },
  { code: '+593', country: 'Ecuador', flag: '🇪🇨' },
  { code: '+591', country: 'Bolivia', flag: '🇧🇴' },
  { code: '+595', country: 'Paraguay', flag: '🇵🇾' },
  { code: '+598', country: 'Uruguay', flag: '🇺🇾' },
  { code: '+34', country: 'España', flag: '🇪🇸' },
];

interface RegisterFormData {
  razonSocial: string;
  ruc: string;
  fullName: string;
  dni: string;
  whatsappCountryCode: string;
  whatsappNumber: string;
  email: string;
  password: string;
  acceptTerms: boolean;
}

export function RegisterPage() {
  const [formData, setFormData] = useState<RegisterFormData>({
    razonSocial: '',
    ruc: '',
    fullName: '',
    dni: '',
    whatsappCountryCode: '+51',
    whatsappNumber: '',
    email: '',
    password: '',
    acceptTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'company' | 'user'>('company');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validateCompanyData = () => {
    if (!formData.razonSocial.trim()) {
      setError('La razón social es requerida');
      return false;
    }
    if (!formData.ruc.trim() || formData.ruc.length !== 11 || !/^[0-9]+$/.test(formData.ruc)) {
      setError('El RUC debe tener 11 dígitos');
      return false;
    }
    return true;
  };

  const validateUserData = () => {
    if (!formData.fullName.trim()) {
      setError('El nombre completo es requerido');
      return false;
    }
    if (!formData.dni.trim() || formData.dni.length !== 8 || !/^[0-9]+$/.test(formData.dni)) {
      setError('El DNI debe tener 8 dígitos');
      return false;
    }
    if (!formData.whatsappNumber.trim()) {
      setError('El número de WhatsApp es requerido');
      return false;
    }
    if (!/^[0-9]{9,15}$/.test(formData.whatsappNumber)) {
      setError('El número de WhatsApp debe contener entre 9 y 15 dígitos');
      return false;
    }
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('El email no es válido');
      return false;
    }
    if (formData.password.trim() && formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    setError('');
    if (validateCompanyData()) {
      setStep('user');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateUserData()) {
      return;
    }

    setLoading(true);

    try {
      const password = formData.password.trim() || formData.dni;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-company`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          company: {
            name: formData.razonSocial,
            ruc: formData.ruc,
            razon_social: formData.razonSocial,
            num_trabajadores: 1,
          },
          user: {
            full_name: formData.fullName,
            dni: formData.dni,
            whatsapp_country_code: formData.whatsappCountryCode,
            whatsapp_number: formData.whatsappNumber,
            email: formData.email,
            password: password,
          }
        })
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Error al registrar la empresa');
      }

      localStorage.setItem('show_welcome_modal', 'true');
      localStorage.setItem('assigned_plan', 'Free');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: password,
      });

      if (signInError) {
        throw signInError;
      }

      setLoading(false);
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Error al registrar. Por favor intenta nuevamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-full mb-4">
              <ShieldAlert className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Crear Cuenta en Reporta</h1>
            <p className="text-gray-600 mt-2">
              {step === 'company'
                ? 'Registra tu empresa'
                : 'Configura tu cuenta de Gestor SST'}
            </p>
          </div>

          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 'company' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
              }`}>
                <Building2 className="w-4 h-4" />
              </div>
              <div className={`w-24 h-1 ${step === 'user' ? 'bg-red-600' : 'bg-gray-200'}`} />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 'user' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-400'
              }`}>
                <User className="w-4 h-4" />
              </div>
            </div>
          </div>

          {step === 'company' ? (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="razonSocial" className="block text-sm font-medium text-gray-700 mb-2">
                    Razón Social *
                  </label>
                  <input
                    id="razonSocial"
                    name="razonSocial"
                    type="text"
                    value={formData.razonSocial}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Nombre legal de la empresa"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="ruc" className="block text-sm font-medium text-gray-700 mb-2">
                    RUC *
                  </label>
                  <input
                    id="ruc"
                    name="ruc"
                    type="text"
                    maxLength={11}
                    value={formData.ruc}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="12345678901"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Link to="/login" className="flex-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    className="w-full"
                  >
                    Cancelar
                  </Button>
                </Link>
                <Button
                  type="button"
                  onClick={handleNextStep}
                  variant="primary"
                  size="lg"
                  className="flex-1"
                >
                  Siguiente
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre Completo *
                  </label>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Juan Pérez García"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="dni" className="block text-sm font-medium text-gray-700 mb-2">
                    DNI *
                  </label>
                  <input
                    id="dni"
                    name="dni"
                    type="text"
                    maxLength={8}
                    value={formData.dni}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="12345678"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="whatsappNumber" className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      <span>Número de WhatsApp *</span>
                    </div>
                  </label>
                  <div className="flex gap-2">
                    <select
                      name="whatsappCountryCode"
                      value={formData.whatsappCountryCode}
                      onChange={handleInputChange}
                      className="w-24 sm:w-28 px-2 sm:px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-sm"
                    >
                      {COUNTRY_CODES.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.flag} {country.code}
                        </option>
                      ))}
                    </select>
                    <input
                      id="whatsappNumber"
                      name="whatsappNumber"
                      type="tel"
                      maxLength={15}
                      value={formData.whatsappNumber}
                      onChange={handleInputChange}
                      className="flex-1 min-w-0 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder="987654321"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Número de contacto para notificaciones de WhatsApp
                  </p>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="correo@empresa.com"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Contraseña (opcional)
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder="Mínimo 6 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-800">
                      {formData.password.trim() ? (
                        <>
                          <strong>Tu contraseña será:</strong> La que definiste arriba
                        </>
                      ) : (
                        <>
                          <strong>Tu contraseña será:</strong> Tu DNI ({formData.dni || '--------'})
                        </>
                      )}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      Podrás cambiarla después usando la opción de recuperación de contraseña
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => setStep('company')}
                  variant="secondary"
                  size="lg"
                  className="flex-1"
                  disabled={loading}
                >
                  Atrás
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="flex-1"
                  loading={loading}
                >
                  Crear Cuenta
                </Button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="text-red-600 hover:text-red-700 font-medium">
                Inicia sesión aquí
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
