import { Link } from 'react-router-dom';
import Button from '../components/common/Button';
import { Building2, Users, BarChart3, Shield } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      {/* Header */}
      <header className="px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Le Bon Prix</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/auth/login">
              <Button variant="outline" size="sm">
                Se connecter
              </Button>
            </Link>
            <Link to="/auth/signup">
              <Button size="sm">
                S'inscrire
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Content */}
          <div className="mb-16">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Gérez votre entreprise en toute{' '}
              <span className="text-indigo-600">simplicité</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              La solution complète pour gérer vos ventes, stocks, employés et finances. 
              Simple, efficace et adaptée à votre business.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth/signup">
                <Button size="lg" className="w-full sm:w-auto">
                  Commencer gratuitement
                </Button>
              </Link>
              <Link to="/auth/login">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Se connecter
                </Button>
              </Link>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-6 w-6 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Tableaux de bord
              </h3>
              <p className="text-gray-600">
                Suivez vos performances en temps réel avec des graphiques clairs et des métriques importantes.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Users className="h-6 w-6 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Gestion d'équipe
              </h3>
              <p className="text-gray-600">
                Gérez vos employés, assignez des rôles et suivez les performances de votre équipe.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Shield className="h-6 w-6 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Sécurisé
              </h3>
              <p className="text-gray-600">
                Vos données sont protégées avec les meilleures pratiques de sécurité et de confidentialité.
              </p>
            </div>
          </div>

          {/* Demo Preview */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-16">
            <div className="bg-gray-100 rounded-lg p-6">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-indigo-600">1,234</div>
                  <div className="text-sm text-gray-600">Ventes</div>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">56</div>
                  <div className="text-sm text-gray-600">Produits</div>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">78</div>
                  <div className="text-sm text-gray-600">Clients</div>
                </div>
              </div>
              <div className="text-center text-gray-500 text-sm">
                Aperçu du tableau de bord
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-semibold text-gray-900">Le Bon Prix</span>
            </div>
            
            <div className="flex flex-wrap justify-center md:justify-end space-x-6 text-sm text-gray-600">
              <a href="#" className="hover:text-indigo-600 transition-colors">
                Confidentialité
              </a>
              <a href="#" className="hover:text-indigo-600 transition-colors">
                Conditions
              </a>
              <a href="#" className="hover:text-indigo-600 transition-colors">
                Support
              </a>
              <a href="#" className="hover:text-indigo-600 transition-colors">
                Contact
              </a>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
            © 2024 Le Bon Prix. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}
