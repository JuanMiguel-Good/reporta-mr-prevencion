import { useState } from 'react';
import { Tag, MapPin, FolderKanban } from 'lucide-react';
import { CategoriesSection } from '../components/configuration/CategoriesSection';
import { AreasSection } from '../components/configuration/AreasSection';
import { ProyectosSection } from '../components/configuration/ProyectosSection';

type TabType = 'categories' | 'areas' | 'proyectos';

export function ConfigurationPage() {
  const [activeTab, setActiveTab] = useState<TabType>('categories');

  const tabs = [
    { id: 'categories' as TabType, label: 'Categorías', icon: Tag },
    { id: 'areas' as TabType, label: 'Áreas', icon: MapPin },
    { id: 'proyectos' as TabType, label: 'Proyectos', icon: FolderKanban },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuración</h1>
          <p className="text-gray-600">Gestiona las categorías, áreas y proyectos de tu empresa</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap border-b-2 ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'categories' && <CategoriesSection />}
            {activeTab === 'areas' && <AreasSection />}
            {activeTab === 'proyectos' && <ProyectosSection />}
          </div>
        </div>
      </div>
    </div>
  );
}
