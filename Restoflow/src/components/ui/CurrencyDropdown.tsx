import React, { useState } from 'react';
import { t } from '../../utils/i18n';

interface Currency {
  code: string;
  symbol: string;
  label: string;
}

interface CurrencyDropdownProps {
  value: string;
  onChange: (code: string) => void;
  currencies: Currency[];
  language: string;
}

const CurrencyDropdown: React.FC<CurrencyDropdownProps> = ({ value, onChange, currencies, language }) => {
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = currencies.filter(c =>
    c.code.toLowerCase().includes(filter.toLowerCase()) ||
    c.symbol.toLowerCase().includes(filter.toLowerCase()) ||
    c.label.toLowerCase().includes(filter.toLowerCase())
  );

  const selected = currencies.find(c => c.code === value);

  return (
    <div className="relative">
      <button
        type="button"
        className="w-full py-3 px-4 border border-gray-300 rounded-md bg-white text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <span>{selected.code} - {selected.symbol} ({selected.label})</span>
        ) : (
          <span className="text-gray-400">{t('currency', language)}</span>
        )}
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg">
          <input
            type="text"
            className="w-full px-3 py-2 border-b border-gray-200 focus:outline-none"
            placeholder={t('search_Dishes_Placeholder', language)}
            value={filter}
            onChange={e => setFilter(e.target.value)}
            autoFocus
          />
          <ul className="max-h-56 overflow-y-auto" tabIndex={-1} role="listbox">
            {filtered.length === 0 && (
              <li className="px-4 py-2 text-gray-400">{t('no_items_found', language)}</li>
            )}
            {filtered.map(c => (
              <li
                key={c.code}
                className={`px-4 py-2 cursor-pointer hover:bg-primary hover:text-white ${c.code === value ? 'bg-primary text-white' : ''}`}
                onClick={() => { onChange(c.code); setOpen(false); setFilter(''); }}
                role="option"
                aria-selected={c.code === value}
              >
                {c.code} - {c.symbol} ({c.label})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CurrencyDropdown; 