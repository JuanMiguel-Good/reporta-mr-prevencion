import { useState, useEffect } from 'react';
import { X, Plus, Check } from 'lucide-react';
import { Button } from '../common/Button';
import { Category, ReportType } from '../../types/database';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { offlineStorage } from '../../utils/offlineStorage';

interface ReportFlowProps {
  photos: File[];
  onSubmit: (data: {
    type: ReportType;
    categoryId: string;
    description: string;
    proposedClosure: string;
    area?: string;
    proyecto?: string;
  }) => void;
  onAddMorePhotos: () => void;
  onCancel: () => void;
}

export function ReportFlow({ photos, onSubmit, onAddMorePhotos, onCancel }: ReportFlowProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'photos' | 'type' | 'category' | 'location' | 'description' | 'closure'>('photos');
  const [type, setType] = useState<ReportType | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>('');
  const [area, setArea] = useState('');
  const [sede, setSede] = useState('');
  const [description, setDescription] = useState('');
  const [proposedClosure, setProposedClosure] = useState('');
  const [customClosure, setCustomClosure] = useState('');
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableSedes, setAvailableSedes] = useState<string[]>([]);

  const previewUrl = photos.length > 0 ? URL.createObjectURL(photos[0]) : '';
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  useEffect(() => {
    loadCategories();
    loadCatalogs();
  }, [user]);

  const loadCategories = async () => {
    if (!user) return;

    try {
      if (!navigator.onLine) {
        const cached = await offlineStorage.getCachedCategories(user.id);
        if (cached.length > 0) {
          setCategories(cached as Category[]);
          return;
        }
      }

      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('display_order');

      if (error) throw error;

      if (data) {
        setCategories(data);
        await offlineStorage.cacheCategories(data, user.id);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      const cached = await offlineStorage.getCachedCategories(user.id);
      if (cached.length > 0) {
        setCategories(cached as Category[]);
      }
    }
  };

  const loadCatalogs = async () => {
    if (!user) return;

    try {
      if (!navigator.onLine) {
        const cachedAreas = await offlineStorage.getCachedAreas(user.id);
        const cachedSedes = await offlineStorage.getCachedProyectos(user.id);

        if (cachedAreas.length > 0) setAvailableAreas(cachedAreas.map(a => a.name));
        if (cachedSedes.length > 0) setAvailableSedes(cachedSedes.map(s => s.name));
        if (user.area) setArea(user.area);
        return;
      }

      const { data: areasData, error: areasError } = await supabase
        .from('areas')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name');

      if (areasError) console.error('Error loading areas:', areasError);

      const { data: sedesData, error: sedesError } = await supabase
        .from('company_sites')
        .select('id, name')
        .eq('company_id', user.company_id)
        .order('name');

      if (sedesError) console.error('Error loading sedes:', sedesError);

      if (areasData) {
        setAvailableAreas(areasData.map(a => a.name));
        await offlineStorage.cacheAreas(areasData, user.id);
      }

      if (sedesData) {
        setAvailableSedes(sedesData.map(s => s.name));
        try {
          await offlineStorage.cacheProyectos(sedesData, user.id);
        } catch (e) {
          console.error('Error caching sedes:', e);
        }
      }

      if (user.area) setArea(user.area);
    } catch (error) {
      console.error('Error loading catalogs:', error);
      const cachedAreas = await offlineStorage.getCachedAreas(user.id);
      const cachedSedes = await offlineStorage.getCachedProyectos(user.id);

      if (cachedAreas.length > 0) setAvailableAreas(cachedAreas.map(a => a.name));
      if (cachedSedes.length > 0) setAvailableSedes(cachedSedes.map(s => s.name));
      if (user.area) setArea(user.area);
    }
  };

  const handleTypeSelect = (selectedType: ReportType) => {
    setType(selectedType);
    setStep('category');
  };

  const handleCategorySelect = (catId: string) => {
    setCategoryId(catId);
    setStep('location');
  };

  const handleLocationNext = () => {
    setStep('description');
  };

  const handleDescriptionNext = () => {
    if (description.trim()) {
      setStep('closure');
    }
  };

  const handleSubmit = () => {
    const finalClosure = proposedClosure === 'Otro' ? customClosure : proposedClosure;
    if (type && categoryId && description && finalClosure) {
      onSubmit({
        type,
        categoryId,
        description,
        proposedClosure: finalClosure,
        area: area || undefined,
        proyecto: sede || undefined,
      });
    }
  };

  const closureOptions = [
    'Limpiar área',
    'Reparar equipo',
    'Señalizar peligro',
    'Reemplazar EPP',
    'Capacitación',
    'Otro',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="relative w-full h-full">
        <img
          src={photos.length > 0 ? URL.createObjectURL(photos[selectedPhotoIndex]) : previewUrl}
          alt="Preview"
          className="w-full h-full object-cover opacity-40"
        />

        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="absolute top-4 left-4 text-white text-sm bg-black/50 px-3 py-2 rounded-full">
          {photos.length} foto{photos.length !== 1 && 's'}
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/90 to-transparent p-6 max-h-[70vh] overflow-y-auto">
          {step === 'photos' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white mb-4">
                Fotos del reporte
              </h2>

              <div className="flex gap-2 overflow-x-auto pb-2">
                {photos.map((photo, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedPhotoIndex(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedPhotoIndex === index
                        ? 'border-red-500 scale-105'
                        : 'border-white/30'
                    }`}
                  >
                    <img
                      src={URL.createObjectURL(photo)}
                      alt={`Foto ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>

              <Button
                onClick={onAddMorePhotos}
                variant="secondary"
                size="lg"
                className="w-full flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Agregar más fotos
              </Button>

              <Button
                onClick={() => setStep('type')}
                variant="primary"
                size="lg"
                className="w-full"
              >
                Continuar con el reporte
              </Button>
            </div>
          )}

          {step === 'type' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white mb-4">
                ¿Qué tipo de reporte es?
              </h2>
              <button
                onClick={() => handleTypeSelect('unsafe_act')}
                className="w-full p-6 bg-white/10 hover:bg-white/20 border-2 border-white/30 rounded-xl text-white text-left transition-colors"
              >
                <h3 className="text-lg font-semibold mb-1">Acto Inseguro</h3>
                <p className="text-sm text-white/80">
                  Comportamiento o acción peligrosa de una persona
                </p>
              </button>
              <button
                onClick={() => handleTypeSelect('unsafe_condition')}
                className="w-full p-6 bg-white/10 hover:bg-white/20 border-2 border-white/30 rounded-xl text-white text-left transition-colors"
              >
                <h3 className="text-lg font-semibold mb-1">Condición Insegura</h3>
                <p className="text-sm text-white/80">
                  Estado o situación peligrosa en el ambiente
                </p>
              </button>
            </div>
          )}

          {step === 'category' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white mb-4">Selecciona una categoría</h2>
              <div className="grid grid-cols-2 gap-3">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat.id)}
                    className="p-4 bg-white/10 hover:bg-white/20 border-2 border-white/30 rounded-xl text-white text-center transition-colors"
                  >
                    <p className="font-semibold">{cat.name}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'location' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white mb-4">Ubicación del reporte</h2>

              <div>
                <label className="text-white text-sm mb-2 block">Área</label>
                <select
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full p-4 bg-white/10 border-2 border-white/30 rounded-xl text-white focus:bg-white/20 focus:border-white/50"
                >
                  <option value="" className="bg-gray-800">Selecciona un área</option>
                  {availableAreas.map((a) => (
                    <option key={a} value={a} className="bg-gray-800">
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-white text-sm mb-2 block">Sede</label>
                <select
                  value={sede}
                  onChange={(e) => setSede(e.target.value)}
                  className="w-full p-4 bg-white/10 border-2 border-white/30 rounded-xl text-white focus:bg-white/20 focus:border-white/50"
                >
                  <option value="" className="bg-gray-800">Selecciona una sede</option>
                  {availableSedes.map((s) => (
                    <option key={s} value={s} className="bg-gray-800">
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                onClick={handleLocationNext}
                variant="primary"
                size="lg"
                className="w-full"
              >
                Continuar
              </Button>
            </div>
          )}

          {step === 'description' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white mb-4">Describe lo observado</h2>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe qué observaste..."
                className="w-full h-32 p-4 bg-white/10 border-2 border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/20 focus:border-white/50 resize-none"
              />

              <Button
                onClick={handleDescriptionNext}
                variant="primary"
                size="lg"
                className="w-full"
                disabled={!description.trim()}
              >
                Continuar
              </Button>
            </div>
          )}

          {step === 'closure' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white mb-4">
                ¿Cómo se podría solucionar?
              </h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {closureOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => setProposedClosure(option)}
                    className={`p-4 rounded-xl text-white text-center transition-colors border-2 ${
                      proposedClosure === option
                        ? 'bg-red-600 border-red-500'
                        : 'bg-white/10 hover:bg-white/20 border-white/30'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              {proposedClosure === 'Otro' && (
                <textarea
                  value={customClosure}
                  onChange={(e) => setCustomClosure(e.target.value)}
                  placeholder="Describe la solución propuesta..."
                  className="w-full h-24 p-4 bg-white/10 border-2 border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/20 focus:border-white/50 resize-none"
                  autoFocus
                />
              )}

              <Button
                onClick={handleSubmit}
                variant="success"
                size="lg"
                className="w-full flex items-center justify-center gap-2"
                disabled={!proposedClosure || (proposedClosure === 'Otro' && !customClosure.trim())}
              >
                <Check className="w-5 h-5" />
                Enviar Reporte
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
