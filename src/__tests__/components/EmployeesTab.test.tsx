import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import EmployeesTab from '../../components/settings/EmployeesTab';
import { useAuth } from '../../contexts/AuthContext';

// Mock the AuthContext
const mockUseAuth = vi.mocked(useAuth);
vi.mock('../../contexts/AuthContext');

// Mock the employees service
const mockAddEmployeeWithAuth = vi.fn();
vi.mock('../../services/employees', () => ({
  addEmployeeWithAuth: mockAddEmployeeWithAuth
}));

// Mock toast functions
const mockShowErrorToast = vi.fn();
const mockShowSuccessToast = vi.fn();
vi.mock('../../utils/toast', () => ({
  showErrorToast: mockShowErrorToast,
  showSuccessToast: mockShowSuccessToast
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined)
  }
});

// Mock window.open
Object.assign(window, {
  open: vi.fn()
});

const mockCompany = {
  id: 'company-123',
  name: 'Test Company',
  employees: [
    {
      id: 'emp-1',
      firstname: 'John',
      lastname: 'Doe',
      email: 'john@example.com',
      role: 'staff',
      firebaseUid: 'firebase-uid-1',
      loginLink: 'johndoe',
      createdAt: { seconds: 1234567890, nanoseconds: 0 },
      updatedAt: { seconds: 1234567890, nanoseconds: 0 }
    }
  ]
};

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('EmployeesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      company: mockCompany,
      user: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      updateCompany: vi.fn()
    });
  });

  it('should render employee dashboard with correct stats', () => {
    renderWithRouter(<EmployeesTab />);

    expect(screen.getByText('Employees')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // Total employees
    expect(screen.getByText('0')).toBeInTheDocument(); // Pending invites
  });

  it('should display existing employees', () => {
    renderWithRouter(<EmployeesTab />);

    expect(screen.getByDisplayValue('John')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument();
  });

  it('should add a new employee successfully', async () => {
    const newEmployee = {
      id: 'emp-2',
      firstname: 'Jane',
      lastname: 'Smith',
      email: 'jane@example.com',
      role: 'manager' as const,
      firebaseUid: 'firebase-uid-2',
      loginLink: 'janesmith',
      createdAt: { seconds: 1234567890, nanoseconds: 0 },
      updatedAt: { seconds: 1234567890, nanoseconds: 0 }
    };

    mockAddEmployeeWithAuth.mockResolvedValue(newEmployee);

    renderWithRouter(<EmployeesTab />);

    // Fill in the form
    fireEvent.change(screen.getByLabelText('Firstname'), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText('Lastname'), { target: { value: 'Smith' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'manager' } });

    // Submit the form
    fireEvent.click(screen.getByText('Add employee'));

    await waitFor(() => {
      expect(mockAddEmployeeWithAuth).toHaveBeenCalledWith('company-123', {
        firstname: 'Jane',
        lastname: 'Smith',
        email: 'jane@example.com',
        role: 'manager',
        phone: '',
        birthday: ''
      });
    });

    await waitFor(() => {
      expect(mockShowSuccessToast).toHaveBeenCalledWith('Employé créé avec succès');
    });
  });

  it('should handle employee creation failure', async () => {
    const error = new Error('Email already exists');
    mockAddEmployeeWithAuth.mockRejectedValue(error);

    renderWithRouter(<EmployeesTab />);

    // Fill in the form
    fireEvent.change(screen.getByLabelText('Firstname'), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText('Lastname'), { target: { value: 'Smith' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });

    // Submit the form
    fireEvent.click(screen.getByText('Add employee'));

    await waitFor(() => {
      expect(mockShowErrorToast).toHaveBeenCalledWith('Email already exists');
    });
  });

  it('should validate required fields', async () => {
    renderWithRouter(<EmployeesTab />);

    // Try to submit without filling required fields
    fireEvent.click(screen.getByText('Add employee'));

    await waitFor(() => {
      expect(mockShowErrorToast).toHaveBeenCalledWith('Firstname is required');
    });
  });

  it('should prevent duplicate emails', async () => {
    renderWithRouter(<EmployeesTab />);

    // Try to add employee with existing email
    fireEvent.change(screen.getByLabelText('Firstname'), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText('Lastname'), { target: { value: 'Smith' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'john@example.com' } });

    fireEvent.click(screen.getByText('Add employee'));

    await waitFor(() => {
      expect(mockShowErrorToast).toHaveBeenCalledWith('Email already exists for this company');
    });
  });

  it('should copy login link to clipboard', async () => {
    renderWithRouter(<EmployeesTab />);

    const copyButton = screen.getByText('Copy link');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('/employee-login/')
      );
      expect(mockShowSuccessToast).toHaveBeenCalledWith('Login link copied');
    });
  });

  it('should open login link in new tab', () => {
    renderWithRouter(<EmployeesTab />);

    const openButton = screen.getByText('Open');
    fireEvent.click(openButton);

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('/employee-login/'),
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('should show employee details when view button is clicked', () => {
    renderWithRouter(<EmployeesTab />);

    const viewButton = screen.getByText('View');
    fireEvent.click(viewButton);

    expect(screen.getByText('Employee details')).toBeInTheDocument();
    expect(screen.getByText('emp-1')).toBeInTheDocument(); // Employee ID
    expect(screen.getByText('firebase-uid-1')).toBeInTheDocument(); // Firebase UID
  });

  it('should handle company not found', async () => {
    mockUseAuth.mockReturnValue({
      company: null,
      user: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      updateCompany: vi.fn()
    });

    renderWithRouter(<EmployeesTab />);

    // Try to add employee without company
    fireEvent.change(screen.getByLabelText('Firstname'), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText('Lastname'), { target: { value: 'Smith' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });

    fireEvent.click(screen.getByText('Add employee'));

    await waitFor(() => {
      expect(mockShowErrorToast).toHaveBeenCalledWith('Company not found');
    });
  });
});
