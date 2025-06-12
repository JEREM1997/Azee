import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, User, Shield, Eye, EyeOff, AlertTriangle, Check, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { createUser } from '../services/userService';
import { supabase } from '../lib/supabase';

interface Store {
  id: string;
  name: string;
  location: string;
  isActive: boolean;
}

interface CreateUserFormValues {
  username: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  role: 'admin' | 'production' | 'store';
  storeIds: string[];
}

const CreateUserPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStores, setLoadingStores] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  
  const [formValues, setFormValues] = useState<CreateUserFormValues>({
    username: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    role: 'store',
    storeIds: []
  });

  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CreateUserFormValues, string>>>({});

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
    }
  }, [isAdmin, navigate]);

  // Load stores from database
  useEffect(() => {
    const loadStores = async () => {
      try {
        console.log('Loading stores...');
        setLoadingStores(true);
        
        // Use the same method as AdminPage to get stores
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.error('No authenticated session found');
          setError('Session non authentifiée');
          return;
        }

        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-admin-data`;
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch admin data: ${response.status}`);
        }

        const adminData = await response.json();
        console.log('Admin data received:', adminData);

        if (adminData.stores) {
          const activeStores = adminData.stores.filter((store: any) => store.isActive);
          console.log('Active stores:', activeStores);
          setStores(activeStores);
        } else {
          console.log('No stores in admin data');
          setStores([]);
        }
      } catch (err) {
        console.error('Error loading stores:', err);
        setError('Erreur lors du chargement des magasins');
        setStores([]);
      } finally {
        setLoadingStores(false);
      }
    };

    if (isAdmin) {
      loadStores();
    }
  }, [isAdmin]);

  // Validation function
  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof CreateUserFormValues, string>> = {};

    // Username validation
    if (!formValues.username.trim()) {
      errors.username = 'Le nom d\'utilisateur est requis';
    } else if (formValues.username.length < 3) {
      errors.username = 'Le nom d\'utilisateur doit contenir au moins 3 caractères';
    } else if (!/^[a-zA-Z0-9._-]+$/.test(formValues.username)) {
      errors.username = 'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, points, tirets et underscores';
    }

    // Full name validation
    if (!formValues.fullName.trim()) {
      errors.fullName = 'Le nom complet est requis';
    } else if (formValues.fullName.length < 2) {
      errors.fullName = 'Le nom complet doit contenir au moins 2 caractères';
    }

    // Password validation - Updated to match backend (minimum 6 characters)
    if (!formValues.password) {
      errors.password = 'Le mot de passe est requis';
    } else if (formValues.password.length < 6) {
      errors.password = 'Le mot de passe doit contenir au moins 6 caractères';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formValues.password)) {
      errors.password = 'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre';
    }

    // Confirm password validation
    if (!formValues.confirmPassword) {
      errors.confirmPassword = 'La confirmation du mot de passe est requise';
    } else if (formValues.password !== formValues.confirmPassword) {
      errors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    // Store assignment validation for store users
    if (formValues.role === 'store' && formValues.storeIds.length === 0) {
      errors.storeIds = 'Au moins un magasin doit être assigné pour les utilisateurs de type "Magasin"';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear field-specific error when user starts typing
    if (formErrors[field as keyof CreateUserFormValues]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const handleStoreIdsChange = (storeIds: string[]) => {
    setFormValues(prev => ({
      ...prev,
      storeIds
    }));

    // Clear field-specific error when user starts typing
    if (formErrors.storeIds) {
      setFormErrors(prev => ({
        ...prev,
        storeIds: undefined
      }));
    }
  };

  const handleStoreToggle = (storeId: string) => {
    const newStoreIds = formValues.storeIds.includes(storeId)
      ? formValues.storeIds.filter(id => id !== storeId)
      : [...formValues.storeIds, storeId];
    
    handleStoreIdsChange(newStoreIds);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setError('Veuillez corriger les erreurs dans le formulaire');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await createUser(
        formValues.username,
        formValues.password,
        formValues.fullName,
        formValues.role,
        formValues.role === 'store' ? formValues.storeIds : []
      );

      setSuccess(`Utilisateur "${formValues.fullName}" créé avec succès !`);
      
      // Reset form
      setFormValues({
        username: '',
        password: '',
        confirmPassword: '',
        fullName: '',
        role: 'store',
        storeIds: []
      });
      setFormErrors({});

      // Auto-redirect after 3 seconds
      setTimeout(() => {
        navigate('/users');
      }, 3000);

    } catch (err) {
      console.error('Error creating user:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la création de l\'utilisateur');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (newRole: 'admin' | 'production' | 'store') => {
    setFormValues(prev => ({
      ...prev,
      role: newRole,
      // Clear store IDs if the new role is not 'store'
      storeIds: newRole === 'store' ? prev.storeIds : []
    }));
  };

  if (!isAdmin) {
    return null;
  }

  if (loadingStores) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-krispy-green"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <button
          onClick={() => navigate('/users')}
          className="inline-flex items-center text-krispy-green hover:text-krispy-green-dark mb-4 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Retour à la liste des utilisateurs
        </button>
        
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <UserPlus className="h-8 w-8 mr-3 text-krispy-green" />
          Créer un Nouvel Utilisateur
        </h1>
        <p className="text-gray-600 mt-2">
          Créez un nouveau compte utilisateur avec les permissions appropriées
        </p>
      </div>

      {/* Messages d'erreur et de succès */}
      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4 rounded-md">
          <div className="flex">
            <Check className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <p className="text-sm text-green-700">{success}</p>
              <p className="text-xs text-green-600 mt-1">Redirection vers la liste des utilisateurs...</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Personal Information Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <User className="h-5 w-5 mr-2 text-krispy-green" />
              Informations Personnelles
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Full Name */}
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                  Nom Complet *
                </label>
                <input
                  type="text"
                  id="fullName"
                  value={formValues.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green focus:border-krispy-green ${
                    formErrors.fullName ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Entrez le nom complet"
                />
                {formErrors.fullName && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.fullName}</p>
                )}
              </div>

              {/* Username */}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Nom d'Utilisateur *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="username"
                    value={formValues.username}
                    onChange={(e) => handleInputChange('username', e.target.value.toLowerCase())}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green focus:border-krispy-green ${
                      formErrors.username ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="nom.utilisateur"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 text-sm">@krispykreme.internal</span>
                  </div>
                </div>
                {formErrors.username && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.username}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  L'email sera automatiquement généré : {formValues.username ? `${formValues.username}@krispykreme.internal` : 'nom.utilisateur@krispykreme.internal'}
                </p>
              </div>
            </div>
          </div>

          {/* Password Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Mot de Passe
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Mot de Passe *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={formValues.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className={`w-full px-3 py-2 pr-10 border rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green focus:border-krispy-green ${
                      formErrors.password ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Mot de passe sécurisé"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {formErrors.password && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmer le Mot de Passe *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    value={formValues.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    className={`w-full px-3 py-2 pr-10 border rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green focus:border-krispy-green ${
                      formErrors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Confirmez le mot de passe"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {formErrors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.confirmPassword}</p>
                )}
              </div>
            </div>

            {/* Password Requirements - Updated for 6+ characters */}
            <div className="mt-3 p-3 bg-gray-50 rounded-md">
              <p className="text-xs text-gray-600 font-medium mb-2">Exigences du mot de passe :</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li className={`flex items-center ${formValues.password.length >= 6 ? 'text-green-600' : ''}`}>
                  <span className="mr-2">{formValues.password.length >= 6 ? '✓' : '○'}</span>
                  Au moins 6 caractères
                </li>
                <li className={`flex items-center ${/(?=.*[a-z])/.test(formValues.password) ? 'text-green-600' : ''}`}>
                  <span className="mr-2">{/(?=.*[a-z])/.test(formValues.password) ? '✓' : '○'}</span>
                  Au moins une lettre minuscule
                </li>
                <li className={`flex items-center ${/(?=.*[A-Z])/.test(formValues.password) ? 'text-green-600' : ''}`}>
                  <span className="mr-2">{/(?=.*[A-Z])/.test(formValues.password) ? '✓' : '○'}</span>
                  Au moins une lettre majuscule
                </li>
                <li className={`flex items-center ${/(?=.*\d)/.test(formValues.password) ? 'text-green-600' : ''}`}>
                  <span className="mr-2">{/(?=.*\d)/.test(formValues.password) ? '✓' : '○'}</span>
                  Au moins un chiffre
                </li>
              </ul>
            </div>
          </div>

          {/* Role and Permissions Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Shield className="h-5 w-5 mr-2 text-krispy-green" />
              Rôle et Permissions
            </h3>
            
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                Rôle *
              </label>
              <select
                id="role"
                value={formValues.role}
                onChange={(e) => handleRoleChange(e.target.value as 'admin' | 'production' | 'store')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green focus:border-krispy-green"
              >
                <option value="store">Magasin - Gestion d'un ou plusieurs magasins</option>
                <option value="production">Production - Planification et gestion de la production</option>
                <option value="admin">Administrateur - Accès complet au système</option>
              </select>

              {/* Role Description */}
              <div className="mt-3 p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-800 font-medium">
                  {formValues.role === 'admin' && 'Accès administrateur complet'}
                  {formValues.role === 'production' && 'Gestion de la production et planification'}
                  {formValues.role === 'store' && 'Gestion des opérations de magasin'}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {formValues.role === 'admin' && 'Peut gérer tous les utilisateurs, magasins et accéder à toutes les fonctionnalités.'}
                  {formValues.role === 'production' && 'Peut créer des plans de production, gérer les variétés et suivre les coûts.'}
                  {formValues.role === 'store' && 'Peut confirmer les livraisons, signaler les déchets et voir les performances du magasin.'}
                </p>
              </div>
            </div>

            {/* Store Assignment for Store Users */}
            {formValues.role === 'store' && (
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Magasins Assignés * ({stores.length} magasins trouvés)
                </label>
                {stores.length === 0 ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                      Aucun magasin disponible. Veuillez d'abord créer des magasins dans la section administration.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto border rounded-md p-4">
                    {stores.map(store => (
                      <div key={store.id} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`store-${store.id}`}
                          checked={formValues.storeIds.includes(store.id)}
                          onChange={() => handleStoreToggle(store.id)}
                          className="h-4 w-4 text-krispy-green focus:ring-krispy-green border-gray-300 rounded"
                        />
                        <label htmlFor={`store-${store.id}`} className="ml-2 text-sm text-gray-900">
                          <span className="font-medium">{store.name}</span>
                          <span className="text-gray-500 text-xs ml-1">({store.location})</span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                {formErrors.storeIds && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.storeIds}</p>
                )}
                {stores.length > 0 && (
                  <p className="mt-2 text-xs text-gray-500">
                    Sélectionnez les magasins auxquels cet utilisateur aura accès.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading || (formValues.role === 'store' && stores.length === 0)}
              className="flex-1 inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-krispy-green hover:bg-krispy-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Création en cours...
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5 mr-2" />
                  Créer l'Utilisateur
                </>
              )}
            </button>
            
            <button
              type="button"
              onClick={() => navigate('/users')}
              className="px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateUserPage; 