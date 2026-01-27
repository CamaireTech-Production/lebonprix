// useEmployees hook for Restoflow
import { useState, useEffect, useCallback } from 'react';
import type { EmployeeRef, UserRole } from '../../types/geskap';
import {
  subscribeToEmployeeRefs,
  addEmployeeRef,
  updateEmployeeRole,
  removeEmployeeRef,
  getEmployeeRef
} from '../../services/firestore/employees/employeeRefService';

interface UseEmployeesOptions {
  restaurantId: string;
}

interface UseEmployeesReturn {
  employees: EmployeeRef[];
  loading: boolean;
  error: string | null;
  addEmployee: (userId: string, username: string, email: string, role: UserRole) => Promise<EmployeeRef>;
  updateRole: (userId: string, newRole: UserRole) => Promise<void>;
  removeEmployee: (userId: string) => Promise<void>;
  getEmployee: (userId: string) => Promise<EmployeeRef | null>;
}

export const useEmployees = ({ restaurantId }: UseEmployeesOptions): UseEmployeesReturn => {
  const [employees, setEmployees] = useState<EmployeeRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setEmployees([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToEmployeeRefs(restaurantId, (data) => {
      setEmployees(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [restaurantId]);

  const handleAddEmployee = useCallback(
    async (userId: string, username: string, email: string, role: UserRole) => {
      try {
        return await addEmployeeRef(restaurantId, userId, username, email, role);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleUpdateRole = useCallback(
    async (userId: string, newRole: UserRole) => {
      try {
        await updateEmployeeRole(restaurantId, userId, newRole);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleRemoveEmployee = useCallback(
    async (userId: string) => {
      try {
        await removeEmployeeRef(restaurantId, userId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleGetEmployee = useCallback(
    async (userId: string) => {
      try {
        return await getEmployeeRef(restaurantId, userId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  return {
    employees,
    loading,
    error,
    addEmployee: handleAddEmployee,
    updateRole: handleUpdateRole,
    removeEmployee: handleRemoveEmployee,
    getEmployee: handleGetEmployee
  };
};
