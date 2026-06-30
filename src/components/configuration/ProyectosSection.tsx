import { useState, useEffect } from 'react';
import { Plus, Pencil, Power, FolderKanban, AlertCircle, Check, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Loading } from '../common/Loading';
import { Button } from '../common/Button';

interface Proyecto {
  id: string;
  user_id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function ProyectosSection() {
  const { user } = useAuth();
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProyecto, setEditingProyecto] = useState<Proyecto | null>(null);
  const [formData, setFormData] = useState({ name: '' });

  useEffect(() => {
    if (user) {
      loadProyectos();
    }
  }, [user]);

  const loadProyectos = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('proyectos')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setProyectos(data || []);
    } catch (error) {
      console.error('Error loading proyectos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (proyecto?: Proyecto) => {
    if (proyecto) {
      setEditingProyecto(proyecto);
      setFormData({ name: proyecto.name });
    } else {
      setEditingProyecto(null);
      setFormData({ name: '' });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProyecto(null);
    setFormData({ name: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    try {
      if (editingProyecto) {
        const { error } = await supabase
          .from('proyectos')
          .update({ name: formData.name })
          .eq('id', editingProyecto.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('proyectos')
          .insert({
            user_id: user.id,
            name: formData.name,
            active: true,
          });

        if (error) throw error;
      }

      handleCloseModal();
      loadProyectos();
    } catch (error) {
      console.error('Error saving proyecto:', error);
      alert('Error al guardar el proyecto');
    }
  };

  const handleToggleActive = async (proyecto: Proyecto) => {
    try {
      const { error } = await supabase
        .from('proyectos')
        .update({ active: !proyecto.active })
        .eq('id', proyecto.id);

      if (error) throw error;
      loadProyectos();
    } catch (error) {
      console.error('Error toggling proyecto:', error);
      alert('Error al cambiar el estado del proyecto');
    }
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <p className="text-gray-600">
          Los proyectos te permiten organizar los reportes según iniciativas o contratos
        </p>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-5 h-5 mr-2" />
          Nuevo Proyecto
        </Button>
      </div>

      {proyectos.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No hay proyectos
          </h3>
          <p className="text-gray-600 mb-4">
            Crea tu primer proyecto para empezar
          </p>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="w-5 h-5 mr-2" />
            Crear Proyecto
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {proyectos.map((proyecto) => (
            <div
              key={proyecto.id}
              className={`flex items-center justify-between p-4 border-2 rounded-lg transition-colors ${
                proyecto.active
                  ? 'border-gray-200 bg-white hover:border-gray-300'
                  : 'border-gray-100 bg-gray-50 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`p-2 rounded-lg ${
                  proyecto.active ? 'bg-green-100' : 'bg-gray-200'
                }`}>
                  <FolderKanban className={`w-5 h-5 ${
                    proyecto.active ? 'text-green-600' : 'text-gray-400'
                  }`} />
                </div>
                <h3 className="font-semibold text-gray-900 truncate">
                  {proyecto.name}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenModal(proyecto)}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Editar"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleToggleActive(proyecto)}
                  className={`p-2 rounded-lg transition-colors ${
                    proyecto.active
                      ? 'text-green-600 hover:text-red-600 hover:bg-red-50'
                      : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                  }`}
                  title={proyecto.active ? 'Desactivar' : 'Activar'}
                >
                  <Power className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">
              {editingProyecto ? 'Editar Proyecto' : 'Nuevo Proyecto'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  placeholder="Ej: Expansión 2024, Torre B, Proyecto Alpha..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCloseModal}
                  className="flex-1"
                >
                  <X className="w-5 h-5 mr-2" />
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1">
                  <Check className="w-5 h-5 mr-2" />
                  {editingProyecto ? 'Guardar' : 'Crear'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
