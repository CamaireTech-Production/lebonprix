import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, DollarSign, Package2, FileBarChart, Settings, X, Receipt, Users, Building2, Plus, Grid3X3, ShoppingBag, UserCheck, ChevronDown, ChevronRight, Loader2, Phone, ScanLine, Warehouse, Factory, Globe} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRolePermissions } from '../../hooks/business/useRolePermissions';
import UserAvatar from '../common/UserAvatar';
import { DownloadAppButton } from '../pwa';
import { useTranslation } from 'react-i18next';
import CreateCompanyModal from '../modals/CreateCompanyModal';
import Modal, { ModalFooter } from '../common/Modal';
import { RESOURCES } from '../../constants/resources';
import { usePWA } from '../../hooks/usePWA';

interface SidebarProps {
  onClose: () => void;
  lockedTab?: boolean;
  isSelectionMode?: boolean; // true si on est sur /companies/me/:userId
}

const Sidebar = ({ onClose, isSelectionMode }: SidebarProps) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { company, currentEmployee, isOwner, effectiveRole } = useAuth();
  const { canAccess, canAccessFinance, canAccessHR, canAccessSettings, templateLoading } = useRolePermissions();
  const { isInstalled } = usePWA();
  const [showCreateCompanyModal, setShowCreateCompanyModal] = React.useState(false);
  const [showCompanyNavigationConfirm, setShowCompanyNavigationConfirm] = React.useState(false);
  const [expensesMenuExpanded, setExpensesMenuExpanded] = React.useState(false);
  const [contactsMenuExpanded, setContactsMenuExpanded] = React.useState(false);
  const [productsMenuExpanded, setProductsMenuExpanded] = React.useState(false);
  const [magasinMenuExpanded, setMagasinMenuExpanded] = React.useState(false);
  const [productionsMenuExpanded, setProductionsMenuExpanded] = React.useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Vérifier si on doit afficher le loader pour le template
  const isActualOwner = isOwner || effectiveRole === 'owner';
  const showTemplateLoader = !isActualOwner && templateLoading;

  
  // Get dashboard colors
  const getDashboardColors = () => {
    const colors = {
      primary: company?.dashboardColors?.primary || company?.primaryColor || '#183524',
      secondary: company?.dashboardColors?.secondary || company?.secondaryColor || '#e2b069',
      tertiary: company?.dashboardColors?.tertiary || company?.tertiaryColor || '#2a4a3a'
    };
    return colors;
  };
  
  const colors = getDashboardColors();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  // Check if expenses menu should be expanded (if on any expenses sub-route)
  React.useEffect(() => {
    setExpensesMenuExpanded(location.pathname.includes('/expenses'));
  }, [location.pathname]);

  // Check if contacts menu should be expanded (if on any contacts sub-route)
  React.useEffect(() => {
    setContactsMenuExpanded(location.pathname.includes('/contacts'));
  }, [location.pathname]);

  // Check if products menu should be expanded (if on any products/categories sub-route)
  // Exclude productions/categories, expenses/categories, and magasin/categories to avoid false positives
  React.useEffect(() => {
    const isOnProductsRoute = location.pathname.includes('/products');
    const isOnCategoriesRoute = location.pathname.includes('/categories') && 
                                 !location.pathname.includes('/productions/categories') &&
                                 !location.pathname.includes('/expenses/categories') &&
                                 !location.pathname.includes('/magasin/categories');
    setProductsMenuExpanded(isOnProductsRoute || isOnCategoriesRoute);
  }, [location.pathname]);

  // Check if productions menu should be expanded (if on any productions sub-route)
  React.useEffect(() => {
    setProductionsMenuExpanded(location.pathname.includes('/productions'));
  }, [location.pathname]);

  // Check if magasin menu should be expanded (if on any magasin sub-route)
  React.useEffect(() => {
    setMagasinMenuExpanded(location.pathname.includes('/magasin'));
  }, [location.pathname]);

  const handleCreateCompany = () => {
    window.location.href = '/company/create';
  };


  const handleNavigationClick = (event: React.MouseEvent) => {
    if (isSelectionMode) {
      event.preventDefault();
      setShowCreateCompanyModal(true);
    }
    // Sinon, la navigation normale se fait via le Link
  };
  
  // Vérifier si on est dans une route d'entreprise
  const isCompanyRoute = location.pathname.startsWith('/company/');
  
  // Vérifier si on est en mode sélection
  const isCompanySelectionRoute = location.pathname.startsWith('/companies/me/');
  
  // Navigation items pour le mode sélection - TOUS ACTIVÉS
  const selectionModeItems = [
    { name: 'Companies (op)', path: location.pathname, icon: <Building2 size={20} />, alwaysEnabled: true, disabled: false },
    { name: t('navigation.dashboard'), path: '/dashboard', icon: <LayoutDashboard size={20} />, disabled: false },
    { name: t('navigation.sales'), path: '/sales', icon: <ShoppingCart size={20} />, disabled: false },
    { name: t('navigation.orders'), path: '/orders', icon: <ShoppingBag size={20} />, disabled: false },
    { name: t('navigation.expenses'), path: '/expenses', icon: <Receipt size={20} />, disabled: false },
    { name: t('navigation.finance'), path: '/finance', icon: <DollarSign size={20} />, disabled: false },
    { 
      name: t('navigation.products'), 
      path: '/products', 
      icon: <Package2 size={20} />, 
      disabled: false,
      subItems: [
        { name: t('navigation.submenus.list'), path: '/products' },
        { name: t('navigation.submenus.categories'), path: '/categories' },
      ]
    },
    { name: t('navigation.suppliers'), path: '/suppliers', icon: <Users size={20} />, disabled: false },
    { name: t('navigation.reports'), path: '/reports', icon: <FileBarChart size={20} />, disabled: false },
    { name: t('navigation.settings'), path: '/settings', icon: <Settings size={20} />, disabled: false },
  ];

  // Navigation items normaux
  const normalNavigationItems = [
    // Bouton retour aux entreprises (seulement dans les routes d'entreprise)
    ...(isCompanyRoute ? [
      { name: t('navigation.myCompanies', 'My Companies'), path: '/companies', icon: <Building2 size={20} />, resource: 'dashboard' }
    ] : []),
    { name: t('navigation.dashboard'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/dashboard` : '/', icon: <LayoutDashboard size={20} />, resource: 'dashboard' },
    { name: t('navigation.sales'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/sales` : '/sales', icon: <ShoppingCart size={20} />, resource: 'sales' },
    { name: t('navigation.pos'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/pos` : '/pos', icon: <ScanLine size={20} />, resource: 'sales' },
    { name: t('site.navigation', 'Online Catalogue'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/site` : '/site', icon: <Globe size={20} />, resource: 'settings' },
    { name: t('navigation.orders'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/orders` : '/orders', icon: <ShoppingBag size={20} />, resource: 'orders' },
    { 
      name: t('navigation.expenses'), 
      path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/expenses` : '/expenses', 
      icon: <Receipt size={20} />, 
      resource: 'expenses',
      subItems: [
        { name: t('navigation.submenus.list'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/expenses/list` : '/expenses/list' },
        { name: t('navigation.submenus.categories'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/expenses/categories` : '/expenses/categories' },
        { name: t('navigation.submenus.analytics'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/expenses/analytics` : '/expenses/analytics' },
        { name: t('navigation.submenus.reports'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/expenses/reports` : '/expenses/reports' },
      ]
    },
    { name: t('navigation.finance'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/finance` : '/finance', icon: <DollarSign size={20} />, resource: 'finance' },
    { 
      name: t('navigation.products'), 
      path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/products` : '/products', 
      icon: <Package2 size={20} />, 
      resource: 'products',
      subItems: [
        { name: t('navigation.submenus.list'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/products` : '/products' },
        { name: t('navigation.submenus.categories'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/categories` : '/categories' },
        { name: t('navigation.submenus.stocks'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/products/stocks` : '/products/stocks' },
      ]
    },
    { 
      name: t('navigation.productions'), 
      path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/productions` : '/productions', 
      icon: <Factory size={20} />, 
      resource: 'products', // Using products resource for now
      subItems: [
        { name: t('navigation.submenus.list'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/productions` : '/productions' },
        { name: t('navigation.submenus.categories'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/productions/categories` : '/productions/categories' },
        { name: t('navigation.submenus.steps'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/productions/flow-steps` : '/productions/flow-steps' },
        { name: t('navigation.submenus.flows'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/productions/flows` : '/productions/flows' },
        { name: t('navigation.submenus.charges'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/productions/charges` : '/productions/charges' },
      ]
    },
    { 
      name: t('navigation.warehouse'), 
      path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/magasin` : '/magasin', 
      icon: <Warehouse size={20} />, 
      resource: RESOURCES.MAGASIN,
      subItems: [
        { name: t('navigation.warehouseMenu.matieres'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/magasin/matieres` : '/magasin/matieres' },
        { name: t('navigation.warehouseMenu.categories'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/magasin/categories` : '/magasin/categories' },
        { name: t('navigation.warehouseMenu.stocks'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/magasin/stocks` : '/magasin/stocks' },
      ]
    },
    { name: t('navigation.suppliers'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/suppliers` : '/suppliers', icon: <Users size={20} />, resource: 'suppliers' },
    { 
      name: t('navigation.contacts'), 
      path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/contacts` : '/contacts', 
      icon: <Phone size={20} />, 
      resource: 'customers',
      subItems: [
        { name: t('navigation.submenus.list'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/contacts` : '/contacts' },
        { name: t('navigation.submenus.clientSources'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/contacts/sources` : '/contacts/sources' },
      ]
    },
    { name: t('navigation.hrManagement'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/hr` : '/hr', icon: <UserCheck size={20} />, resource: 'hr' },
    { name: t('navigation.reports'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/reports` : '/reports', icon: <FileBarChart size={20} />, resource: 'reports' },
    { name: t('navigation.settings'), path: isCompanyRoute ? `/company/${location.pathname.split('/')[2]}/settings` : '/settings', icon: <Settings size={20} />, resource: 'settings' },
  ];

  const navigationItems = isCompanySelectionRoute ? selectionModeItems : normalNavigationItems;

  return (
    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
      {/* Sidebar header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
        {isCompanySelectionRoute ? (
          // En mode sélection, afficher le bouton "Créer entreprise" à la place du logo
          <button
            onClick={() => window.location.href = '/company/create'}
            className="flex items-center px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="font-medium">{t('navigation.createCompany', 'Create Company')}</span>
          </button>
        ) : (
          <Link to="/" className="flex items-center">
            <span className="font-bold text-xl" style={{color: colors.primary}}>Geskap</span>
          </Link>
        )}
        <button 
          className="md:hidden text-gray-500 hover:text-gray-700"
          onClick={onClose}
          aria-label={t('navigation.close')}
        >
          <X size={20} />
        </button>
      </div>
      
      {/* Navigation items */}
      <nav className="flex-1 overflow-y-auto py-4">
        {showTemplateLoader ? (
          <div className="flex flex-col items-center justify-center h-full py-8">
            <Loader2 className="h-8 w-8 text-emerald-500 animate-spin mb-4" />
            <p className="text-sm text-gray-500 text-center px-4">
              {t('navigation.loadingPermissions', 'Loading permissions...')}
            </p>
          </div>
        ) : (
          <ul className="space-y-1 px-2" id='select'>
          {navigationItems.map((item) => {
            // En mode sélection, tous les liens sont activés mais interceptés
            if (isCompanySelectionRoute) {
              return (
                <li key={item.name}>
                  <button
                    onClick={(e) => {
                      // Toujours intercepter en mode sélection
                      if (isSelectionMode) {
                        e.preventDefault();
                        setShowCreateCompanyModal(true);
                      }
                    }}
                    className={`
                      w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                      ${isActive(item.path)
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <span className="mr-3">{item.icon}</span>
                    {item.name}
                  </button>
                </li>
              );
            }

            // Mode normal - vérifier les permissions via centralized permissions
            // Les propriétaires ont accès à tout (isOwner ou effectiveRole === 'owner')
            const isActualOwner = isOwner || effectiveRole === 'owner';
            
            if (isActualOwner) {
              // Propriétaire - afficher tous les items sans restriction
            } else {
              // Vérifier les permissions selon le type de ressource
              const resource = (item as any).resource;
              let hasAccess = true;
              
              if (resource) {
                // Toutes les ressources utilisent maintenant canAccess (unifié avec canView array)
                hasAccess = canAccess(resource);
              } else {
                // If no resource specified, deny access by default for non-owners
                hasAccess = false;
              }
              
              if (!hasAccess) return null;
            }
            
            // Check if this is the "Mes Entreprises" link that needs confirmation
            const isCompaniesManagementLink = item.path === '/companies' && isCompanyRoute;
            
            // Check if this item has subItems (expansible menu)
            const hasSubItems = (item as any).subItems && Array.isArray((item as any).subItems);
            const isExpensesItem = item.name === t('navigation.expenses');
            const isContactsItem = item.name === t('navigation.contacts');
            const isProductsItem = item.name === t('navigation.products');
            const isMagasinItem = item.name === t('navigation.warehouse');
            const isProductionsItem = item.name === t('navigation.productions');
            const isExpanded = (isExpensesItem && expensesMenuExpanded) || (isContactsItem && contactsMenuExpanded) || (isProductsItem && productsMenuExpanded) || (isMagasinItem && magasinMenuExpanded) || (isProductionsItem && productionsMenuExpanded);
            
            return (
              <li key={item.path}>
                {hasSubItems ? (
                  // Expansible menu item
                  <>
                    <button
                      onClick={() => {
                        if (isExpensesItem) {
                          setExpensesMenuExpanded(!expensesMenuExpanded);
                        } else if (isContactsItem) {
                          setContactsMenuExpanded(!contactsMenuExpanded);
                        } else if (isProductsItem) {
                          setProductsMenuExpanded(!productsMenuExpanded);
                        } else if (isMagasinItem) {
                          setMagasinMenuExpanded(!magasinMenuExpanded);
                        } else if (isProductionsItem) {
                          setProductionsMenuExpanded(!productionsMenuExpanded);
                        }
                      }}
                        className={`
                        w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors
                        ${isActive(item.path) || (isExpensesItem && location.pathname.includes('/expenses')) || (isContactsItem && location.pathname.includes('/contacts')) || (isProductsItem && (location.pathname.includes('/products') || (location.pathname.includes('/categories') && !location.pathname.includes('/productions/categories') && !location.pathname.includes('/expenses/categories') && !location.pathname.includes('/magasin/categories')))) || (isMagasinItem && location.pathname.includes('/magasin')) || (isProductionsItem && location.pathname.includes('/productions'))
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}
                      `}
                    >
                      <div className="flex items-center">
                        <span className="mr-3">{item.icon}</span>
                        {item.name}
                      </div>
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    {isExpanded && (
                      <ul className="ml-4 mt-1 space-y-1">
                        {(item as any).subItems.map((subItem: any) => (
                          <li key={subItem.path}>
                            <Link
                              to={subItem.path}
                              onClick={() => onClose()}
                              className={`
                                flex items-center px-3 py-2 text-sm rounded-md transition-colors
                                ${isActive(subItem.path)
                                  ? 'bg-emerald-100 text-emerald-700 font-medium'
                                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                              `}
                            >
                              {subItem.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : isCompaniesManagementLink ? (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setShowCompanyNavigationConfirm(true);
                    }}
                    className={`
                      w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                      ${isActive(item.path)
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}
                    `}
                  >
                    <span className="mr-3">{item.icon}</span>
                    {item.name}
                  </button>
                ) : (
                  <Link
                    to={item.path}
                    onClick={(e) => {
                      if (isSelectionMode) {
                        e.preventDefault();
                        handleNavigationClick(e);
                      } else {
                        onClose();
                      }
                    }}
                    className={`
                      flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                      ${isActive(item.path)
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}
                    `}
                  >
                    <span className="mr-3">{item.icon}</span>
                    {item.name}
                  </Link>
                )}
              </li>
            );
          })}
          
          
          {/* Download App Button */}
          <li className="px-2">
            <DownloadAppButton variant="sidebar" />
          </li>
        </ul>
        )}
      </nav>
      
      {/* User section - Add bottom padding on mobile PWA to prevent overlap with bottom nav */}
      <div 
        className={`border-t border-gray-200 p-4 flex-shrink-0 ${
          isMobile && isInstalled ? 'pb-[calc(1rem+64px+env(safe-area-inset-bottom,0px))]' : ''
        }`}
      >
        <div className="flex items-center">
          <UserAvatar company={company} size="sm" />
          <div className="ml-3 flex-1 min-w-0">
            {currentEmployee && !isOwner ? (
              // Affichage pour les employés
              <div>
                <p className="text-sm font-medium text-gray-700 truncate">
                  Bonjour {currentEmployee.username}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {currentEmployee.role === 'staff' ? 'Vendeur' : 
                   currentEmployee.role === 'manager' ? 'Gestionnaire' : 
                   currentEmployee.role === 'admin' ? 'Magasinier' : currentEmployee.role}
                </p>
              </div>
            ) : (
              // Affichage pour les propriétaires (rien ne s'affiche)
              
              <div>
                {
                  !isSelectionMode ? (
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {company?.name || t('header.welcome')}
                    </p>
                  ) : <p className="text-sm font-medium text-gray-700 truncate">
                    {t('navigation.pleaseCreateCompany', 'Please create a company')}
                  </p>
                }
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Modal pour créer une entreprise */}
      <CreateCompanyModal
        isOpen={showCreateCompanyModal}
        onClose={() => setShowCreateCompanyModal(false)}
        onCreateCompany={handleCreateCompany}
      />
      
      {/* Confirmation modal for navigating to companies management */}
      <Modal
        isOpen={showCompanyNavigationConfirm}
        onClose={() => setShowCompanyNavigationConfirm(false)}
        title={t('navigation.confirmCompanyExit') || 'Leave Current Company?'}
        footer={
          <ModalFooter
            onCancel={() => setShowCompanyNavigationConfirm(false)}
            onConfirm={() => {
              setShowCompanyNavigationConfirm(false);
              onClose();
              navigate('/companies');
            }}
            confirmText={t('common.confirm') || 'Confirm'}
            cancelText={t('common.cancel') || 'Cancel'}
          />
        }
      >
        <div className="text-center py-4">
          <p className="text-gray-600 mb-4">
            {t('navigation.confirmCompanyExitMessage') || 
              'You are about to leave the current company context to manage your companies.'}
          </p>
          {company && (
            <p className="text-sm text-gray-500 mb-2">
              <strong>{t('navigation.currentCompany') || 'Current Company'}:</strong> {company.name}
            </p>
          )}
          <p className="text-sm text-gray-500">
            {t('navigation.confirmCompanyExitQuestion') || 'Are you sure you want to continue?'}
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default Sidebar;