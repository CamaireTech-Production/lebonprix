import { useMemo, useState, useEffect } from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';
import { useAuth } from '../../contexts/AuthContext';
import type { CompanyEmployee, UserRole } from '../../types/models';
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import { saveEmployee } from '../../services/employeeService';

const defaultNewEmployee: Omit<CompanyEmployee, 'id' | 'firebaseUid' | 'createdAt' | 'updatedAt'> = {
  firstname: '',
  lastname: '',
  email: '',
  role: 'staff',
  phone: '',
  birthday: ''
};

export default function EmployeesTab() {
  const { company } = useAuth();
  
  // Convert company.employees object to array if it exists
  const initialEmployees = useMemo((): CompanyEmployee[] => {
    if (!company?.employees) return [];
    if (Array.isArray(company.employees)) return company.employees;
    // If it's an object, convert to array
    return Object.values(company.employees) as CompanyEmployee[];
  }, [company?.employees]);
  
  const [employees, setEmployees] = useState<CompanyEmployee[]>(initialEmployees);
  const [newEmployee, setNewEmployee] = useState<Omit<CompanyEmployee, 'id' | 'firebaseUid' | 'createdAt' | 'updatedAt'>>({ ...defaultNewEmployee });
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Update employees state when company changes
  useEffect(() => {
    setEmployees(initialEmployees);
  }, [initialEmployees]);

  const existingEmails = useMemo(() => new Set((employees || []).map(e => e.email.toLowerCase().trim())), [employees]);

  // Dashboard stats
  const totalEmployees = employees.length;
  const pendingInvites = useMemo(() => employees.filter(e => !e.loginLink).length, [employees]);

  const resetNew = () => setNewEmployee({ ...defaultNewEmployee });

  const validateEmployee = (emp: Omit<CompanyEmployee, 'id' | 'firebaseUid' | 'createdAt' | 'updatedAt'>): string | null => {
    if (!emp.firstname.trim()) return 'Firstname is required';
    if (!emp.lastname.trim()) return 'Lastname is required';
    if (!emp.email.trim()) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emp.email)) return 'Invalid email';
    if (!['admin', 'manager', 'staff'].includes(emp.role)) return 'Invalid role';
    return null;
  };

  const addEmployee = async () => {
    if (!company?.id) {
      showErrorToast('Company not found');
      return;
    }

    const err = validateEmployee(newEmployee);
    if (err) {
      showErrorToast(err);
      return;
    }
    if (existingEmails.has(newEmployee.email.toLowerCase().trim())) {
      showErrorToast('Email already exists for this company');
      return;
    }

    try {
      setIsSaving(true);
      
      // Utiliser le nouveau service qui crée automatiquement l'utilisateur Firebase Auth
      const createdEmployee = await saveEmployee(company.id, newEmployee);
      
      // Ajouter à la liste locale
      setEmployees(prev => [...prev, createdEmployee]);
      
      // Réinitialiser le formulaire
      resetNew();
      
      showSuccessToast('Employé créé avec succès');
    } catch (error: any) {
      console.error('Erreur lors de l\'ajout de l\'employé:', error);
      showErrorToast(error.message || 'Erreur lors de la création de l\'employé');
    } finally {
      setIsSaving(false);
    }
  };

  const updateEmployeeField = (index: number, field: keyof CompanyEmployee, value: string) => {
    setEmployees(prev => prev.map((emp, i) => i === index ? { ...emp, [field]: value } : emp));
  };

  const removeEmployee = (index: number) => {
    setEmployees(prev => prev.filter((_, i) => i !== index));
  };


  const buildEmployeeLoginUrl = (emp: CompanyEmployee) => {
    if (!company?.id || !company?.name || !emp.loginLink) return '';
    const base = window.location.origin;
    const path = `/employee-login/${encodeURIComponent(company.name)}/${encodeURIComponent(company.id)}/${encodeURIComponent(emp.loginLink)}`;
    return `${base}${path}`;
  }; 
  
  const copyLoginLink = (emp: CompanyEmployee) => {
    const url = buildEmployeeLoginUrl(emp);
    if (!url) {
      showErrorToast('Login link unavailable');
      return;
    }
    navigator.clipboard.writeText(url);
    showSuccessToast('Login link copied');
  };
  
  const openLoginLink = (emp: CompanyEmployee) => {
    const url = buildEmployeeLoginUrl(emp);
    if (!url) {
      showErrorToast('Login link unavailable');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card>
      <div className="max-w-3xl mx-auto">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Employees</h3>

        {/* Dashboard summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <div className="p-4 rounded-lg border bg-white">
            <div className="text-xs text-gray-500">Total</div>
            <div className="text-2xl font-semibold text-gray-900">{totalEmployees}</div>
          </div>
          <div className="p-4 rounded-lg border bg-white">
            <div className="text-xs text-gray-500">Pending invite</div>
            <div className="text-2xl font-semibold text-gray-900">{pendingInvites}</div>
          </div>
        </div>

        {/* Add new employee */}
        <div className="space-y-3 p-4 mb-6 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Firstname" value={newEmployee.firstname} onChange={(e) => setNewEmployee(prev => ({ ...prev, firstname: e.target.value }))} />
            <Input label="Lastname" value={newEmployee.lastname} onChange={(e) => setNewEmployee(prev => ({ ...prev, lastname: e.target.value }))} />
            <Input label="Email" type="email" value={newEmployee.email} onChange={(e) => setNewEmployee(prev => ({ ...prev, email: e.target.value }))} />
            <Input label="Phone" value={newEmployee.phone || ''} onChange={(e) => setNewEmployee(prev => ({ ...prev, phone: e.target.value }))} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                value={newEmployee.role}
                onChange={(e) => setNewEmployee(prev => ({ ...prev, role: e.target.value as UserRole }))}
              >
                <option value="staff">vendeur</option>
                <option value="manager">gestionnaire</option>
                <option value="admin">magasinier</option>
              </select>
            </div>
            <Input label="Birthday (YYYY-MM-DD)" value={newEmployee.birthday || ''} onChange={(e) => setNewEmployee(prev => ({ ...prev, birthday: e.target.value }))} />
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={addEmployee} isLoading={isSaving} disabled={isSaving}>Add employee</Button>
          </div>
        </div>

        {/* Employees list */}
        <div className="space-y-3">
          {employees.length === 0 && (
            <div className="text-sm text-gray-600">No employees yet.</div>
          )}
          {employees.map((emp, index) => (
            <div key={`${emp.email}-${index}`} className="p-4 border rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="Firstname" value={emp.firstname} onChange={(e) => updateEmployeeField(index, 'firstname', e.target.value)} />
                <Input label="Lastname" value={emp.lastname} onChange={(e) => updateEmployeeField(index, 'lastname', e.target.value)} />
                <Input label="Email" type="email" value={emp.email} onChange={(e) => updateEmployeeField(index, 'email', e.target.value)} />
                <Input label="Phone" value={emp.phone || ''} onChange={(e) => updateEmployeeField(index, 'phone', e.target.value)} />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    className="w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                    value={emp.role}
                    onChange={(e) => updateEmployeeField(index, 'role', e.target.value)}
                  >
                    <option value="staff">vendeur</option>
                    <option value="manager">gestionnaire</option>
                    <option value="admin">magasinier</option>
                  </select>
                </div>
                <Input label="Birthday (YYYY-MM-DD)" value={emp.birthday || ''} onChange={(e) => updateEmployeeField(index, 'birthday', e.target.value)} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="text-xs text-gray-500 break-all">
                  {emp.loginLink ? buildEmployeeLoginUrl(emp) : 'No invite link'}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" type="button" onClick={() => setSelectedIndex(index)}>View</Button>
                  <Button variant="outline" type="button" onClick={() => copyLoginLink(emp)}>Copy link</Button>
                  <Button variant="outline" type="button" onClick={() => openLoginLink(emp)}>Open</Button>
                  <Button variant="outline" type="button" onClick={() => removeEmployee(index)}>Remove</Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Details panel */}
        {selectedIndex !== null && employees[selectedIndex] && (
          <div className="mt-6 p-4 rounded-lg border bg-white">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-md font-semibold text-gray-900">Employee details</h4>
              <Button variant="outline" type="button" onClick={() => setSelectedIndex(null)}>Close</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">ID:</span> {employees[selectedIndex].id}</div>
              <div><span className="text-gray-500">Firebase UID:</span> {employees[selectedIndex].firebaseUid || '-'}</div>
              <div><span className="text-gray-500">Firstname:</span> {employees[selectedIndex].firstname}</div>
              <div><span className="text-gray-500">Lastname:</span> {employees[selectedIndex].lastname}</div>
              <div><span className="text-gray-500">Email:</span> {employees[selectedIndex].email}</div>
              <div><span className="text-gray-500">Phone:</span> {employees[selectedIndex].phone || '-'}</div>
              <div><span className="text-gray-500">Role:</span> {employees[selectedIndex].role}</div>
              <div><span className="text-gray-500">Birthday:</span> {employees[selectedIndex].birthday || '-'}</div>
              <div className="md:col-span-2 break-all"><span className="text-gray-500">Login link:</span> {employees[selectedIndex].loginLink ? buildEmployeeLoginUrl(employees[selectedIndex]) : '-'}</div>
            </div>
          </div>
        )}

      </div>
    </Card>
  );
}



