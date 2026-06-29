import { useState, useEffect } from 'react';
import {
  Camera,
  Images,
  UserCheck,
  UserPlus,
  Settings,
  BarChart3,
  ClipboardCheck,
  HelpCircle,
  ArrowLeft,
  Image,
  AlertTriangle,
  FolderOpen,
  FileText,
  MapPin,
  Send,
  List,
  Eye,
  Clock,
  Download,
  Users,
  Filter,
  Edit,
  ImagePlus,
  CreditCard,
  User,
  Shield,
  Building,
  Save,
  Plus,
  Type,
  Palette,
  PieChart,
  TrendingUp,
  Calendar,
  Bell,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Guide } from '../types/database';
import { Loading } from '../components/common/Loading';
import { useNavigate } from 'react-router-dom';

const ICON_MAP: Record<string, any> = {
  Camera,
  Gallery: Images,
  Images,
  UserCheck,
  UserPlus,
  Settings,
  BarChart3,
  ClipboardCheck,
  HelpCircle,
  ArrowLeft,
  Image,
  AlertTriangle,
  FolderOpen,
  FileText,
  MapPin,
  Send,
  List,
  Eye,
  Clock,
  Download,
  Users,
  Filter,
  Edit,
  ImagePlus,
  CreditCard,
  User,
  Shield,
  Building,
  Save,
  Plus,
  Type,
  Palette,
  PieChart,
  TrendingUp,
  Calendar,
  Bell
};

const ROLE_TABS = [
  { value: 'worker', label: 'Trabajador' },
  { value: 'sst_manager', label: 'Gestor SST' },
  { value: 'super_admin', label: 'Admin' },
];

export function HelpPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState(user?.role || 'worker');
  const [selectedOption, setSelectedOption] = useState<Guide | null>(null);

  useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
    }
  }, [user]);

  useEffect(() => {
    loadGuides();
  }, []);

  const loadGuides = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('guides')
        .select('*')
        .order('order_index');

      if (error) throw error;
      setGuides(data || []);
    } catch (error) {
      console.error('Error loading guides:', error);
    } finally {
      setLoading(false);
    }
  };

  const mainOptions = guides.filter(
    guide => guide.role === selectedRole && guide.parent_id === null
  );

  const getStepsForOption = (optionId: string) => {
    return guides.filter(
      guide => guide.parent_id === optionId
    );
  };

  const handleBack = () => {
    setSelectedOption(null);
  };

  if (loading) {
    return <Loading message="Cargando guía..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-24">
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {selectedOption && (
                <button
                  onClick={handleBack}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
              )}
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {selectedOption ? selectedOption.title : 'Guía Rápida'}
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  {selectedOption
                    ? 'Sigue estos pasos para completar la tarea'
                    : '¿Qué deseas hacer?'}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
              title="Cerrar guía"
            >
              <X className="w-6 h-6 text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {user?.role === 'super_admin' && !selectedOption && (
          <div className="flex gap-2 mb-6 bg-white rounded-lg p-2 shadow-sm">
            {ROLE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setSelectedRole(tab.value as any)}
                className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-colors ${
                  selectedRole === tab.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {!selectedOption ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {mainOptions.length === 0 ? (
              <div className="col-span-2 text-center py-12 bg-white rounded-lg shadow-sm">
                <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No hay guías disponibles</p>
              </div>
            ) : (
              mainOptions.map((option) => {
                const Icon = ICON_MAP[option.icon] || HelpCircle;
                return (
                  <button
                    key={option.id}
                    onClick={() => setSelectedOption(option)}
                    className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-6 text-left group border border-slate-200 hover:border-blue-300"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                          {option.title}
                        </h3>
                        <p className="text-sm text-slate-600 leading-relaxed">
                          {option.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {getStepsForOption(selectedOption.id).map((step, index) => {
              const Icon = ICON_MAP[step.icon] || HelpCircle;
              return (
                <div
                  key={step.id}
                  className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-slate-200 overflow-hidden"
                >
                  <div className="flex items-center gap-6 p-6">
                    <div className="relative flex-shrink-0">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                        <Icon className="w-10 h-10 text-white" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-bold shadow-md">
                        {index + 1}
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-slate-900 mb-1">
                        {step.title}
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              onClick={handleBack}
              className="w-full mt-8 px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
              Volver a las opciones
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
