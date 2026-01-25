import React, { useState, useMemo } from 'react';
import { Contact } from '../types';
import { t } from '../utils/i18n';
import { useLanguage } from '../contexts/LanguageContext';
import { Download, Search, MessageCircle, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import Papa from 'papaparse';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Modal from '../components/ui/Modal';
import designSystem from '../designSystem';
import toast from 'react-hot-toast';

interface ContactListContentProps {
  contacts: Contact[];
  loading: boolean;
  restaurant?: any; // Add restaurant prop to check WhatsApp setting
}

const ContactListContent: React.FC<ContactListContentProps> = ({ contacts, loading, restaurant }) => {
  const { language } = useLanguage();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'count' | 'name' | 'date'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [massMsgOpen, setMassMsgOpen] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [contactSearch, setContactSearch] = useState('');

  const filteredContacts = useMemo(() => {
    return contacts.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.location.toLowerCase().includes(search.toLowerCase())
    );
  }, [contacts, search]);

  const sortedContacts = useMemo(() => {
    return [...filteredContacts].sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'count':
          aVal = a.count;
          bVal = b.count;
          break;
        case 'date':
          aVal = a.lastOrderDate?.toDate?.() || new Date(0);
          bVal = b.lastOrderDate?.toDate?.() || new Date(0);
          break;
        default:
          return 0;
      }
      
      if (sortDir === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  }, [filteredContacts, sortBy, sortDir]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = sortedContacts.slice(startIndex, endIndex);
  const totalPages = Math.ceil(sortedContacts.length / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  const renderPagination = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
            i === currentPage
              ? 'z-10 bg-primary border-primary text-white'
              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
          }`}
        >
          {i}
        </button>
      );
    }
    
    return pages;
  };

  const handleExportCSV = () => {
    const csvData = filteredContacts.map(c => ({
      name: c.name,
      phone: c.phone,
      location: c.location,
      orderCount: c.count,
      lastOrderDate: c.lastOrderDate?.toDate?.()?.toLocaleDateString() || 'N/A'
    }));
    
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `contacts_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkWhatsApp = () => {
    setMassMsgOpen(true);
    setSelectedContacts([]);
    setMessage('');
  };

  const handleContactToggle = (phone: string) => {
    setSelectedContacts(prev => 
      prev.includes(phone) 
        ? prev.filter(p => p !== phone)
        : [...prev, phone]
    );
  };

  const handleSendMassMessage = () => {
    if (selectedContacts.length === 0 || !message.trim()) return;
    
    const phoneNumbers = selectedContacts.join(',');
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumbers}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    setMassMsgOpen(false);
    toast.success(t('message_sent_successfully', language));
  };

  const filteredModalContacts = useMemo(() => {
    return contacts.filter(c => 
      c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
      c.phone.includes(contactSearch) ||
      c.location.toLowerCase().includes(contactSearch.toLowerCase())
    );
  }, [contacts, contactSearch]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('contacts', language)}</h1>
          <p className="text-sm text-gray-600">{t('manage_customer_contacts', language)}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={handleExportCSV} className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium bg-white text-gray-700 hover:bg-gray-50">
            <Download size={16} className="mr-2" />
            {t('export_csv', language)}
          </button>
          
          {restaurant?.whatsappBulkMessaging && (
            <button onClick={handleBulkWhatsApp} className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium bg-green-600 text-white hover:bg-green-700">
              <MessageCircle size={16} className="mr-2" />
              {t('send_bulk_whatsapp', language)}
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input 
              type="text" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder={t('search_contacts_placeholder', language)} 
              className="pl-10 p-2 block w-full border border-gray-200 rounded-lg shadow-sm focus:ring-0 focus:border-primary text-base bg-white" 
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => { setSortBy('name'); setSortDir(sortBy === 'name' && sortDir === 'asc' ? 'desc' : 'asc'); }}>
                <div className="flex items-center space-x-1">
                  <span>{t('customer_name', language)}</span>
                  {sortBy === 'name' ? (
                    sortDir === 'asc' ? <ArrowUp size={14} style={{ color: designSystem.colors.primary }} /> : <ArrowDown size={14} style={{ color: designSystem.colors.primary }} />
                  ) : (
                    <ArrowUpDown size={14} style={{ color: designSystem.colors.secondary }} />
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">{t('phone_number', language)}</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">{t('location_address', language)}</th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => { setSortBy('count'); setSortDir(sortBy === 'count' && sortDir === 'asc' ? 'desc' : 'asc'); }}>
                <div className="flex items-center justify-center space-x-1">
                  <span>{t('order_count', language)}</span>
                  {sortBy === 'count' ? (
                    sortDir === 'asc' ? <ArrowUp size={14} style={{ color: designSystem.colors.primary }} /> : <ArrowDown size={14} style={{ color: designSystem.colors.primary }} />
                  ) : (
                    <ArrowUpDown size={14} style={{ color: designSystem.colors.secondary }} />
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => { setSortBy('date'); setSortDir(sortBy === 'date' && sortDir === 'asc' ? 'desc' : 'asc'); }}>
                <div className="flex items-center justify-center space-x-1">
                  <span>{t('last_order_date', language)}</span>
                  {sortBy === 'date' ? (
                    sortDir === 'asc' ? <ArrowUp size={14} style={{ color: designSystem.colors.primary }} /> : <ArrowDown size={14} style={{ color: designSystem.colors.primary }} />
                  ) : (
                    <ArrowUpDown size={14} style={{ color: designSystem.colors.secondary }} />
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10"><LoadingSpinner size={40} /></td></tr>
            ) : currentItems.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10">{t('no_contacts_found', language)}</td></tr>
            ) : currentItems.map((c, idx) => (
              <tr key={c.phone + idx} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{c.name || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{c.phone}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{c.location || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {c.count}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                  {c.lastOrderDate?.toDate?.()?.toLocaleDateString() || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-700">
              {t('showing_results', language)} <span className="font-medium">{startIndex + 1}</span> to{' '}
              <span className="font-medium">{Math.min(endIndex, filteredContacts.length)}</span>{' '}
              {t('of_results', language)} <span className="font-medium">{filteredContacts.length}</span>
            </p>
            <div className="flex items-center space-x-2">
              <label htmlFor="itemsPerPage" className="text-sm text-gray-700">{t('items_per_page', language)}</label>
              <select
                id="itemsPerPage"
                value={itemsPerPage}
                onChange={handleItemsPerPageChange}
                className="block w-20 py-1 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              {renderPagination()}
            </nav>
          </div>
        </div>
      </div>

      <Modal isOpen={massMsgOpen} onClose={() => setMassMsgOpen(false)} title={t('send_bulk_whatsapp', language)} className="max-w-2xl">
        <div className="mb-2 text-gray-600 text-sm">{t('mass_message_instructions', language)}</div>
        
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">{t('selected_contacts', language)}: <span className="font-semibold text-primary">{selectedContacts.length}</span></span>
          <input
            type="text"
            value={contactSearch}
            onChange={e => setContactSearch(e.target.value)}
            placeholder={t('search_contacts_placeholder', language)}
            className="ml-2 px-4 py-2 border border-gray-200 rounded text-sm focus:ring-primary focus:border-primary"
            style={{ minWidth: 200 }}
          />
        </div>
        
        <div className="overflow-y-auto border rounded-md mb-6 custom-thin-scrollbar" style={{ maxHeight: '220px' }}>
          {filteredModalContacts.map((c) => (
            <div
              key={c.phone}
              className={`flex items-center px-3 py-2 cursor-pointer border-b last:border-b-0 ${selectedContacts.includes(c.phone) ? 'border-l-4' : ''}`}
              style={selectedContacts.includes(c.phone)
                ? {
                    background: designSystem.colors.secondary + '10',
                    borderLeft: `4px solid ${designSystem.colors.secondary}`,
                    borderColor: designSystem.colors.secondary
                  }
                : {}}
              onClick={() => handleContactToggle(c.phone)}
            >
              <input
                type="checkbox"
                checked={selectedContacts.includes(c.phone)}
                onChange={() => handleContactToggle(c.phone)}
                className="mr-3 accent-primary"
                onClick={e => e.stopPropagation()}
              />
              <span className={`font-medium ${selectedContacts.includes(c.phone) ? 'text-primary' : ''}`}>{c.name || '-'}</span>
              <span className="ml-2 text-xs text-gray-500">{c.phone}</span>
              {c.location && <span className="ml-2 text-xs text-gray-400">({c.location})</span>}
            </div>
          ))}
        </div>
        
        <div className="text-gray-600 text-xs mb-2 pt-8">
          {t('mass_message_compose_instructions', language)}
        </div>
        
        <textarea
          className="w-full border border-gray-300 rounded-md p-2 mb-2 focus:ring-primary focus:border-primary"
          rows={6}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={t('mass_message_placeholder', language)}
        />
        
        <button
          className="w-full py-2 px-4 rounded-md bg-primary text-white font-semibold hover:bg-primary-dark transition-colors"
          style={{ background: designSystem.colors.primary }}
          onClick={handleSendMassMessage}
          disabled={selectedContacts.length === 0 || !message.trim()}
        >
          {t('send_message', language)}
        </button>
      </Modal>
    </div>
  );
};

export default ContactListContent; 
