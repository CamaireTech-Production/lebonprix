import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { useAuth } from '../contexts/AuthContext';

// Skeleton page to handle invite activation. In Option A, we search employee by loginLink in company.employees.
export default function InviteActivate() {
  const { inviteId } = useParams();
  const navigate = useNavigate();
  const { company, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!inviteId || !company?.employees) return;
    const emp = company.employees.find(e => e.loginLink === inviteId);
    if (emp?.email) {
      setEmail(emp.email);
    }
  }, [inviteId, company?.employees]);

  const handleActivate = async () => {
    if (!inviteId) return;
    if (!email || !password || !confirmPassword) {
      setError('All fields are required');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      setError('');
      setIsLoading(true);
      // Minimal skeleton: create Auth account. In a complete flow, we might verify invite, then create or link account.
      await signUp(email, password, {
        name: company?.name || '',
        email: company?.email || email,
        phone: company?.phone || '+237',
        description: company?.description,
        location: company?.location,
        logo: company?.logo
      });
      navigate('/');
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Activation failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12">
      <Card>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Activate your account</h1>
        {error && (
          <div className="mb-4 bg-red-50 text-red-800 p-3 rounded-md text-sm">{error}</div>
        )}
        <div className="space-y-3">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Input label="Confirm Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          <div className="flex justify-end">
            <Button type="button" isLoading={isLoading} onClick={handleActivate}>Activate</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}




