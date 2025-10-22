import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Users, Package, DollarSign, X, Building2, User } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FICTIVE_DATA from '../../utils/fictiveData';

export default function FictiveDashboard() {
  const [showBanner, setShowBanner] = useState(true);
  const navigate = useNavigate();

  // Vérifier si la bannière a été fermée (localStorage)
  useEffect(() => {
    const bannerDismissed = localStorage.getItem('fictive-dashboard-banner-dismissed');
    if (bannerDismissed === 'true') {
      setShowBanner(false);
    }
  }, []);

  const handleDismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem('fictive-dashboard-banner-dismissed', 'true');
  };

  const handleChooseCompany = () => {
    // TODO: Ouvrir le modal de sélection de company
    console.log('Ouvrir modal de sélection de company');
  };

  const handleContinueAsCompany = () => {
    // TODO: Vérifier si l'utilisateur a une company et rediriger
    navigate('/company/create');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Info Banner */}
      {showBanner && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-sm">📊</span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-800">
                    <strong>Mode Employé - Données Fictives</strong> - Ce dashboard contient des données fictives à titre d'exemple.
                  </p>
                </div>
              </div>
              <button
                onClick={handleDismissBanner}
                className="flex-shrink-0 ml-4 text-blue-400 hover:text-blue-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Building2 className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-3">
                <h1 className="text-2xl font-bold text-gray-900">{FICTIVE_DATA.companyName}</h1>
                <p className="text-sm text-gray-500">{FICTIVE_DATA.description}</p>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={handleChooseCompany}
                className="flex items-center"
              >
                <Building2 className="h-4 w-4 mr-2" />
                Choisir une companie
              </Button>
              <Button
                onClick={handleContinueAsCompany}
                className="flex items-center"
              >
                <User className="h-4 w-4 mr-2" />
                Continuer en tant que companie
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Ventes</p>
                <p className="text-2xl font-bold text-gray-900">{FICTIVE_DATA.stats.sales}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Produits</p>
                <p className="text-2xl font-bold text-gray-900">{FICTIVE_DATA.stats.products}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Clients</p>
                <p className="text-2xl font-bold text-gray-900">{FICTIVE_DATA.stats.customers}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-yellow-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Chiffre d'affaires</p>
                <p className="text-2xl font-bold text-gray-900">{FICTIVE_DATA.stats.revenue.toLocaleString()} €</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Sales */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Ventes récentes</h3>
              <span className="text-sm text-gray-500">Données fictives</span>
            </div>
            <div className="space-y-3">
              {FICTIVE_DATA.recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{sale.customer}</p>
                    <p className="text-sm text-gray-500">{sale.product}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{sale.amount.toFixed(2)} €</p>
                    <p className="text-sm text-gray-500">{sale.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Top Products */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Produits populaires</h3>
              <span className="text-sm text-gray-500">Données fictives</span>
            </div>
            <div className="space-y-3">
              {FICTIVE_DATA.products.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{product.name}</p>
                    <p className="text-sm text-gray-500">{product.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{product.price.toFixed(2)} €</p>
                    <p className="text-sm text-gray-500">Stock: {product.stock}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent Customers */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Clients récents</h3>
              <span className="text-sm text-gray-500">Données fictives</span>
            </div>
            <div className="space-y-3">
              {FICTIVE_DATA.customers.map((customer) => (
                <div key={customer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{customer.name}</p>
                    <p className="text-sm text-gray-500">{customer.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{customer.totalOrders} commandes</p>
                    <p className="text-sm text-gray-500">{customer.totalSpent.toFixed(2)} €</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent Expenses */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Dépenses récentes</h3>
              <span className="text-sm text-gray-500">Données fictives</span>
            </div>
            <div className="space-y-3">
              {FICTIVE_DATA.expenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{expense.description}</p>
                    <p className="text-sm text-gray-500">{expense.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{expense.amount.toFixed(2)} €</p>
                    <p className="text-sm text-gray-500">{expense.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Objectives */}
        <div className="mt-8">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Objectifs</h3>
              <span className="text-sm text-gray-500">Données fictives</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {FICTIVE_DATA.objectives.map((objective) => (
                <div key={objective.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{objective.title}</h4>
                    <span className="text-sm text-gray-500">{objective.status}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">{objective.current} / {objective.target}</span>
                    <span className="text-sm text-gray-500">{objective.deadline}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full" 
                      style={{ width: `${(objective.current / objective.target) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
