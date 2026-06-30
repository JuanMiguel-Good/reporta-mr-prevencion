import { useState, useEffect } from 'react';
import { X, Sparkles, CreditCard as Edit3, AlertCircle, Check, Loader2, ChevronRight, Plus, Shield, FileSearch, Lightbulb } from 'lucide-react';
import { Button } from '../common/Button';
import { Category, ReportType, ReportPriority, AIAnalysisResult } from '../../types/database';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { analyzeImages, getConfidenceLabel, getConfidenceColor } from '../../utils/imageAnalysis';

interface IntelligentReportFlowProps {
  photos: File[];
  onSubmit: (data: {
    type: ReportType;
    categoryId: string;
    description: string;
    proposedClosure: string;
    priority: ReportPriority;
    area?: string;
    proyecto?: string;
    aiAnalysis?: AIAnalysisResult;
    manualOverride?: boolean;
  }) => void;
  onAddMorePhotos: () => void;
  onSwitchToManual: () => void;
  onCancel: () => void;
}

export function IntelligentReportFlow({
  photos,
  onSubmit,
  onAddMorePhotos,
  onSwitchToManual,
  onCancel
}: IntelligentReportFlowProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'photos' | 'analyzing' | 'review' | 'location' | 'confirm'>('photos');
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [error, setError] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [analysisStep, setAnalysisStep] = useState(0);

  const [type, setType] = useState<ReportType>('unsafe_condition');
  const [categoryId, setCategoryId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [proposedClosure, setProposedClosure] = useState('');
  const [priority, setPriority] = useState<ReportPriority>('medium');
  const [area, setArea] = useState('');
  const [proyecto, setProyecto] = useState('');
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableProyectos, setAvailableProyectos] = useState<string[]>([]);
  const [manualOverride, setManualOverride] = useState(false);

  useEffect(() => {
    loadCategories();
    loadAreasAndProyectos();
  }, [user]);

  useEffect(() => {
    if (step === 'analyzing') {
      setAnalysisStep(0);
      const interval = setInterval(() => {
        setAnalysisStep((prev) => {
          if (prev < 2) return prev + 1;
          return prev;
        });
      }, 800);
      return () => clearInterval(interval);
    }
  }, [step]);

  const loadCategories = async () => {
    if (!user) return;

    const { data: categoriesData } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('display_order');

    if (categoriesData) {
      setCategories(categoriesData);
    }
  };

  const startAnalysis = async () => {
    if (!user) return;

    setStep('analyzing');

    try {
      const categoryNames = categories.map(c => c.name);
      const result = await analyzeImages(photos, user.id, categoryNames);

      setAnalysis(result);
      setType(result.type);
      setDescription(result.description);
      setProposedClosure(result.proposedSolution);
      setPriority(result.priority || 'medium');

      const matchedCategory = categories.find(
        c => c.name.toLowerCase() === result.suggestedCategory.toLowerCase()
      );
      if (matchedCategory) {
        setCategoryId(matchedCategory.id);
      }

      setStep('review');
    } catch (err: any) {
      console.error('AI Analysis error:', err);

      if (err.code === 'CONTENT_FILTERED' || err.code === 'CONTENT_REFUSED') {
        setError('No podemos analizar imágenes con personas por políticas de privacidad. Por favor completa manualmente.');
      } else if (err.code === 'LIMIT_EXCEEDED') {
        setError('Has alcanzado el límite mensual de análisis automático. Completa manualmente para continuar.');
      } else {
        setError(err.message || 'No pudimos completar el análisis automático.');
      }

      setStep('review');
    }
  };

  const loadAreasAndProyectos = async () => {
    if (!user) return;

    const { data: areasData } = await supabase
      .from('areas')
      .select('name')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('name');

    const { data: proyectosData } = await supabase
      .from('proyectos')
      .select('name')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('name');

    if (areasData) {
      setAvailableAreas(areasData.map(a => a.name));
    }

    if (proyectosData) {
      setAvailableProyectos(proyectosData.map(p => p.name));
    }

    if (user.area) setArea(user.area);
    if (user.proyecto) setProyecto(user.proyecto);
  };

  const handleFieldEdit = () => {
    setManualOverride(true);
  };

  const handleSubmit = () => {
    if (type && categoryId && description && proposedClosure) {
      onSubmit({
        type,
        categoryId,
        description,
        proposedClosure,
        priority,
        area: area || undefined,
        proyecto: proyecto || undefined,
        aiAnalysis: analysis || undefined,
        manualOverride
      });
    }
  };

  const previewUrl = photos.length > 0 ? URL.createObjectURL(photos[selectedPhotoIndex]) : '';

  if (step === 'photos') {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <div className="relative w-full h-full">
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-full object-cover opacity-40"
          />

          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="absolute top-4 left-4 flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 rounded-full z-10">
            <Sparkles className="w-5 h-5 text-white" />
            <span className="text-white font-semibold text-sm">Análisis Inteligente</span>
          </div>

          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-2 rounded-full">
            {photos.length} foto{photos.length !== 1 && 's'}
          </div>

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/90 to-transparent p-6 max-h-[70vh] overflow-y-auto">
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white mb-4">
                Fotos del reporte
              </h2>
              <p className="text-white/70 text-sm mb-3">
                La IA analizará {photos.length === 1 ? 'esta imagen' : `estas ${photos.length} imágenes`} para identificar riesgos y generar recomendaciones
              </p>

              <div className="flex gap-2 overflow-x-auto pb-2">
                {photos.map((photo, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedPhotoIndex(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedPhotoIndex === index
                        ? 'border-cyan-500 scale-105'
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
                onClick={startAnalysis}
                variant="primary"
                size="lg"
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
              >
                <Sparkles className="w-5 h-5" />
                Analizar con IA
              </Button>

              <button
                onClick={onSwitchToManual}
                className="w-full text-center text-white/70 hover:text-white text-sm py-2 transition-colors"
              >
                Completar manualmente sin IA
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'analyzing') {
    const analysisSteps = [
      { icon: Shield, label: 'Revisando elementos de seguridad', color: 'from-cyan-500 to-blue-500' },
      { icon: FileSearch, label: 'Evaluando tipo de riesgo', color: 'from-blue-500 to-indigo-500' },
      { icon: Lightbulb, label: 'Preparando recomendaciones', color: 'from-indigo-500 to-purple-500' }
    ];

    return (
      <div className="fixed inset-0 z-50 bg-black">
        <div className="relative w-full h-full">
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-full object-cover opacity-30"
          />

          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 bg-gradient-to-b from-black/50 via-black/60 to-black/80">
            <div className="relative mb-8">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 animate-pulse flex items-center justify-center shadow-2xl">
                <Sparkles className="w-16 h-16 text-white" />
              </div>
              <Loader2 className="w-8 h-8 text-cyan-300 absolute -bottom-2 -right-2 animate-spin" />
            </div>

            <h2 className="text-3xl font-bold text-white mb-4 text-center">
              Analizando {photos.length} {photos.length === 1 ? 'imagen' : 'imágenes'}
            </h2>
            <p className="text-white/90 text-center max-w-md mb-8 text-lg">
              Estamos identificando riesgos de seguridad en {photos.length === 1 ? 'tu fotografía' : 'tus fotografías'}...
            </p>

            <div className="w-full max-w-md mb-6">
              <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500 ease-out"
                  style={{ width: `${((analysisStep + 1) / 3) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-4 w-full max-w-md">
              {analysisSteps.map((stepInfo, index) => {
                const Icon = stepInfo.icon;
                const isCompleted = index < analysisStep;
                const isActive = index === analysisStep;
                const isPending = index > analysisStep;

                return (
                  <div
                    key={index}
                    className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-500 ${
                      isActive
                        ? 'bg-gradient-to-r ' + stepInfo.color + ' shadow-lg scale-105'
                        : isCompleted
                        ? 'bg-white/10 backdrop-blur-sm'
                        : 'bg-white/5'
                    }`}
                  >
                    <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${
                      isCompleted
                        ? 'bg-green-500 shadow-lg'
                        : isActive
                        ? 'bg-white/20 animate-pulse'
                        : 'bg-white/10'
                    }`}>
                      {isCompleted ? (
                        <Check className="w-6 h-6 text-white" />
                      ) : isActive ? (
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      ) : (
                        <Icon className="w-6 h-6 text-white/50" />
                      )}
                    </div>
                    <span className={`text-base font-medium transition-all duration-500 ${
                      isActive
                        ? 'text-white'
                        : isCompleted
                        ? 'text-white/80'
                        : 'text-white/50'
                    }`}>
                      {stepInfo.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="mt-8 p-4 bg-red-500/20 backdrop-blur-md border border-red-500/50 rounded-xl text-white max-w-md">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">No pudimos analizar automáticamente</p>
                    <p className="text-sm text-white/90">{error}</p>
                    <Button
                      onClick={onSwitchToManual}
                      variant="secondary"
                      size="sm"
                      className="mt-3"
                    >
                      Continuar manualmente
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'review') {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <div className="relative w-full h-full">
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-full object-cover opacity-40 fixed inset-0"
          />

          <button
            onClick={onCancel}
            className="fixed top-4 right-4 p-2 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors z-20"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="fixed top-4 left-4 flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 rounded-full z-20 shadow-lg">
            <Sparkles className="w-5 h-5 text-white" />
            <span className="text-white font-semibold text-sm">Análisis Inteligente</span>
            {analysis && (
              <span className={`text-xs font-medium px-2 py-0.5 bg-white/20 rounded-full ${getConfidenceColor(analysis.confidence)}`}>
                {getConfidenceLabel(analysis.confidence)}
              </span>
            )}
          </div>

          <div className="absolute inset-0 overflow-y-auto bg-gradient-to-b from-black/50 via-black/80 to-black">
            <div className="min-h-full flex flex-col pt-20 pb-6 px-6">
            {error && !analysis ? (
              <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3 text-white">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">No pudimos analizar automáticamente</p>
                    <p className="text-sm text-white/80 mb-3">{error}</p>
                    <Button onClick={onSwitchToManual} variant="secondary" size="sm">
                      Completar manualmente
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold text-white">
                    Revisa lo que encontramos
                  </h2>
                  <button
                    onClick={onSwitchToManual}
                    className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <Edit3 className="w-4 h-4" />
                    Editar manualmente
                  </button>
                </div>

                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
                  <label className="text-white/80 text-sm mb-2 block">Tipo de reporte</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setType('unsafe_act'); handleFieldEdit(); }}
                      className={`flex-1 p-3 rounded-lg text-white transition-all ${
                        type === 'unsafe_act'
                          ? 'bg-gradient-to-r from-orange-500 to-red-500 shadow-lg'
                          : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      <div className="font-semibold text-sm">Acto Inseguro</div>
                    </button>
                    <button
                      onClick={() => { setType('unsafe_condition'); handleFieldEdit(); }}
                      className={`flex-1 p-3 rounded-lg text-white transition-all ${
                        type === 'unsafe_condition'
                          ? 'bg-gradient-to-r from-orange-500 to-red-500 shadow-lg'
                          : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      <div className="font-semibold text-sm">Condición Insegura</div>
                    </button>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
                  <label className="text-white/80 text-sm mb-2 block">Categoría</label>
                  <select
                    value={categoryId}
                    onChange={(e) => { setCategoryId(e.target.value); handleFieldEdit(); }}
                    className="w-full p-3 bg-white/10 border-2 border-white/30 rounded-xl text-white focus:bg-white/20 focus:border-cyan-400"
                  >
                    <option value="" className="bg-gray-800">Selecciona categoría</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id} className="bg-gray-800">
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
                  <label className="text-white/80 text-sm mb-2 block">Nivel de riesgo</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => { setPriority('low'); handleFieldEdit(); }}
                      className={`p-3 rounded-lg text-white transition-all ${
                        priority === 'low'
                          ? 'bg-green-600 shadow-lg ring-2 ring-green-400'
                          : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      <div className="font-semibold text-sm">Baja</div>
                    </button>
                    <button
                      onClick={() => { setPriority('medium'); handleFieldEdit(); }}
                      className={`p-3 rounded-lg text-white transition-all ${
                        priority === 'medium'
                          ? 'bg-yellow-600 shadow-lg ring-2 ring-yellow-400'
                          : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      <div className="font-semibold text-sm">Media</div>
                    </button>
                    <button
                      onClick={() => { setPriority('high'); handleFieldEdit(); }}
                      className={`p-3 rounded-lg text-white transition-all ${
                        priority === 'high'
                          ? 'bg-orange-600 shadow-lg ring-2 ring-orange-400'
                          : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      <div className="font-semibold text-sm">Alta</div>
                    </button>
                    <button
                      onClick={() => { setPriority('critical'); handleFieldEdit(); }}
                      className={`p-3 rounded-lg text-white transition-all ${
                        priority === 'critical'
                          ? 'bg-red-600 shadow-lg ring-2 ring-red-400'
                          : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      <div className="font-semibold text-sm">Crítica</div>
                    </button>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
                  <label className="text-white/80 text-sm mb-2 block">Descripción del riesgo</label>
                  <textarea
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); handleFieldEdit(); }}
                    className="w-full h-32 p-3 bg-white/10 border-2 border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/20 focus:border-cyan-400 resize-none"
                    placeholder="Describe lo observado..."
                  />
                </div>

                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
                  <label className="text-white/80 text-sm mb-2 block">Solución propuesta</label>
                  <textarea
                    value={proposedClosure}
                    onChange={(e) => { setProposedClosure(e.target.value); handleFieldEdit(); }}
                    className="w-full h-24 p-3 bg-white/10 border-2 border-white/30 rounded-xl text-white placeholder-white/50 focus:bg-white/20 focus:border-cyan-400 resize-none"
                    placeholder="¿Cómo se podría solucionar?"
                  />
                </div>

                {analysis && analysis.detectedElements && analysis.detectedElements.length > 0 && (
                  <div className="bg-cyan-500/20 border border-cyan-500/50 rounded-xl p-4">
                    <div className="text-white/80 text-sm mb-2">Elementos detectados:</div>
                    <div className="flex flex-wrap gap-2">
                      {analysis.detectedElements.map((element, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-cyan-500/30 text-cyan-100 rounded-full text-xs font-medium"
                        >
                          {element}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => setStep('location')}
                  variant="primary"
                  size="lg"
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                  disabled={!type || !categoryId || !description || !proposedClosure}
                >
                  Continuar
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'location') {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <div className="relative w-full h-full">
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-full object-cover opacity-40"
          />

          <button
            onClick={() => setStep('review')}
            className="absolute top-4 left-4 p-2 bg-black/50 rounded-full text-white"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/90 to-transparent p-6">
            <h2 className="text-xl font-bold text-white mb-4">Ubicación del reporte</h2>

            <div className="space-y-4">
              <div>
                <label className="text-white text-sm mb-2 block">Área</label>
                <select
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full p-4 bg-white/10 border-2 border-white/30 rounded-xl text-white focus:bg-white/20 focus:border-cyan-400"
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
                <label className="text-white text-sm mb-2 block">Proyecto</label>
                <select
                  value={proyecto}
                  onChange={(e) => setProyecto(e.target.value)}
                  className="w-full p-4 bg-white/10 border-2 border-white/30 rounded-xl text-white focus:bg-white/20 focus:border-cyan-400"
                >
                  <option value="" className="bg-gray-800">Selecciona un proyecto</option>
                  {availableProyectos.map((p) => (
                    <option key={p} value={p} className="bg-gray-800">
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                onClick={handleSubmit}
                variant="success"
                size="lg"
                className="w-full flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                Enviar Reporte
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
