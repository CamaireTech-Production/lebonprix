import React, { useState } from 'react';

interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  component: React.ComponentType<Record<string, unknown>>;
}

interface TabbedSettingsProps {
  tabs: Tab[];
  defaultTab?: string;
  className?: string;
}

const TabbedSettings: React.FC<TabbedSettingsProps> = ({ 
  tabs, 
  defaultTab, 
  className = '' 
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const activeTabData = tabs.find(tab => tab.id === activeTab);
  const ActiveComponent = activeTabData?.component;

  return (
    <div className={`bg-white rounded-lg shadow-sm ${className}`}>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-1 sm:space-x-8 px-2 sm:px-6 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center space-x-1 sm:space-x-2 py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap
                  ${isActive 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon size={16} className={`sm:w-[18px] sm:h-[18px] ${isActive ? 'text-primary' : 'text-gray-400'}`} />
                <span className="hidden xs:inline sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  );
};

export default TabbedSettings;
