import { useState, useEffect } from 'react';
import { Plus, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
import { PlanCard } from '../components/plans/PlanCard';
import { PlanFormModal } from '../components/plans/PlanFormModal';
import { AssignPlanModal } from '../components/plans/AssignPlanModal';
import { LimitRequestManagement } from '../components/ai/LimitRequestManagement';
import type { Plan } from '../types/database';

export function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [planToAssign, setPlanToAssign] = useState<Plan | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPlans(data || []);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (plan: Plan) => {
    setSelectedPlan(plan);
    setShowFormModal(true);
  };

  const handleDelete = async (plan: Plan) => {
    if (!confirm(`¿Estás seguro de eliminar el plan "${plan.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('plans')
        .delete()
        .eq('id', plan.id);

      if (error) throw error;

      await loadPlans();
    } catch (error) {
      console.error('Error deleting plan:', error);
      alert('Error al eliminar el plan. Puede que esté asignado a empresas.');
    }
  };

  const handleToggleActive = async (plan: Plan) => {
    try {
      const { error } = await supabase
        .from('plans')
        .update({ active: !plan.active })
        .eq('id', plan.id);

      if (error) throw error;

      await loadPlans();
    } catch (error) {
      console.error('Error toggling plan status:', error);
      alert('Error al cambiar el estado del plan');
    }
  };

  const handleAssign = (plan: Plan) => {
    setPlanToAssign(plan);
    setShowAssignModal(true);
  };

  const handleCreateNew = () => {
    setSelectedPlan(null);
    setShowFormModal(true);
  };

  const handleFormSuccess = () => {
    loadPlans();
  };

  const handleAssignSuccess = () => {
    loadPlans();
  };

  const handleCloseFormModal = () => {
    setShowFormModal(false);
    setSelectedPlan(null);
  };

  const handleCloseAssignModal = () => {
    setShowAssignModal(false);
    setPlanToAssign(null);
  };

  if (loading) {
    return <Loading fullScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Planes</h1>
            <p className="text-gray-600 mt-1">
              Administra los planes disponibles para las empresas
            </p>
          </div>
          <Button onClick={handleCreateNew}>
            <Plus className="w-5 h-5 mr-2" />
            Nuevo Plan
          </Button>
        </div>

        {plans.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No hay planes creados
            </h3>
            <p className="text-gray-600 mb-6">
              Crea tu primer plan para comenzar a asignarlo a empresas
            </p>
            <Button onClick={handleCreateNew}>
              <Plus className="w-5 h-5 mr-2" />
              Crear Primer Plan
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleActive={handleToggleActive}
                onAssign={handleAssign}
              />
            ))}
          </div>
        )}

        <LimitRequestManagement />
      </div>

      <PlanFormModal
        isOpen={showFormModal}
        onClose={handleCloseFormModal}
        onSuccess={handleFormSuccess}
        plan={selectedPlan}
      />

      {planToAssign && (
        <AssignPlanModal
          isOpen={showAssignModal}
          onClose={handleCloseAssignModal}
          onSuccess={handleAssignSuccess}
          plan={planToAssign}
        />
      )}
    </div>
  );
}