import { Company } from '../../types/models';

interface UserAvatarProps {
  company: Company | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const UserAvatar = ({ company, size = 'md', className = '' }: UserAvatarProps) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg'
  };

  if (!company) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-gray-200 flex items-center justify-center text-gray-500 ${className}`}>
        ?
      </div>
    );
  }

  if (company.logo) {
    return (
      <img
        src={company.logo}
        alt={`${company.name} logo`}
        className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
      />
    );
  }

  // Get first letter of company name
  const initial = company.name.charAt(0).toUpperCase();

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-emerald-500 flex items-center justify-center text-white font-medium ${className}`}>
      {initial}
    </div>
  );
};

export default UserAvatar; 