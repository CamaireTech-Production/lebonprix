import React, { useState } from 'react';
import AdminDashboardLayout from '../../components/layout/AdminDashboardLayout';
import { inspectAllRestaurants, generateInspectionReport, fixRestaurantStructure, fixRestaurantStructureEnhanced, validateRestaurantCreationPattern } from '../../utils/restaurantInspector';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

interface RestaurantInspectionResult {
  id: string;
  email: string;
  name?: string;
  hasAuthUser: boolean;
  authUserEmail?: string;
  firestoreData: any;
  issues: string[];
  isAdminCreated: boolean;
  isNormalSignup: boolean;
  missingFields: string[];
  extraFields: string[];
}

const RestaurantInspector: React.FC = () => {
  const [results, setResults] = useState<RestaurantInspectionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [report, setReport] = useState('');
  const [validationReport, setValidationReport] = useState('');

  const handleInspect = async () => {
    setLoading(true);
    setResults([]);
    setReport('');
    setValidationReport('');
    
    try {
      const inspectionResults = await inspectAllRestaurants();
      setResults(inspectionResults);
      
      const generatedReport = generateInspectionReport(inspectionResults);
      setReport(generatedReport);
      
      const validationReportText = validateRestaurantCreationPattern();
      setValidationReport(validationReportText);
      
      const criticalIssues = inspectionResults.filter(r => 
        r.issues.some(issue => issue.includes('CRITICAL'))
      );
      
      if (criticalIssues.length > 0) {
        toast.error(`Found ${criticalIssues.length} critical issues that need fixing!`);
      } else {
        toast.success('Inspection completed. No critical issues found.');
      }
    } catch (error) {
      console.error('Inspection error:', error);
      toast.error('Failed to inspect restaurants');
    } finally {
      setLoading(false);
    }
  };

  const handleFixAll = async () => {
    const criticalIssues = results.filter(r => 
      r.issues.some(issue => issue.includes('CRITICAL'))
    );
    
    if (criticalIssues.length === 0) {
      toast.info('No critical issues to fix');
      return;
    }

    setFixing(true);
    let fixedCount = 0;
    let errorCount = 0;
    let errorDetails: string[] = [];

    try {
      for (const restaurant of criticalIssues) {
        try {
          const result = await fixRestaurantStructureEnhanced(restaurant.id);
          if (result.success) {
            fixedCount++;
            console.log(`Fixed restaurant ${restaurant.id}:`, result.message);
          } else {
            errorCount++;
            errorDetails.push(`${restaurant.name || restaurant.email}: ${result.message}`);
            console.error(`Failed to fix restaurant ${restaurant.id}:`, result.details);
          }
        } catch (error) {
          console.error(`Error fixing ${restaurant.id}:`, error);
          errorCount++;
          errorDetails.push(`${restaurant.name || restaurant.email}: ${error.message}`);
        }
      }

      if (fixedCount > 0) {
        toast.success(`Fixed ${fixedCount} restaurant structures`);
        // Re-run inspection to get updated results
        await handleInspect();
      }
      
      if (errorCount > 0) {
        toast.error(`Failed to fix ${errorCount} restaurants. Check console for details.`);
        console.error('Fix errors:', errorDetails);
      }
    } catch (error) {
      console.error('Fix all error:', error);
      toast.error('Failed to fix restaurants');
    } finally {
      setFixing(false);
    }
  };

  const handleFixSingle = async (restaurantId: string) => {
    setFixing(true);
    try {
      const result = await fixRestaurantStructureEnhanced(restaurantId);
      if (result.success) {
        toast.success(result.message);
        // Re-run inspection
        await handleInspect();
      } else {
        toast.error(result.message);
        console.error('Fix failed:', result.details);
      }
    } catch (error) {
      console.error('Fix single error:', error);
      toast.error('Failed to fix restaurant structure');
    } finally {
      setFixing(false);
    }
  };

  const criticalIssues = results.filter(r => 
    r.issues.some(issue => issue.includes('CRITICAL'))
  );

  return (
    <AdminDashboardLayout>
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Restaurant Structure Inspector</h1>
        
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">⚠️ Critical Issue Detected</h2>
          <p className="text-yellow-700">
            Admin-created restaurants have incorrect document structure. The AuthContext expects 
            the Firestore document ID to match the Firebase Auth UID, but admin-created restaurants 
            have a separate <code>uid</code> field with a different value.
          </p>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={handleInspect}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <LoadingSpinner size={20} color="#fff" /> : null}
            {loading ? 'Inspecting...' : 'Inspect All Restaurants'}
          </button>

          {criticalIssues.length > 0 && (
            <button
              onClick={handleFixAll}
              disabled={fixing}
              className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {fixing ? <LoadingSpinner size={20} color="#fff" /> : null}
              {fixing ? 'Fixing...' : `Fix All Critical Issues (${criticalIssues.length})`}
            </button>
          )}
        </div>

        {results.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Inspection Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{results.length}</div>
                <div className="text-sm text-blue-700">Total Restaurants</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {results.filter(r => r.isNormalSignup).length}
                </div>
                <div className="text-sm text-green-700">Normal Signup</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {results.filter(r => r.isAdminCreated).length}
                </div>
                <div className="text-sm text-orange-700">Admin Created</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{criticalIssues.length}</div>
                <div className="text-sm text-red-700">Critical Issues</div>
              </div>
            </div>
          </div>
        )}

        {criticalIssues.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4 text-red-600">Critical Issues</h2>
            <div className="space-y-4">
              {criticalIssues.map((restaurant) => (
                <div key={restaurant.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-red-800">
                        {restaurant.name || restaurant.email}
                      </h3>
                      <p className="text-sm text-red-600">ID: {restaurant.id}</p>
                      <p className="text-sm text-red-600">UID: {restaurant.firestoreData.uid}</p>
                    </div>
                    <button
                      onClick={() => handleFixSingle(restaurant.id)}
                      disabled={fixing}
                      className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                    >
                      Fix This
                    </button>
                  </div>
                  <div className="text-sm text-red-700">
                    <strong>Issues:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {restaurant.issues.map((issue, index) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {validationReport && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Creation Pattern Validation</h2>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <pre className="text-sm whitespace-pre-wrap font-mono text-green-800">{validationReport}</pre>
            </div>
          </div>
        )}

        {report && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Detailed Report</h2>
            <div className="bg-gray-100 p-4 rounded-lg">
              <pre className="text-sm whitespace-pre-wrap font-mono">{report}</pre>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">All Restaurants</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issues</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {results.map((restaurant) => (
                    <tr key={restaurant.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        {restaurant.name || 'No name'}
                      </td>
                      <td className="px-4 py-3 text-sm">{restaurant.email}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          restaurant.isAdminCreated 
                            ? 'bg-orange-100 text-orange-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {restaurant.isAdminCreated ? 'Admin' : 'Normal'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {restaurant.issues.length > 0 ? (
                          <span className="text-red-600 font-medium">
                            {restaurant.issues.length} issue(s)
                          </span>
                        ) : (
                          <span className="text-green-600">OK</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {restaurant.issues.some(issue => issue.includes('CRITICAL')) && (
                          <button
                            onClick={() => handleFixSingle(restaurant.id)}
                            disabled={fixing}
                            className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50"
                          >
                            Fix
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminDashboardLayout>
  );
};

export default RestaurantInspector; 