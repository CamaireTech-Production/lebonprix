import { useState, useEffect } from 'react';
import { Save, Trash2, Download } from 'lucide-react';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Input from '../common/Input';

export interface SavedReport {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  selectedProduct: string;
  selectedCategory: string;
  period: string;
  createdAt: string;
}

interface SavedReportsManagerProps {
  companyId: string;
  currentConfig: {
    startDate: string;
    endDate: string;
    selectedProduct: string;
    selectedCategory: string;
    period: string;
  };
  onLoadReport: (report: SavedReport) => void;
}

const SavedReportsManager = ({ 
  companyId, 
  currentConfig, 
  onLoadReport 
}: SavedReportsManagerProps) => {
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [reportName, setReportName] = useState('');
  const [showLoadMenu, setShowLoadMenu] = useState(false);

  useEffect(() => {
    loadSavedReports();
  }, [companyId]);

  const loadSavedReports = () => {
    const key = `saved_reports_${companyId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setSavedReports(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved reports:', e);
      }
    }
  };

  const saveCurrentReport = () => {
    if (!reportName.trim()) {
      alert('Please enter a name for the report');
      return;
    }

    const newReport: SavedReport = {
      id: Date.now().toString(),
      name: reportName.trim(),
      ...currentConfig,
      createdAt: new Date().toISOString()
    };

    const key = `saved_reports_${companyId}`;
    const updated = [...savedReports, newReport];
    localStorage.setItem(key, JSON.stringify(updated));
    setSavedReports(updated);
    setReportName('');
    setShowSaveModal(false);
  };

  const deleteReport = (id: string) => {
    if (!confirm('Are you sure you want to delete this saved report?')) return;
    
    const key = `saved_reports_${companyId}`;
    const updated = savedReports.filter(r => r.id !== id);
    localStorage.setItem(key, JSON.stringify(updated));
    setSavedReports(updated);
  };

  return (
    <div className="flex items-center space-x-2">
      <Button
        variant="outline"
        icon={<Save size={16} />}
        onClick={() => setShowSaveModal(true)}
      >
        Save Report
      </Button>

      {savedReports.length > 0 && (
        <div className="relative">
          <Button
            variant="outline"
            onClick={() => setShowLoadMenu(!showLoadMenu)}
          >
            Load Saved ({savedReports.length})
          </Button>

          {showLoadMenu && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowLoadMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                <div className="max-h-64 overflow-y-auto">
                  {savedReports.map((report) => (
                    <div
                      key={report.id}
                      className="p-3 border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div 
                          className="flex-1"
                          onClick={() => {
                            onLoadReport(report);
                            setShowLoadMenu(false);
                          }}
                        >
                          <p className="text-sm font-medium text-gray-900">{report.name}</p>
                          <p className="text-xs text-gray-500">
                            {report.startDate} to {report.endDate}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteReport(report.id);
                          }}
                          className="ml-2 text-red-600 hover:text-red-800"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <Modal
        isOpen={showSaveModal}
        onClose={() => {
          setShowSaveModal(false);
          setReportName('');
        }}
        title="Save Report Configuration"
      >
        <div className="space-y-4">
          <Input
            label="Report Name"
            value={reportName}
            onChange={(e) => setReportName(e.target.value)}
            placeholder="e.g., Monthly Sales Report"
          />
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowSaveModal(false);
                setReportName('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveCurrentReport}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SavedReportsManager;

