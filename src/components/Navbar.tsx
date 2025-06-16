import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, LogOut, User, Settings, PieChart, FileText, Home, Users, Calendar, Truck } from 'lucide-react';

const Navbar: React.FC = () => {
  const { currentUser, logout, isAdmin, isProduction } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="text-2xl font-bold text-krispy-green">
              Krispy Kreme
            </Link>
          </div>
          
          {/* Desktop menu */}
          <div className="hidden md:flex items-center space-x-4">
            {currentUser && (
              <>
                <Link to="/" className="text-krispy-green hover:text-krispy-green-dark px-3 py-2 rounded-md text-sm font-medium flex items-center transition-colors">
                  <Home className="w-4 h-4 mr-1" />
                  Tableau de bord
                </Link>
                {(isAdmin || isProduction) && (
                  <>
                    <Link to="/production" className="text-krispy-green hover:text-krispy-green-dark px-3 py-2 rounded-md text-sm font-medium flex items-center transition-colors">
                      <FileText className="w-4 h-4 mr-1" />
                      Production
                    </Link>
                    <Link to="/plans" className="text-krispy-green hover:text-krispy-green-dark px-3 py-2 rounded-md text-sm font-medium flex items-center transition-colors">
                      <Calendar className="w-4 h-4 mr-1" />
                      Plans
                    </Link>
                  </>
                )}
                <Link to="/livraisons" className="text-krispy-green hover:text-krispy-green-dark px-3 py-2 rounded-md text-sm font-medium flex items-center transition-colors">
                  <Truck className="w-4 h-4 mr-1" />
                  Livraisons
                </Link>
                {isAdmin && (
                  <>
                    <Link to="/statistiques" className="text-krispy-green hover:text-krispy-green-dark px-3 py-2 rounded-md text-sm font-medium flex items-center transition-colors">
                      <PieChart className="w-4 h-4 mr-1" />
                      Statistiques
                    </Link>
                    <Link to="/admin" className="text-krispy-green hover:text-krispy-green-dark px-3 py-2 rounded-md text-sm font-medium flex items-center transition-colors">
                      <Settings className="w-4 h-4 mr-1" />
                      Administration
                    </Link>
                    <Link to="/users" className="text-krispy-green hover:text-krispy-green-dark px-3 py-2 rounded-md text-sm font-medium flex items-center transition-colors">
                      <Users className="w-4 h-4 mr-1" />
                      Utilisateurs
                    </Link>
                  </>
                )}
                <div className="pl-4 ml-4 border-l border-gray-200 flex items-center">
                  <span className="text-gray-700 mr-4 flex items-center">
                    <User className="w-4 h-4 mr-1" />
                    {currentUser.fullName}
                  </span>
                  <button 
                    onClick={logout}
                    className="text-krispy-red hover:text-krispy-red-dark flex items-center transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-1" />
                    Déconnexion
                  </button>
                </div>
              </>
            )}
          </div>
          
          {/* Mobile menu button */}
          <div className="flex md:hidden items-center">
            <button 
              onClick={toggleMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-krispy-green hover:text-krispy-green-dark focus:outline-none"
            >
              {isMenuOpen ? (
                <X className="block h-6 w-6" />
              ) : (
                <Menu className="block h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {currentUser && (
              <>
                <Link 
                  to="/" 
                  className="text-krispy-green hover:bg-gray-50 block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Tableau de bord
                </Link>
                {(isAdmin || isProduction) && (
                  <>
                    <Link 
                      to="/production" 
                      className="text-krispy-green hover:bg-gray-50 block px-3 py-2 rounded-md text-base font-medium"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Production
                    </Link>
                    <Link 
                      to="/plans" 
                      className="text-krispy-green hover:bg-gray-50 block px-3 py-2 rounded-md text-base font-medium"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Plans
                    </Link>
                  </>
                )}
                <Link 
                  to="/livraisons" 
                  className="text-krispy-green hover:bg-gray-50 block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Livraisons
                </Link>
                {isAdmin && (
                  <>
                    <Link 
                      to="/statistiques" 
                      className="text-krispy-green hover:bg-gray-50 block px-3 py-2 rounded-md text-base font-medium"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Statistiques
                    </Link>
                    <Link 
                      to="/admin" 
                      className="text-krispy-green hover:bg-gray-50 block px-3 py-2 rounded-md text-base font-medium"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Administration
                    </Link>
                    <Link 
                      to="/users" 
                      className="text-krispy-green hover:bg-gray-50 block px-3 py-2 rounded-md text-base font-medium"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Utilisateurs
                    </Link>
                  </>
                )}
                <div className="border-t border-gray-200 pt-2 pb-2">
                  <span className="text-gray-700 px-3 py-2 block text-base font-medium">
                    {currentUser.fullName}
                  </span>
                  <button 
                    onClick={() => {
                      logout();
                      setIsMenuOpen(false);
                    }}
                    className="text-krispy-red hover:bg-gray-50 block px-3 py-2 rounded-md text-base font-medium w-full text-left"
                  >
                    Déconnexion
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;