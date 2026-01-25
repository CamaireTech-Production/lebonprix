import React from 'react';

interface ProgressBarProps {
  value: number; // 0-100
  className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ value, className = '' }) => {
  const pct = Math.min(Math.max(value, 0), 100);
  let color = 'bg-red-500';
  if (pct >= 66) color = 'bg-emerald-500';
  else if (pct >= 33) color = 'bg-yellow-500';

  return (
    <div className={`w-full h-3 rounded-full bg-gray-200 overflow-hidden ${className}`}>
      <div
        className={`h-full ${color} transition-all duration-700 ease-out`} // animate width
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

export default ProgressBar; 