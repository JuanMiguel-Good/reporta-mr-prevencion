import { useState } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export function CompanySwitcher() {
  const { user, isMultiCompanyManager, availableCompanies, switchCompany } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const navigate = useNavigate();

  if (!user ||
      !isMultiCompanyManager ||
      !user.is_multi_company_manager ||
      user.role !== 'sst_manager' ||
      availableCompanies.length <= 1) {
    return null;
  }

  const currentCompany = availableCompanies.find((c) => c.company_id === user.company_id);

  const handleCompanySwitch = async (userId: string, companyId: string) => {
    if (switching || user.company_id === companyId) return;

    setSwitching(true);
    setIsOpen(false);

    try {
      await switchCompany(userId, companyId);
      navigate('/gallery');
    } catch (error) {
      console.error('Error switching company:', error);
      alert('Error al cambiar de empresa');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        {currentCompany?.company_logo ? (
          <img
            src={currentCompany.company_logo}
            alt={currentCompany.company_name}
            className="w-6 h-6 object-contain rounded"
          />
        ) : (
          <Building2 className="w-5 h-5 text-gray-600" />
        )}
        <span className="text-sm font-medium text-gray-900 max-w-[120px] truncate">
          {currentCompany?.company_name || user.company?.name || 'Empresa'}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase">Cambiar empresa</p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {availableCompanies.map((company) => {
                const isCurrent = company.company_id === user.company_id;
                return (
                  <button
                    key={company.company_id}
                    onClick={() => handleCompanySwitch(company.user_id, company.company_id)}
                    disabled={isCurrent || switching}
                    className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors disabled:opacity-50 ${
                      isCurrent ? 'bg-gray-50' : ''
                    }`}
                  >
                    {company.company_logo ? (
                      <img
                        src={company.company_logo}
                        alt={company.company_name}
                        className="w-8 h-8 object-contain rounded"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-gray-900">{company.company_name}</div>
                    </div>
                    {isCurrent && <Check className="w-5 h-5 text-red-600" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
