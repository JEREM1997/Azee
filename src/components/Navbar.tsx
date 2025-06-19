import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, LogOut, User, Settings, PieChart, FileText, Home, Users, Calendar, Truck } from 'lucide-react';
import krispyKremeLogo from '../assets/krispy-kreme-ops-logo.png';

const Navbar: React.FC = () => {
  const { currentUser, logout, isAdmin, isProduction } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-24">
          {/* Logo Section */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="flex items-center h-full">
              <img 
                src={krispyKremeLogo} 
                alt="Krispy Kreme OPS" 
                className="h-20 w-auto"
                style={{ maxWidth: '400px' }}
              />
            </Link>
          </div>
          
          {/* Desktop Navigation Menu */}
          <div className="hidden lg:flex items-center flex-1 justify-center px-8">
            {currentUser && (
              <div className="flex items-center space-x-1">
                <Link 
                  to="/" 
                  className="text-krispy-green hover:text-krispy-green-dark hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-all duration-200"
                >
                  <Home className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="whitespace-nowrap">Tableau de bord</span>
                </Link>
                
                {(isAdmin || isProduction) && (
                  <>
                    <Link 
                      to="/production" 
                      className="text-krispy-green hover:text-krispy-green-dark hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-all duration-200"
                    >
                      <FileText className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="whitespace-nowrap">Production</span>
                    </Link>
                    <Link 
                      to="/plans" 
                      className="text-krispy-green hover:text-krispy-green-dark hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-all duration-200"
                    >
                      <Calendar className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="whitespace-nowrap">Plans</span>
                    </Link>
                  </>
                )}
                
                <Link 
                  to="/livraisons" 
                  className="text-krispy-green hover:text-krispy-green-dark hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-all duration-200"
                >
                  <Truck className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="whitespace-nowrap">Livraisons</span>
                </Link>
                
                {isAdmin && (
                  <>
                    <Link 
                      to="/statistiques" 
                      className="text-krispy-green hover:text-krispy-green-dark hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-all duration-200"
                    >
                      <PieChart className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="whitespace-nowrap">Statistiques</span>
                    </Link>
                    <Link 
                      to="/admin" 
                      className="text-krispy-green hover:text-krispy-green-dark hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-all duration-200"
                    >
                      <Settings className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="whitespace-nowrap">Administration</span>
                    </Link>
                    <Link 
                      to="/users" 
                      className="text-krispy-green hover:text-krispy-green-dark hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-all duration-200"
                    >
                      <Users className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="whitespace-nowrap">Utilisateurs</span>
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
          
          {/* User Section - Desktop */}
          <div className="hidden lg:flex items-center flex-shrink-0">
            {currentUser && (
              <div className="flex items-center space-x-4 pl-6 border-l border-gray-200">
                <div className="flex items-center text-gray-700">
                  <User className="w-4 h-4 mr-2 text-gray-500" />
                  <span className="text-sm font-medium">{currentUser.fullName}</span>
                </div>
                <button 
                  onClick={logout}
                  className="text-krispy-red hover:text-krispy-red-dark hover:bg-red-50 px-3 py-2 rounded-lg flex items-center transition-all duration-200 text-sm font-medium"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Déconnexion
                </button>
              </div>
            )}
          </div>
          
          {/* Medium Screen Navigation (md to lg) */}
          <div className="hidden md:flex lg:hidden items-center space-x-2">
            {currentUser && (
              <>
                <Link to="/" className="text-krispy-green hover:text-krispy-green-dark px-2 py-2 rounded-md text-xs font-medium flex items-center transition-colors">
                  <Home className="w-4 h-4" />
                </Link>
                {(isAdmin || isProduction) && (
                  <>
                    <Link to="/production" className="text-krispy-green hover:text-krispy-green-dark px-2 py-2 rounded-md text-xs font-medium flex items-center transition-colors">
                      <FileText className="w-4 h-4" />
                    </Link>
                    <Link to="/plans" className="text-krispy-green hover:text-krispy-green-dark px-2 py-2 rounded-md text-xs font-medium flex items-center transition-colors">
                      <Calendar className="w-4 h-4" />
                    </Link>
                  </>
                )}
                <Link to="/livraisons" className="text-krispy-green hover:text-krispy-green-dark px-2 py-2 rounded-md text-xs font-medium flex items-center transition-colors">
                  <Truck className="w-4 h-4" />
                </Link>
                {isAdmin && (
                  <>
                    <Link to="/statistiques" className="text-krispy-green hover:text-krispy-green-dark px-2 py-2 rounded-md text-xs font-medium flex items-center transition-colors">
                      <PieChart className="w-4 h-4" />
                    </Link>
                    <Link to="/admin" className="text-krispy-green hover:text-krispy-green-dark px-2 py-2 rounded-md text-xs font-medium flex items-center transition-colors">
                      <Settings className="w-4 h-4" />
                    </Link>
                    <Link to="/users" className="text-krispy-green hover:text-krispy-green-dark px-2 py-2 rounded-md text-xs font-medium flex items-center transition-colors">
                      <Users className="w-4 h-4" />
                    </Link>
                  </>
                )}
                <div className="flex items-center space-x-2 pl-2 ml-2 border-l border-gray-200">
                  <span className="text-gray-700 text-xs font-medium">{currentUser.fullName}</span>
                  <button 
                    onClick={logout}
                    className="text-krispy-red hover:text-krispy-red-dark flex items-center transition-colors p-1"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
          
          {/* Mobile menu button */}
          <div className="flex md:hidden items-center">
            <button 
              onClick={toggleMenu}
              className="inline-flex items-center justify-center p-2 rounded-lg text-krispy-green hover:text-krispy-green-dark hover:bg-gray-50 focus:outline-none transition-all duration-200"
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
        <div className="md:hidden bg-white border-t border-gray-200 shadow-lg">
          <div className="px-4 pt-3 pb-4 space-y-2">
            {currentUser && (
              <>
                <Link 
                  to="/" 
                  className="text-krispy-green hover:bg-gray-50 block px-4 py-3 rounded-lg text-base font-medium flex items-center transition-all duration-200"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Home className="w-5 h-5 mr-3 flex-shrink-0" />
                  <span className="whitespace-nowrap">Tableau de bord</span>
                </Link>
                {(isAdmin || isProduction) && (
                  <>
                    <Link 
                      to="/production" 
                      className="text-krispy-green hover:bg-gray-50 block px-4 py-3 rounded-lg text-base font-medium flex items-center transition-all duration-200"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <FileText className="w-5 h-5 mr-3 flex-shrink-0" />
                      <span className="whitespace-nowrap">Production</span>
                    </Link>
                    <Link 
                      to="/plans" 
                      className="text-krispy-green hover:bg-gray-50 block px-4 py-3 rounded-lg text-base font-medium flex items-center transition-all duration-200"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Calendar className="w-5 h-5 mr-3 flex-shrink-0" />
                      <span className="whitespace-nowrap">Plans</span>
                    </Link>
                  </>
                )}
                <Link 
                  to="/livraisons" 
                  className="text-krispy-green hover:bg-gray-50 block px-4 py-3 rounded-lg text-base font-medium flex items-center transition-all duration-200"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Truck className="w-5 h-5 mr-3 flex-shrink-0" />
                  <span className="whitespace-nowrap">Livraisons</span>
                </Link>
                {isAdmin && (
                  <>
                    <Link 
                      to="/statistiques" 
                      className="text-krispy-green hover:bg-gray-50 block px-4 py-3 rounded-lg text-base font-medium flex items-center transition-all duration-200"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <PieChart className="w-5 h-5 mr-3 flex-shrink-0" />
                      <span className="whitespace-nowrap">Statistiques</span>
                    </Link>
                    <Link 
                      to="/admin" 
                      className="text-krispy-green hover:bg-gray-50 block px-4 py-3 rounded-lg text-base font-medium flex items-center transition-all duration-200"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Settings className="w-5 h-5 mr-3 flex-shrink-0" />
                      <span className="whitespace-nowrap">Administration</span>
                    </Link>
                    <Link 
                      to="/users" 
                      className="text-krispy-green hover:bg-gray-50 block px-4 py-3 rounded-lg text-base font-medium flex items-center transition-all duration-200"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Users className="w-5 h-5 mr-3 flex-shrink-0" />
                      <span className="whitespace-nowrap">Utilisateurs</span>
                    </Link>
                  </>
                )}
                
                {/* Mobile User Section */}
                <div className="border-t border-gray-200 pt-3 mt-3">
                  <div className="px-4 py-2 flex items-center text-gray-700">
                    <User className="w-5 h-5 mr-3 text-gray-500 flex-shrink-0" />
                    <span className="text-base font-medium whitespace-nowrap">{currentUser.fullName}</span>
                  </div>
                  <button 
                    onClick={() => {
                      logout();
                      setIsMenuOpen(false);
                    }}
                    className="text-krispy-red hover:bg-red-50 block px-4 py-3 rounded-lg text-base font-medium w-full text-left flex items-center transition-all duration-200"
                  >
                    <LogOut className="w-5 h-5 mr-3 flex-shrink-0" />
                    <span className="whitespace-nowrap">Déconnexion</span>
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