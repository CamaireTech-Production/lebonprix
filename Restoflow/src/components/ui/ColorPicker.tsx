import React, { useState, useEffect } from 'react';


interface ColorPickerProps {
  initialPrimary: string;
  initialSecondary: string;
  onChange: (primary: string, secondary: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ initialPrimary, initialSecondary, onChange }) => {
  const [primary, setPrimary] = useState(initialPrimary);
  const [secondary, setSecondary] = useState(initialSecondary);

  // Keep local state in sync if parent changes initial values
  useEffect(() => {
    setPrimary(initialPrimary);
    setSecondary(initialSecondary);
  }, [initialPrimary, initialSecondary]);

  useEffect(() => {
    onChange(primary, secondary);
  }, [primary, secondary]);

  return (
    <div className="flex gap-4 items-center my-2">
      <div className="flex flex-col items-center">
        <label className="block text-xs font-semibold text-gray-700 mb-1 tracking-wide uppercase">Primary</label>
        <div className="relative flex items-center group">
          <input
            type="color"
            value={primary}
            onChange={e => setPrimary(e.target.value)}
            className="w-10 h-10 rounded-full border-2 border-gray-300 shadow-sm cursor-pointer transition-transform group-hover:scale-110"
            style={{ boxShadow: `0 0 0 2px ${primary}` }}
          />
          <span className="ml-2 text-xs font-mono text-gray-600 select-all">{primary}</span>
        </div>
      </div>
      <div className="flex flex-col items-center">
        <label className="block text-xs font-semibold text-gray-700 mb-1 tracking-wide uppercase">Secondary</label>
        <div className="relative flex items-center group">
          <input
            type="color"
            value={secondary}
            onChange={e => setSecondary(e.target.value)}
            className="w-10 h-10 rounded-full border-2 border-gray-300 shadow-sm cursor-pointer transition-transform group-hover:scale-110"
            style={{ boxShadow: `0 0 0 2px ${secondary}` }}
          />
          <span className="ml-2 text-xs font-mono text-gray-600 select-all">{secondary}</span>
        </div>
      </div>
    </div>
  );
};

export default ColorPicker;
