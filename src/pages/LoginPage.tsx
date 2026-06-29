import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, Eye, EyeOff, Building2, Phone, MessageCircle, Mail, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/common/Button';

interface AvailableCompany {
  user_id: string;
  company_id: string;
  company_name: string;
  company_logo: string | null;
}

export function LoginPage() {
  const [emailOrDni, setEmailOrDni] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [availableCompanies, setAvailableCompanies] = useState<AvailableCompany[]>([]);
  const [showCompanySelector, setShowCompanySelector] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<AvailableCompany | null>(null);
  const { signIn, switchCompany } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn(emailOrDni, password);

      if (result && result.length > 1) {
        setAvailableCompanies(result);
        setShowCompanySelector(true);
        setLoading(false);
        return;
      }

      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
      setLoading(false);
    }
  };

  const handleCompanySelect = async () => {
    if (!selectedCompany) return;

    setLoading(true);
    try {
      await switchCompany(selectedCompany.user_id, selectedCompany.company_id);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Error al seleccionar empresa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-full mb-4">
              <ShieldAlert className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Reporta</h1>
            <p className="text-gray-600 mt-2">Tu asistente para reportar actos y condiciones inseguras</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="emailOrDni" className="block text-sm font-medium text-gray-700 mb-2">
                Email o DNI
              </label>
              <input
                id="emailOrDni"
                type="text"
                value={emailOrDni}
                onChange={(e) => setEmailOrDni(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Ingresa tu email o DNI"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Contraseña
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Ingresa tu contraseña"
                  required
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
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                <p className="font-medium mb-1">{error}</p>
                {error.includes('credenciales') || error.includes('credentials') || error.includes('password') ? (
                  <p className="text-xs text-red-500 mt-2">
                    Si olvidaste tu contraseña, puedes{' '}
                    <Link to="/forgot-password" className="underline font-medium hover:text-red-700">
                      recuperarla aquí
                    </Link>
                  </p>
                ) : null}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              loading={loading}
            >
              Iniciar Sesión
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="text-red-600 hover:text-red-700 font-medium">
                Regístrate aquí
              </Link>
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center mb-3">
              Desarrollado por Good Solutions
            </p>
            <div className="flex items-center justify-center gap-4">
              <a
                href="tel:+51962342328"
                className="text-gray-600 hover:text-red-600 transition-colors"
                title="Llamar: +51 962 342 328"
              >
                <Phone className="w-5 h-5" />
              </a>
              <a
                href="https://wa.me/51962342328"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-green-600 transition-colors"
                title="WhatsApp: +51 962 342 328"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
              <a
                href="mailto:hola@goodsolutions.pe"
                className="text-gray-600 hover:text-red-600 transition-colors"
                title="Email: hola@goodsolutions.pe"
              >
                <Mail className="w-5 h-5" />
              </a>
              <a
                href="https://www.goodsolutions.pe/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-red-600 transition-colors"
                title="Visitar: www.goodsolutions.pe"
              >
                <Globe className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        {showCompanySelector && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold mb-2">Selecciona tu empresa</h2>
              <p className="text-sm text-gray-600 mb-4">
                Tienes acceso a múltiples empresas. Selecciona la empresa a la que deseas ingresar.
              </p>

              <div className="space-y-2 max-h-96 overflow-y-auto mb-6">
                {availableCompanies.map((company) => (
                  <label
                    key={company.company_id}
                    className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedCompany?.company_id === company.company_id
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="company"
                      value={company.company_id}
                      checked={selectedCompany?.company_id === company.company_id}
                      onChange={() => setSelectedCompany(company)}
                      className="w-4 h-4 text-red-600"
                    />
                    <div className="flex items-center gap-3 flex-1">
                      {company.company_logo ? (
                        <img
                          src={company.company_logo}
                          alt={company.company_name}
                          className="w-10 h-10 object-contain rounded"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-gray-900">{company.company_name}</div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => {
                    setShowCompanySelector(false);
                    setSelectedCompany(null);
                    setAvailableCompanies([]);
                  }}
                  variant="secondary"
                  className="flex-1"
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCompanySelect}
                  variant="primary"
                  className="flex-1"
                  disabled={!selectedCompany}
                  loading={loading}
                >
                  Ingresar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
