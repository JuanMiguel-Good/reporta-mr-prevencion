import { Sparkles, X } from 'lucide-react';

interface WelcomeModalProps {
  role: string;
  onStartTour: () => void;
  onSkip: () => void;
}

const roleMessages = {
  worker: {
    title: '¡Bienvenido a Reporta!',
    description: 'Reporta incidentes de seguridad fácilmente con ayuda de nuestro asistente inteligente.',
    features: [
      'Captura fotos y reporta rápidamente',
      'El asistente IA completa la descripción por ti',
      'Sigue el estado de tus reportes'
    ]
  },
  sst_manager: {
    title: '¡Bienvenido, Encargado SST!',
    description: 'Gestiona y resuelve reportes de seguridad de tu equipo.',
    features: [
      'Revisa todos los reportes',
      'Asigna responsables y fechas de cierre',
      'Marca reportes como resueltos'
    ]
  },
  hr_observer: {
    title: '¡Bienvenido, Observador!',
    description: 'Monitorea métricas y tendencias de seguridad en tiempo real.',
    features: [
      'Visualiza estadísticas completas',
      'Exporta reportes a Excel',
      'Identifica patrones y áreas de mejora'
    ]
  },
  super_admin: {
    title: '¡Bienvenido, Super Admin!',
    description: 'Control total sobre empresas, usuarios y configuraciones del sistema.',
    features: [
      'Gestiona múltiples empresas',
      'Administra usuarios y roles',
      'Configura planes y límites de IA'
    ]
  }
};

export function WelcomeModal({ role, onStartTour, onSkip }: WelcomeModalProps) {
  const message = roleMessages[role as keyof typeof roleMessages] || roleMessages.worker;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-300">
        <button
          onClick={onSkip}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mb-4 mx-auto">
          <Sparkles className="w-8 h-8 text-white" />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
          {message.title}
        </h2>

        <p className="text-gray-600 text-center mb-6">
          {message.description}
        </p>

        <div className="space-y-2 mb-6">
          {message.features.map((feature, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
              <p className="text-sm text-gray-700">{feature}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
          >
            Explorar por mi cuenta
          </button>
          <button
            onClick={onStartTour}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium shadow-lg shadow-blue-600/30"
          >
            Iniciar tour
          </button>
        </div>
      </div>
    </div>
  );
}
