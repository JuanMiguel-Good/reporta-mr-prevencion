import { useState, useEffect } from 'react';
import { X, Search, Building2, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../common/Button';
import type { Plan, Company } from '../../types/database';

interface AssignPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  plan: Plan;
}

interface CompanyWithPlan extends Company {
  current_plan?: Plan | null;
}

export function AssignPlanModal({ isOpen, onClose, onSuccess, plan }: AssignPlanModalProps) {
  const [companies, setCompanies] = useState<CompanyWithPlan[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<CompanyWithPlan[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadCompanies();
    }
  }, [isOpen]);

  useEffect(() => {
    filterCompanies();
  }, [companies, searchTerm]);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('companies')
        .select(`
          *,
          current_plan:company_plans(plan:plans(*))
        `)
        .order('name');

      if (fetchError) throw fetchError;

      const companiesWithPlan = (data || []).map(company => ({
        ...company,
        current_plan: company.current_plan?.plan || null
      }));

      setCompanies(companiesWithPlan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar empresas');
    } finally {
      setLoading(false);
    }
  };

  const filterCompanies = () => {
    if (!searchTerm.trim()) {
      setFilteredCompanies(companies);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = companies.filter(company =>
      company.name.toLowerCase().includes(term)
    );
    setFilteredCompanies(filtered);
  };

  const toggleCompany = (companyId: string) => {
    const newSelected = new Set(selectedCompanies);
    if (newSelected.has(companyId)) {
      newSelected.delete(companyId);
    } else {
      newSelected.add(companyId);
    }
    setSelectedCompanies(newSelected);
  };

  const handleSubmit = async () => {
    if (selectedCompanies.size === 0) {
      setError('Debes seleccionar al menos una empresa');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const updates = Array.from(selectedCompanies).map(companyId => ({
        company_id: companyId,
        plan_id: plan.id,
      }));

      const { error: assignError } = await supabase
        .from('company_plans')
        .upsert(updates, {
          onConflict: 'company_id',
        });

      if (assignError) throw assignError;

      onSuccess();
      onClose();
      setSelectedCompanies(new Set());
      setSearchTerm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asignar plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Asignar Plan a Empresas
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Plan: <span className="font-medium">{plan.name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              Cargando empresas...
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No se encontraron empresas
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCompanies.map((company) => {
                const isSelected = selectedCompanies.has(company.id);
                const hasCurrentPlan = !!company.current_plan;

                return (
                  <button
                    key={company.id}
                    onClick={() => toggleCompany(company.id)}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-blue-600' : 'bg-gray-100'
                        }`}>
                          {isSelected ? (
                            <CheckCircle className="w-6 h-6 text-white" />
                          ) : (
                            <Building2 className="w-6 h-6 text-gray-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900">{company.name}</h4>
                          {hasCurrentPlan && (
                            <p className="text-sm text-gray-500 mt-1">
                              Plan actual: <span className="font-medium">{company.current_plan?.name}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <div className="px-6 pb-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              {error}
            </div>
          </div>
        )}

        <div className="p-6 border-t bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-600">
              {selectedCompanies.size} empresa{selectedCompanies.size !== 1 ? 's' : ''} seleccionada{selectedCompanies.size !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || selectedCompanies.size === 0}
              className="flex-1"
            >
              {isSubmitting ? 'Asignando...' : 'Asignar Plan'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}