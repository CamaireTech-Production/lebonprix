import React, { useEffect, useState } from 'react';
import AdminDashboardLayout from '../../components/layout/AdminDashboardLayout';
import { getFirestore, collection, getDocs, orderBy, query, doc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { collection as firestoreCollection, getDocs as firestoreGetDocs, orderBy as firestoreOrderBy, query as firestoreQuery } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Trash2, RotateCcw, X, Upload, Mail, CheckCircle, XCircle, Clock, MoreVertical, Settings } from 'lucide-react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { logActivity } from '../../services/activityLogService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import designSystem from '../../designSystem';
import { useNavigate, useLocation } from 'react-router-dom';
import Modal from '../../components/ui/Modal';
import emailjs from 'emailjs-com';
import { currencies } from '../../data/currencies';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc } from 'firebase/firestore';

const TABS = [
  { key: 'regular', label: 'Regular Restaurants' },
  { key: 'deleted', label: 'Deleted Restaurants' },
];

const AdminRestaurants: React.FC = () => {
  const db = getFirestore();
  const { currentAdmin } = useAdminAuth();

  // Helper function to format date
  const formatDate = (date: any) => {
    if (!date) return '—';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return {
      date: dateObj.toLocaleDateString(),
      time: dateObj.toLocaleTimeString()
    };
  };
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [deletedRestaurants, setDeletedRestaurants] = useState<any[]>([]); // For deleted restaurants
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'regular' | 'deleted'>('regular');
  const [confirmAction, setConfirmAction] = useState<null | { type: string; restaurant: any }>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRestaurant, setNewRestaurant] = useState({ name: '', email: '', address: '', password: '', description: '', logo: '', phone: '', currency: 'XAF', templateSelection: true });
  const [, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [generatePasswordChecked, setGeneratePasswordChecked] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [creating, setCreating] = useState(false);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [verificationAction, setVerificationAction] = useState<'verify' | 'reject'>('verify');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [enablingTemplateSelection, setEnablingTemplateSelection] = useState(false);

  // Set activeTab from query param on mount or when location.search changes
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'regular' || tab === 'deleted') {
      setActiveTab(tab);
    }
    // eslint-disable-next-line
  }, [location.search]);

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      if (activeTab === 'regular') {
        const restaurantsRef = collection(db, 'restaurants');
        const snap = await getDocs(query(restaurantsRef, orderBy('createdAt', 'desc')));
        const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setRestaurants(all.filter(r => !r.isDeleted));
        setDeletedRestaurants(all.filter(r => r.isDeleted));
      } else if (activeTab === 'deleted') {
        // Fetch deleted restaurants
        const restaurantsRef = collection(db, 'restaurants');
        const snap = await getDocs(query(restaurantsRef, orderBy('createdAt', 'desc')));
        const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setDeletedRestaurants(all.filter(r => r.isDeleted));
      }
    } finally {
      setLoading(false);
    }
  };


  const handleToggleTemplateSelection = async (restaurant: any) => {
    try {
      const ref = doc(db, 'restaurants', restaurant.id);
      
      const newTemplateSelection = !restaurant.templateSelection;
      
      // If disabling template selection, clear custom templates to force default usage
      const updateData: any = { 
        templateSelection: newTemplateSelection,
        updatedAt: serverTimestamp()
      };
      
      if (!newTemplateSelection) {
        // Clear custom templates when disabling template selection
        updateData.publicTemplates = null;
      }
      
      await updateDoc(ref, updateData);

      // Log activity
      await logActivity({
        userId: currentAdmin?.id,
        userEmail: currentAdmin?.email,
        action: `template_selection_${restaurant.templateSelection ? 'disabled' : 'enabled'}`,
        entityType: 'restaurant',
        entityId: restaurant.id,
        details: { 
          restaurantName: restaurant.name,
          templateSelection: newTemplateSelection,
          templatesCleared: !newTemplateSelection
        },
      });

      if (newTemplateSelection) {
        toast.success(`Template selection enabled for ${restaurant.name}`);
      } else {
        toast.success(`Template selection disabled for ${restaurant.name}. All pages will use the default template.`);
      }
      fetchRestaurants();
    } catch (error) {
      console.error('Error toggling template selection:', error);
      toast.error('Failed to toggle template selection');
    }
  };

  const handleEnableTemplateSelectionForAll = async () => {
    if (!confirm('Are you sure you want to enable template selection for ALL restaurants? This will allow all restaurant users to customize their templates.')) {
      return;
    }

    setEnablingTemplateSelection(true);
    try {
      const restaurantsRef = collection(db, 'restaurants');
      const snapshot = await getDocs(restaurantsRef);
      
      let updatedCount = 0;
      
      for (const docSnapshot of snapshot.docs) {
        const restaurant = docSnapshot.data();
        const restaurantId = docSnapshot.id;
        
        // Skip if template selection is already enabled or restaurant is deleted
        if (restaurant.templateSelection === true || restaurant.isDeleted === true) {
          continue;
        }
        
        // Update the restaurant to enable template selection
        const restaurantRef = doc(db, collectionName, restaurantId);
        await updateDoc(restaurantRef, {
          templateSelection: true,
          updatedAt: serverTimestamp()
        });
        
        updatedCount++;
      }
      
      // Log activity
      await logActivity({
        userId: currentAdmin?.id,
        userEmail: currentAdmin?.email,
        action: 'template_selection_enabled_for_all',
        entityType: 'system',
        entityId: 'all_restaurants',
        details: { 
          updatedCount,
          isDemo: false
        },
      });

      toast.success(`Template selection enabled for ${updatedCount} restaurants!`);
      fetchRestaurants();
    } catch (error) {
      console.error('Error enabling template selection for all restaurants:', error);
      toast.error('Failed to enable template selection for all restaurants');
    } finally {
      setEnablingTemplateSelection(false);
    }
  };

  // Add handler to send email credentials
  const handleSendEmailCredentials = async (account: any) => {
    setSendingEmail(account.id);
    try {
      const templateId = 'template_mmhwuik';
      const websiteLink = 'https://app.restoflowapp.com/login';
      
      await emailjs.send(
        'service_x8x4tpc',
        templateId,
        {
          to_email: account.email,
          to_name: account.name,
          password: account.password || 'Contact support for password',
          company_name: 'RestoFlow',
          company_email: 'info@camairetech.com',
          from_email: 'info@camairetech.com',
          from_name: 'RestoFlow Support',
          website_link: websiteLink,
          logo_url: 'https://app.restoflowapp.com/icons/icon-512x512.png',
        },
        'WDnTI-GHk5wUQas1o'
      );
      
      showToast(`Email credentials sent to ${account.email}`, 'success');
      
      // Log activity
      await logActivity({
        userId: currentAdmin?.id,
        userEmail: currentAdmin?.email,
        action: 'credentials_email_sent',
        entityType: 'restaurant',
        entityId: account.id,
        details: { 
          accountEmail: account.email, 
          accountName: account.name,
          accountType: 'regular'
        },
      });
    } catch (err: any) {
      showToast(`Failed to send email: ${err.message}`, 'error');
    } finally {
      setSendingEmail(null);
    }
  };

  useEffect(() => {
    fetchRestaurants();
    // eslint-disable-next-line
  }, [db, activeTab]);

  // Verification functions
  const handleVerification = (restaurant: any, action: 'verify' | 'reject') => {
    setSelectedRestaurant(restaurant);
    setVerificationAction(action);
    setVerificationNotes('');
    setShowVerificationModal(true);
  };

  const confirmVerification = async () => {
    if (!selectedRestaurant || !currentAdmin) return;

    try {
      const updateData = {
        verificationStatus: verificationAction === 'verify' ? 'verified' : 'rejected',
        isVerified: verificationAction === 'verify',
        verifiedAt: serverTimestamp(),
        verifiedBy: currentAdmin.id,
        verificationNotes: verificationNotes.trim() || null,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'restaurants', selectedRestaurant.id), updateData);

      // Log activity
      await logActivity({
        userId: currentAdmin.id,
        userEmail: currentAdmin.email,
        action: `restaurant_${verificationAction}`,
        entityType: 'restaurant',
        entityId: selectedRestaurant.id,
        details: {
          restaurantName: selectedRestaurant.name,
          restaurantEmail: selectedRestaurant.email,
          verificationNotes: verificationNotes.trim() || null
        }
      });

      toast.success(`Restaurant ${verificationAction === 'verify' ? 'verified' : 'rejected'} successfully`);
      setShowVerificationModal(false);
      setSelectedRestaurant(null);
      setVerificationNotes('');
      fetchRestaurants();
    } catch (error) {
      console.error('Verification error:', error);
      toast.error('Failed to update verification status');
    }
  };

  const getVerificationStatus = (restaurant: any) => {
    if (restaurant.isVerified && restaurant.verificationStatus === 'verified') {
      return { status: 'verified', color: 'text-green-600', icon: CheckCircle };
    } else if (restaurant.verificationStatus === 'rejected') {
      return { status: 'rejected', color: 'text-red-600', icon: XCircle };
    } else {
      return { status: 'pending', color: 'text-yellow-600', icon: Clock };
    }
  };

  const filteredRestaurants = activeTab === 'regular'
    ? restaurants
    : deletedRestaurants;

  const handleAction = async (type: string, restaurant: any) => {
    setConfirmAction({ type, restaurant });
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    toast(message, {
      style: {
        background: designSystem.colors.white,
        color: designSystem.colors.primary,
        border: `1px solid ${type === 'success' ? designSystem.colors.success : designSystem.colors.error}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        fontWeight: 500,
      },
      iconTheme: {
        primary: type === 'success' ? designSystem.colors.success : designSystem.colors.error,
        secondary: designSystem.colors.white,
      },
      icon: type === 'success' ? '✅' : '❌',
      duration: 3500,
    });
  };

  const confirmAndExecute = async () => {
    if (!confirmAction) return;
    const { type, restaurant } = confirmAction;
    let actionLabel = '';
    
    if (type === 'activate') {
      const ref = doc(db, 'restaurants', restaurant.id);
      await updateDoc(ref, { isDeactivated: false, updatedAt: serverTimestamp() });
      actionLabel = 'activated';
    } else if (type === 'deactivate') {
      const ref = doc(db, 'restaurants', restaurant.id);
      await updateDoc(ref, { isDeactivated: true, updatedAt: serverTimestamp() });
      actionLabel = 'deactivated';
    } else if (type === 'delete') {
      // Soft delete the restaurant document
      const ref = doc(db, 'restaurants', restaurant.id);
      await updateDoc(ref, { isDeleted: true, updatedAt: serverTimestamp() });
      actionLabel = 'deleted';
    } else if (type === 'restore') {
      // Restore the restaurant document
      const ref = doc(db, 'restaurants', restaurant.id);
      await updateDoc(ref, { isDeleted: false, isDeactivated: false, updatedAt: serverTimestamp() });
      actionLabel = 'restored';
    }
    
    try {
      await logActivity({
        userId: currentAdmin?.id,
        userEmail: currentAdmin?.email,
        action: `restaurant_${type}`,
        entityType: 'restaurant',
        entityId: restaurant.id,
        details: { name: restaurant.name },
      });
      showToast(`Restaurant ${actionLabel}.`, 'success');
      fetchRestaurants();
    } catch (err: any) {
      showToast('Action failed. Please try again.', 'error');
    } finally {
      setConfirmAction(null);
    }
  };

  const handleRowClick = (r: any) => {
    if (!r.isDeleted) {
      navigate(`/admin/restaurants/${r.id}`);
    }
  };

  const renderRow = (r: any, idx: number) => {
    const isExpired = false;
    return (
      <tr
        key={r.id || idx}
        className={`hover:bg-gray-50 transition border-b last:border-none cursor-pointer ${r.isDeleted ? 'opacity-60 cursor-not-allowed' : ''}`}
        onClick={() => handleRowClick(r)}
      >
        <td className="px-6 py-4 whitespace-nowrap font-medium text-primary">{r.name || '—'}</td>
        <td className="px-6 py-4 whitespace-nowrap">{r.address || r.email || '—'}</td>
        <td className="px-6 py-4 whitespace-nowrap">{r.email || '—'}</td>
        {activeTab !== 'deleted' && (
          <td className="px-6 py-4 whitespace-nowrap">
            {activeTab === 'regular' ? (
              <div className="flex items-center space-x-2">
                {(() => {
                  const verification = getVerificationStatus(r);
                  const IconComponent = verification.icon;
                  return (
                    <>
                      <IconComponent className={`h-4 w-4 ${verification.color}`} />
                      <span className={`text-xs font-medium ${verification.color}`}>
                        {verification.status.charAt(0).toUpperCase() + verification.status.slice(1)}
                      </span>
                    </>
                  );
                })()}
              </div>
            ) : (
              <span className="text-gray-400 text-xs">N/A</span>
            )}
          </td>
        )}
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isExpired ? 'bg-gray-200 text-gray-500' : r.isDeleted ? 'bg-red-100 text-red-800' : r.isDeactivated || r.deactivated ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{isExpired ? 'Expired' : r.isDeleted ? 'Deleted' : r.isDeactivated || r.deactivated ? 'Deactivated' : 'Active'}</span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
          {(() => {
            const formatted = formatDate(r.createdAt);
            return formatted === '—' ? (
              <span className="text-gray-400">—</span>
            ) : (
              <div 
                className="flex flex-col cursor-help" 
                title={`Created: ${r.createdAt.toDate ? r.createdAt.toDate().toString() : new Date(r.createdAt).toString()}`}
              >
                <span>{formatted.date}</span>
                <span className="text-xs text-gray-400">{formatted.time}</span>
              </div>
            );
          })()}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex flex-col gap-1">
            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${r.templateSelection ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {r.templateSelection ? 'Enabled' : 'Disabled'}
            </span>
            {!r.templateSelection && (
              <span className="text-xs text-gray-500">Using default template</span>
            )}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-right" onClick={e => e.stopPropagation()}>
          <div className="flex justify-end space-x-2">
            {/* Single Verification button for regular restaurants */}
            {activeTab === 'regular' && !r.isDeleted && (
              <button 
                title="Verify/Reject Restaurant" 
                onClick={() => handleVerification(r, 'verify')} 
                className="p-2 rounded hover:bg-blue-100 transition text-blue-600 border border-blue-300"
              >
                <CheckCircle size={18} />
              </button>
            )}

            {/* Send Email Credentials Button */}
            <button 
              title="Send Email Credentials" 
              onClick={() => handleSendEmailCredentials(r)} 
              disabled={sendingEmail === r.id}
              className="p-2 rounded hover:bg-blue-100 transition text-blue-600 border border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingEmail === r.id ? (
                <LoadingSpinner size={16} color="#2563eb" />
              ) : (
                <Mail size={18} />
              )}
            </button>
            
            {/* Remove Template Button */}
            {r.templateSelection && activeTab !== 'deleted' && (
              <button 
                title="Remove Template Selection"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleTemplateSelection(r);
                }}
                className="p-2 rounded hover:bg-red-100 transition text-red-600 border border-red-300"
              >
                <XCircle size={18} />
              </button>
            )}
            
            {/* Always show Delete button, even if expired */}
            {!r.isDeleted && (
              <button title="Delete" onClick={() => handleAction('delete', r)} className="p-2 rounded hover:bg-red-100 transition"><Trash2 size={18} className="text-red-600" /></button>
            )}
            {/* Show Activate/Deactivate only if not expired and not deleted */}
            {!r.isDeleted && !r.isDeactivated && !isExpired && activeTab !== 'deleted' && (
              <button title="Deactivate" onClick={() => handleAction('deactivate', r)} className="p-2 rounded hover:bg-yellow-100 transition"><EyeOff size={18} className="text-yellow-600" /></button>
            )}
            {!r.isDeleted && (r.isDeactivated || r.deactivated) && !isExpired && activeTab !== 'deleted' && (
              <button title="Activate" onClick={() => handleAction('activate', r)} className="p-2 rounded hover:bg-green-100 transition"><Eye size={18} className="text-green-600" /></button>
            )}
            {r.isDeleted && (
              <button title="Restore" onClick={() => handleAction('restore', r)} className="p-2 rounded hover:bg-blue-100 transition"><RotateCcw size={18} className="text-blue-600" /></button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  // Tablet row renderer (simplified columns)
  const renderTabletRow = (r: any, idx: number) => {
    const isExpired = false;
    
    return (
      <tr
        key={r.id || idx}
        className={`hover:bg-gray-50 transition border-b last:border-none cursor-pointer ${r.isDeleted ? 'opacity-60 cursor-not-allowed' : ''}`}
        onClick={() => handleRowClick(r)}
      >
        <td className="px-4 py-3 font-medium text-primary">
          <div className="flex flex-col">
            <span className="truncate">{r.name || '—'}</span>
            <span className="text-xs text-gray-500 truncate">{r.address || '—'}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 truncate">{r.email || '—'}</td>
        {activeTab !== 'deleted' && (
          <td className="px-4 py-3">
            {activeTab === 'regular' ? (
              <div className="flex items-center space-x-1">
                {(() => {
                  const verification = getVerificationStatus(r);
                  const IconComponent = verification.icon;
                  return (
                    <>
                      <IconComponent className={`h-3 w-3 ${verification.color}`} />
                      <span className={`text-xs font-medium ${verification.color}`}>
                        {verification.status.charAt(0).toUpperCase() + verification.status.slice(1)}
                      </span>
                    </>
                  );
                })()}
              </div>
            ) : (
              <span className="text-gray-400 text-xs">N/A</span>
            )}
          </td>
        )}
        <td className="px-4 py-3">
          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isExpired ? 'bg-gray-200 text-gray-500' : r.isDeleted ? 'bg-red-100 text-red-800' : r.isDeactivated || r.deactivated ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
            {isExpired ? 'Expired' : r.isDeleted ? 'Deleted' : r.isDeactivated || r.deactivated ? 'Deactivated' : 'Active'}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">
          {(() => {
            const formatted = formatDate(r.createdAt);
            return formatted === '—' ? (
              <span className="text-gray-400">—</span>
            ) : (
              <div className="text-xs">
                <span>{formatted.date}</span>
              </div>
            );
          })()}
        </td>
        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
          <div className="flex justify-end">
            <ActionDropdown restaurant={r} />
          </div>
        </td>
      </tr>
    );
  };

  // Action dropdown component
  const ActionDropdown = ({ restaurant, isMobile = false }: { restaurant: any; isMobile?: boolean }) => {
    const isExpired = false;
    const dropdownId = `dropdown-${restaurant.id}`;
    const isOpen = openDropdown === dropdownId;

    const actions = [
      ...(activeTab === 'regular' && !restaurant.isDeleted ? [{
        label: 'Verify/Reject',
        icon: CheckCircle,
        onClick: () => handleVerification(restaurant, 'verify'),
        className: 'text-blue-600 hover:bg-blue-50'
      }] : []),
      {
        label: 'Send Email',
        icon: Mail,
        onClick: () => handleSendEmailCredentials(restaurant),
        disabled: sendingEmail === restaurant.id,
        className: 'text-blue-600 hover:bg-blue-50'
      },
      ...(restaurant.templateSelection && activeTab !== 'deleted' ? [{
        label: 'Remove Template',
        icon: XCircle,
        onClick: () => handleToggleTemplateSelection(restaurant),
        className: 'text-red-600 hover:bg-red-50'
      }] : []),
      ...(!restaurant.isDeleted ? [{
        label: 'Delete',
        icon: Trash2,
        onClick: () => handleAction('delete', restaurant),
        className: 'text-red-600 hover:bg-red-50'
      }] : []),
      ...(!restaurant.isDeleted && !restaurant.isDeactivated && !isExpired && activeTab !== 'deleted' ? [{
        label: 'Deactivate',
        icon: EyeOff,
        onClick: () => handleAction('deactivate', restaurant),
        className: 'text-yellow-600 hover:bg-yellow-50'
      }] : []),
      ...(!restaurant.isDeleted && (restaurant.isDeactivated || restaurant.deactivated) && !isExpired && activeTab !== 'deleted' ? [{
        label: 'Activate',
        icon: Eye,
        onClick: () => handleAction('activate', restaurant),
        className: 'text-green-600 hover:bg-green-50'
      }] : []),
      ...(restaurant.isDeleted ? [{
        label: 'Restore',
        icon: RotateCcw,
        onClick: () => handleAction('restore', restaurant),
        className: 'text-blue-600 hover:bg-blue-50'
      }] : [])
    ];

    return (
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpenDropdown(isOpen ? null : dropdownId);
          }}
          className={`p-2 rounded hover:bg-gray-100 transition ${isMobile ? 'text-gray-600' : 'text-gray-400'}`}
        >
          <MoreVertical size={16} />
        </button>
        
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setOpenDropdown(null)}
            />
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200 max-h-64 overflow-y-auto">
              <div className="py-1">
                {actions.map((action, index) => {
                  const IconComponent = action.icon;
                  return (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation();
                        action.onClick();
                        setOpenDropdown(null);
                      }}
                      disabled={action.disabled}
                      className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-2 ${action.className} ${action.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                    >
                      <IconComponent size={14} />
                      <span>{action.label}</span>
                      {action.disabled && sendingEmail === restaurant.id && (
                        <LoadingSpinner size={12} color="#2563eb" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // Mobile card renderer
  const renderMobileCard = (r: any, idx: number) => {
    const isExpired = false;
    
    return (
      <div
        key={r.id || idx}
        className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm ${r.isDeleted ? 'opacity-60' : ''}`}
        onClick={() => !r.isDeleted && handleRowClick(r)}
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-primary truncate">{r.name || '—'}</h3>
            <p className="text-sm text-gray-600 truncate">{r.email || '—'}</p>
            {r.address && (
              <p className="text-xs text-gray-500 truncate mt-1">{r.address}</p>
            )}
          </div>
          <div className="ml-2 flex-shrink-0 flex items-center space-x-2">
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${isExpired ? 'bg-gray-200 text-gray-500' : r.isDeleted ? 'bg-red-100 text-red-800' : r.isDeactivated || r.deactivated ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
              {isExpired ? 'Expired' : r.isDeleted ? 'Deleted' : r.isDeactivated || r.deactivated ? 'Deactivated' : 'Active'}
            </span>
            <ActionDropdown restaurant={r} isMobile={true} />
          </div>
        </div>
        
        <div className="space-y-2 mb-3">
          {activeTab !== 'deleted' && activeTab === 'regular' && (
            <div className="flex items-center space-x-2">
              {(() => {
                const verification = getVerificationStatus(r);
                const IconComponent = verification.icon;
                return (
                  <>
                    <IconComponent className={`h-4 w-4 ${verification.color}`} />
                    <span className={`text-xs font-medium ${verification.color}`}>
                      {verification.status.charAt(0).toUpperCase() + verification.status.slice(1)}
                    </span>
                  </>
                );
              })()}
            </div>
          )}
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              Created: {(() => {
                const formatted = formatDate(r.createdAt);
                return formatted === '—' ? '—' : formatted.date;
              })()}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 text-xs rounded-full ${r.templateSelection ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              Template: {r.templateSelection ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Password generator
  function generatePassword(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
  // Auto-generate password when modal opens or checkbox is checked
  React.useEffect(() => {
    if (showCreateModal && generatePasswordChecked) {
      setNewRestaurant(r => ({ ...r, password: generatePassword(12) }));
    }
  }, [showCreateModal, generatePasswordChecked]);


  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      const base64 = await fileToBase64(file);
      setNewRestaurant(r => ({ ...r, logo: base64 }));
    }
  };
  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setNewRestaurant(r => ({ ...r, logo: '' }));
  };

  return (
    <AdminDashboardLayout>
      <h1 className="text-2xl font-bold mb-4">Restaurants</h1>
      <div className="mb-4 text-sm text-gray-600">
        <strong>Template Selection:</strong> When enabled, restaurants can choose custom templates for their public pages. 
        When disabled, all public pages use the default template.
      </div>
      <div className="mb-4 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div className="flex flex-wrap gap-2">
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`px-3 py-2 text-sm rounded ${activeTab === tab.key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'} hover:opacity-80 transition-opacity`}
              onClick={() => setActiveTab(tab.key as 'regular' | 'deleted')}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 ml-auto">
          <button
            className="px-3 py-2 text-sm rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleEnableTemplateSelectionForAll}
            disabled={enablingTemplateSelection}
            title="Enable template customization for all restaurants"
          >
            {enablingTemplateSelection ? 'Enabling...' : '🎨 Enable Templates for All'}
          </button>
          <button
            className="px-3 py-2 text-sm rounded bg-primary text-white font-semibold hover:bg-primary-dark transition-colors"
            onClick={() => setShowCreateModal(true)}
          >
            + Create Restaurant
          </button>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center items-center h-32">
          <LoadingSpinner size={48} color={designSystem.colors.primary} />
        </div>
      ) : (
        <div className="shadow rounded-lg overflow-hidden bg-white">
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                {activeTab !== 'deleted' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verification</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Template Selection</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRestaurants.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'deleted' ? 7 : 9} className="px-6 py-10 text-center text-gray-500">
                    No restaurants found.
                  </td>
                </tr>
              ) : (
                filteredRestaurants.map(renderRow)
              )}
            </tbody>
          </table>
          </div>

          {/* Tablet Table */}
          <div className="hidden md:block lg:hidden overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  {activeTab !== 'deleted' && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verification</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRestaurants.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === 'deleted' ? 5 : 6} className="px-4 py-10 text-center text-gray-500">
                      No restaurants found.
                    </td>
                  </tr>
                ) : (
                  filteredRestaurants.map(renderTabletRow)
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden">
            {filteredRestaurants.length === 0 ? (
              <div className="px-4 py-10 text-center text-gray-500">
                No restaurants found.
              </div>
            ) : (
              <div className="space-y-4 p-4">
                {filteredRestaurants.map(renderMobileCard)}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">Confirm {confirmAction.type.charAt(0).toUpperCase() + confirmAction.type.slice(1)}</h2>
            <p className="mb-4">Are you sure you want to {confirmAction.type} <span className="font-semibold">{confirmAction.restaurant.name}</span>?</p>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => setConfirmAction(null)}>Cancel</button>
              <button className="px-4 py-2 bg-primary text-white rounded" onClick={confirmAndExecute}>Confirm</button>
            </div>
          </div>
        </div>
      )}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Restaurant">
        <div className="mb-4 text-sm text-gray-600">
          <strong>Note:</strong> Template selection is enabled by default. Restaurant users will be able to customize their templates immediately after creation.
        </div>
        <form className="space-y-4" onSubmit={async e => {
          e.preventDefault();
          setCreating(true);
          try {
            const db = getFirestore();
            const now = serverTimestamp();
            
            // Create Firebase Auth user first
            const auth = getAuth();
            const userCredential = await createUserWithEmailAndPassword(auth, newRestaurant.email, newRestaurant.password);
            
            // Create restaurant document in Firestore with the Auth UID as the document ID
            await setDoc(doc(db, 'restaurants', userCredential.user.uid), {
              name: newRestaurant.name,
              email: newRestaurant.email,
              address: newRestaurant.address,
              description: newRestaurant.description,
              logo: newRestaurant.logo,
              phone: newRestaurant.phone,
              currency: newRestaurant.currency,
              templateSelection: true, // Default to enabled
              createdAt: now,
              updatedAt: now,
              isDeleted: false,
              isDeactivated: false,
            });
            // Log activity
            await logActivity({
              userId: currentAdmin?.id,
              userEmail: currentAdmin?.email,
              action: 'restaurant_created',
              entityType: 'restaurant',
              entityId: userCredential.user.uid,
              details: { 
                name: newRestaurant.name, 
                email: newRestaurant.email,
                firestoreDocId: userCredential.user.uid 
              },
            });
            // Send welcome email via EmailJS
            try {
              await emailjs.send(
                'service_x8x4tpc', // Replace with your Hostinger EmailJS service ID
                'template_mmhwuik', // Replace with your EmailJS template ID
                {
                  to_email: newRestaurant.email,
                  to_name: newRestaurant.name,
                  password: newRestaurant.password,
                  company_name: 'RestoFlow',
                  company_email: 'info@camairetech.com', // Update with your Hostinger domain
                  website_link: 'https://app.restoflowapp.com/login', // Update with your domain
                  logo_url: 'https://app.restoflowapp.com/icons/icon-512x512.png', // Update with your domain
                },
                'WDnTI-GHk5wUQas1o' // Replace with your EmailJS public key
              );
              toast.success('Restaurant created and welcome email sent!');
            } catch (emailErr) {
              toast.error('Restaurant created, but failed to send welcome email.');
            }
            setShowCreateModal(false);
            setNewRestaurant({ name: '', email: '', address: '', password: '', description: '', logo: '', phone: '', currency: 'XAF', templateSelection: true });
            setLogoFile(null);
            setLogoPreview(null);
            fetchRestaurants();
          } catch (err: any) {
            console.error('Restaurant creation error:', err);
            if (err.code === 'auth/email-already-in-use') {
              toast.error('A restaurant with this email already exists.');
            } else if (err.code === 'auth/invalid-email') {
              toast.error('Please enter a valid email address.');
            } else if (err.code === 'auth/weak-password') {
              toast.error('Password is too weak. Please use a stronger password.');
            } else {
              toast.error('Failed to create restaurant: ' + (err.message || 'Unknown error'));
            }
          } finally {
            setCreating(false);
          }
        }}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-md p-2 focus:ring-primary focus:border-primary"
              value={newRestaurant.name}
              onChange={e => setNewRestaurant(r => ({ ...r, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              className="w-full border border-gray-300 rounded-md p-2 focus:ring-primary focus:border-primary"
              value={newRestaurant.email}
              onChange={e => setNewRestaurant(r => ({ ...r, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-md p-2 focus:ring-primary focus:border-primary"
              value={newRestaurant.address}
              onChange={e => setNewRestaurant(r => ({ ...r, address: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full border border-gray-300 rounded-md p-2 focus:ring-primary focus:border-primary"
              value={newRestaurant.description}
              onChange={e => setNewRestaurant(r => ({ ...r, description: e.target.value }))}
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
            <div className="flex items-center gap-6 flex-wrap">
              {logoPreview || newRestaurant.logo ? (
                <div className="relative">
                  <img
                    src={logoPreview || (typeof newRestaurant.logo === 'string' && newRestaurant.logo.startsWith('data:') ? newRestaurant.logo : undefined)}
                    alt="Restaurant logo preview"
                    className="w-24 h-24 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="logo-upload"
                  className="cursor-pointer flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary transition-colors"
                >
                  <Upload size={24} className="text-gray-400" />
                  <span className="mt-2 text-xs text-gray-500">Upload logo</span>
                </label>
              )}
              <input
                id="logo-upload"
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              className="w-full border border-gray-300 rounded-md p-2 focus:ring-primary focus:border-primary"
              value={newRestaurant.phone}
              onChange={e => setNewRestaurant(r => ({ ...r, phone: e.target.value }))}
              placeholder="e.g. 612345678"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select
              className="w-full border border-gray-300 rounded-md p-2 focus:ring-primary focus:border-primary"
              value={newRestaurant.currency}
              onChange={e => setNewRestaurant(r => ({ ...r, currency: e.target.value }))}
            >
              {currencies.map(opt => (
                <option key={opt.code} value={opt.code}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                id="template-selection-checkbox"
                className="rounded border-gray-300 text-primary focus:ring-primary"
                checked={newRestaurant.templateSelection || false}
                onChange={e => setNewRestaurant(r => ({ ...r, templateSelection: e.target.checked }))}
              />
              <label htmlFor="template-selection-checkbox" className="text-sm font-medium text-gray-700">
                Enable Template Selection
              </label>
            </div>
            <p className="text-xs text-gray-500">
              When enabled, this restaurant can choose custom templates for their public pages. 
              When disabled, all public pages will use the default template.
            </p>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
              Password
              <input
                type="checkbox"
                className="ml-2 accent-primary"
                checked={generatePasswordChecked}
                onChange={e => setGeneratePasswordChecked(e.target.checked)}
                id="generate-password-checkbox"
              />
              <span className="text-xs text-gray-500">Generate password</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full border border-gray-300 rounded-md p-2 focus:ring-primary focus:border-primary pr-10"
                value={newRestaurant.password}
                onChange={e => setNewRestaurant(r => ({ ...r, password: e.target.value }))}
                required
                readOnly={generatePasswordChecked}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400"
                tabIndex={-1}
                onClick={() => setShowPassword(v => !v)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="px-4 py-2 bg-gray-200 rounded" onClick={() => setShowCreateModal(false)} disabled={creating}>Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary text-white rounded font-semibold flex items-center justify-center min-w-[100px] disabled:opacity-60" disabled={creating}>
              {creating ? (<><LoadingSpinner size={18} color="#fff" /> <span className="ml-2">Creating...</span></>) : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Verification Modal */}
      <Modal isOpen={showVerificationModal} onClose={() => setShowVerificationModal(false)} title="Restaurant Verification">
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">Restaurant Information</h3>
            <div className="space-y-1 text-sm text-gray-600">
              <p><strong>Name:</strong> {selectedRestaurant?.name || 'Not provided'}</p>
              <p><strong>Email:</strong> {selectedRestaurant?.email || 'Not provided'}</p>
              <p><strong>Phone:</strong> {selectedRestaurant?.phone || 'Not provided'}</p>
              <p><strong>Address:</strong> {selectedRestaurant?.address || 'Not provided'}</p>
              <p><strong>Current Status:</strong> 
                <span className={`ml-2 px-2 py-1 rounded text-xs ${
                  selectedRestaurant?.verificationStatus === 'verified' ? 'bg-green-100 text-green-800' :
                  selectedRestaurant?.verificationStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {selectedRestaurant?.verificationStatus || 'pending'}
                </span>
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={verificationNotes}
              onChange={(e) => setVerificationNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="Add any notes about this verification decision..."
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setShowVerificationModal(false)}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setVerificationAction('reject');
                confirmVerification();
              }}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition flex items-center gap-2"
            >
              <XCircle size={16} />
              Reject
            </button>
            <button
              onClick={() => {
                setVerificationAction('verify');
                confirmVerification();
              }}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition flex items-center gap-2"
            >
              <CheckCircle size={16} />
              Accept
            </button>
          </div>
        </div>
      </Modal>
    </AdminDashboardLayout>
  );
};

export default AdminRestaurants; 