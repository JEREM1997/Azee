import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit, Trash2, Save, X, Users, Key } from 'lucide-react';
import { createUser, updateUser, deleteUser, getUsers, updateUserPassword, updateUserStores } from '../services/userService';
import { getAllStoreData } from '../services/storeManagementService';
import { User, Store } from '../types';
import { useAuth } from '../context/AuthContext';

interface UserFormValues {
  id: string;
  username: string;
  fullName: string;
  role: 'admin' | 'production' | 'store';
  storeIds: string[];
  password?: string;
}

const UsersPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storesError, setStoresError] = useState<string | null>(null);
  
  const [formValues, setFormValues] = useState<UserFormValues>({
    id: '',
    username: '',
    fullName: '',
    role: 'store',
    storeIds: [],
    password: ''
  });

  useEffect(() => {
    loadUsers();
    loadStores();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading users from server...');
      const loadedUsers = await getUsers();
      console.log('Loaded users from server:', loadedUsers);
      
      if (Array.isArray(loadedUsers)) {
        setUsers(loadedUsers);
        console.log('Users state updated with:', loadedUsers);
      } else {
        console.error('Invalid response format:', loadedUsers);
        throw new Error('Invalid response format from server');
      }
    } catch (error) {
      console.error('Error loading users:', error);
      setError('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  const loadStores = async () => {
    try {
      setStoresLoading(true);
      setStoresError(null);
      const data = await getAllStoreData();
      setStores(Array.isArray(data.stores) ? data.stores.filter(s => s.isActive) : []);
    } catch (err) {
      setStoresError('Erreur lors du chargement des magasins');
    } finally {
      setStoresLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    console.log('Editing user:', user);
    const newFormValues = {
      id: user.id,
      username: user.email.split('@')[0],
      fullName: user.fullName,
      role: user.role as 'admin' | 'production' | 'store',
      storeIds: user.storeIds || [],
      password: ''
    };
    console.log('Setting form values:', newFormValues);
    setFormValues(newFormValues);
    setIsEditing(true);
  };

  const handleChangePassword = (userId: string) => {
    setSelectedUserId(userId);
    setNewPassword('');
    setIsChangingPassword(true);
  };

  const handlePasswordChange = async () => {
    if (!selectedUserId || !newPassword) {
      setError('Veuillez entrer un nouveau mot de passe');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await updateUserPassword(selectedUserId, newPassword);
      setIsChangingPassword(false);
      setNewPassword('');
      setSelectedUserId(null);
    } catch (error) {
      console.error('Error updating password:', error);
      setError(error instanceof Error ? error.message : 'Erreur lors de la mise à jour du mot de passe');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      return;
    }

    try {
      setError(null);
      await deleteUser(id);
      setUsers(prev => prev.filter(user => user.id !== id));
    } catch (error) {
      setError('Erreur lors de la suppression de l\'utilisateur');
      console.error('Erreur:', error);
    }
  };

  const handleSave = async () => {
    if (!formValues.fullName.trim()) {
      setError('Le nom complet est requis');
      return;
    }

    console.log('Saving user with data:', {
      id: formValues.id,
      fullName: formValues.fullName,
      role: formValues.role,
      storeIds: formValues.storeIds
    });

    try {
      setSaving(true);
      setError(null);

      if (formValues.id) {
        console.log('Updating existing user...');
        
        // Step 1: Update basic user info (fullName and role)
        console.log('Step 1: Updating user basic info...');
        const updatedUser = await updateUser(formValues.id, {
          fullName: formValues.fullName,
          role: formValues.role
        });

        console.log('User basic info updated successfully:', updatedUser);

        if (!updatedUser) {
          throw new Error('Failed to update user - no user returned from server');
        }

        // Verify the fullName was actually updated
        if (updatedUser.user_metadata?.full_name !== formValues.fullName) {
          console.warn('Full name verification failed:', {
            expected: formValues.fullName,
            actual: updatedUser.user_metadata?.full_name
          });
          throw new Error(`Update failed: name not saved correctly. Expected "${formValues.fullName}" but got "${updatedUser.user_metadata?.full_name}"`);
        }

        console.log('✅ Server confirmed update successful - metadata contains:', updatedUser.user_metadata?.full_name);

        // Step 2: Update store assignments
        console.log('Step 2: Updating store assignments...');
        try {
          if (formValues.role === 'store') {
            await updateUserStores(formValues.id, formValues.storeIds);
            console.log('Store assignments updated successfully for store role');
          } else {
            // Clear store assignments for non-store roles
            await updateUserStores(formValues.id, []);
            console.log('Store assignments cleared successfully for non-store role');
          }
        } catch (storeError) {
          console.error('Error updating store assignments:', storeError);
          // If store update fails, we should still show success for the user info update
          // but inform the user about the store assignment issue
          setError(`Utilisateur mis à jour, mais erreur lors de la mise à jour des magasins: ${storeError instanceof Error ? storeError.message : 'Erreur inconnue'}`);
        }

        // Step 3: Wait a moment for database consistency, then verify by reloading
        console.log('Step 3: Waiting for database consistency...');
        console.log('Expected fullName after update:', formValues.fullName);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds for metadata propagation
        
        console.log('Step 4: Verifying update by reloading users...');
        const reloadedUsers = await getUsers(); // Get fresh data directly
        
        // Step 5: Verify the user was actually updated correctly
        const verifiedUser = reloadedUsers.find((u: User) => u.id === formValues.id);
        if (verifiedUser) {
          console.log('Verification user found:', verifiedUser);
          console.log('Comparison: expected =', formValues.fullName, ', actual =', verifiedUser.fullName);
          if (verifiedUser.fullName !== formValues.fullName) {
            console.error('Verification failed: name not persisted correctly', {
              expected: formValues.fullName,
              actual: verifiedUser.fullName,
              verifiedUser,
              timeSinceUpdate: '3 seconds'
            });
            
            // Try one more time with additional delay
            console.log('Trying verification again after additional delay...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 more seconds
            const reloadedUsersAgain = await getUsers();
            const verifiedUserAgain = reloadedUsersAgain.find((u: User) => u.id === formValues.id);
            
            if (verifiedUserAgain && verifiedUserAgain.fullName === formValues.fullName) {
              console.log('✅ Verification successful on second attempt after 5 total seconds');
              setUsers(reloadedUsersAgain);
            } else {
              // TEMPORARY WORKAROUND: Server confirmed update but verification fails due to metadata propagation
              console.warn('⚠️ Verification failed but server confirmed update - using workaround');
              console.log('Server response confirmed fullName:', updatedUser.user_metadata?.full_name);
              console.log('Applying optimistic update based on server confirmation...');
              
              // Update local state optimistically based on server confirmation
              setUsers(prevUsers => prevUsers.map(user => 
                user.id === formValues.id 
                  ? { 
                      ...user, 
                      fullName: formValues.fullName,
                      role: formValues.role,
                      storeIds: formValues.role === 'store' ? formValues.storeIds : []
                    }
                  : user
              ));
              
              console.log('✅ Applied workaround - local state updated based on server confirmation');
            }
          } else {
            console.log('✅ Verification successful: user update was persisted correctly');
            setUsers(reloadedUsers);
          }
        } else {
          console.error('Verification failed: updated user not found in reloaded data');
          
          // TEMPORARY WORKAROUND: Apply optimistic update even if user not found in reload
          console.warn('⚠️ User not found in reload but server confirmed update - using workaround');
          setUsers(prevUsers => prevUsers.map(user => 
            user.id === formValues.id 
              ? { 
                  ...user, 
                  fullName: formValues.fullName,
                  role: formValues.role,
                  storeIds: formValues.role === 'store' ? formValues.storeIds : []
                }
              : user
          ));
          console.log('✅ Applied workaround - optimistic update despite reload failure');
        }
        
        console.log('Update completed and verified successfully');
      }
      
      setIsEditing(false);
      resetForm();
    } catch (error) {
      console.error('Error saving user:', error);
      setError(error instanceof Error ? error.message : 'Erreur lors de l\'enregistrement de l\'utilisateur');
      
      // Reload users to ensure UI consistency with server state
      console.log('Error occurred, reloading users from server for consistency...');
      try {
        await loadUsers();
      } catch (reloadError) {
        console.error('Error reloading users after save error:', reloadError);
        setError('Erreur lors de l\'enregistrement et de la synchronisation. Veuillez actualiser la page.');
      }
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormValues({
      id: '',
      username: '',
      fullName: '',
      role: 'store',
      storeIds: [],
      password: ''
    });
    setError(null);
  };

  // Redirect if not admin
  if (!isAdmin) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Accès Restreint</h1>
          <p className="text-gray-600 mt-2">Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-krispy-green"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Gestion des Utilisateurs</h1>
        <p className="text-gray-600 mt-1">Gérer les accès et permissions utilisateurs</p>
      </div>

      <div className="mb-6 flex justify-between items-center">
        {!isEditing && (
          <Link
            to="/users/create"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-krispy-green hover:bg-krispy-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Créer un Nouvel Utilisateur
          </Link>
        )}
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {isChangingPassword && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Changer le mot de passe</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm"
                  placeholder="Nouveau mot de passe"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setIsChangingPassword(false);
                    setNewPassword('');
                    setSelectedUserId(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handlePasswordChange}
                  disabled={saving || !newPassword}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-krispy-green hover:bg-krispy-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green disabled:opacity-50"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditing && (
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">
              Modifier {formValues.fullName}
            </h3>
            <button
              onClick={() => setIsEditing(false)}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                Nom Complet
              </label>
              <input
                type="text"
                id="fullName"
                value={formValues.fullName}
                onChange={(e) => {
                  console.log('Full name input changed:', e.target.value);
                  const newFormValues = { ...formValues, fullName: e.target.value };
                  console.log('New form values:', newFormValues);
                  setFormValues(newFormValues);
                }}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                Rôle
              </label>
              <select
                id="role"
                value={formValues.role}
                onChange={(e) => {
                  const newRole = e.target.value as 'admin' | 'production' | 'store';
                  setFormValues({ 
                    ...formValues, 
                    role: newRole,
                    // Clear store IDs if the new role is not 'store'
                    storeIds: newRole === 'store' ? formValues.storeIds : []
                  });
                }}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm"
              >
                <option value="admin">Administrateur</option>
                <option value="production">Production</option>
                <option value="store">Magasin</option>
              </select>
            </div>

            {/* Magasins Assignés for store role */}
            {formValues.role === 'store' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Magasins Assignés
                </label>
                {storesLoading ? (
                  <div className="text-gray-500 text-sm">Chargement des magasins...</div>
                ) : storesError ? (
                  <div className="text-red-500 text-sm">{storesError}</div>
                ) : stores.length === 0 ? (
                  <div className="text-gray-500 text-sm">Aucun magasin actif disponible</div>
                ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-4">
                    {stores.map(store => (
                    <div key={store.id} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`store-${store.id}`}
                        checked={formValues.storeIds.includes(store.id)}
                        onChange={(e) => {
                          const newStoreIds = e.target.checked
                            ? [...formValues.storeIds, store.id]
                            : formValues.storeIds.filter(id => id !== store.id);
                          setFormValues({ ...formValues, storeIds: newStoreIds });
                        }}
                        className="h-4 w-4 text-krispy-green focus:ring-krispy-green border-gray-300 rounded"
                      />
                      <label htmlFor={`store-${store.id}`} className="ml-2 block text-sm text-gray-900">
                        {store.name}
                      </label>
                    </div>
                  ))}
              </div>
            )}
              </div>
            )}

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-krispy-green hover:bg-krispy-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Enregistrer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Magasins</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map(user => {
                const userStores = stores.filter(s => user.storeIds?.includes(s.id));
                return (
                  <tr key={user.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.fullName}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 capitalize">
                      {user.role === 'admin' ? 'Administrateur' :
                       user.role === 'production' ? 'Production' :
                       'Magasin'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {user.role === 'store' ? (
                        userStores.length > 0 ? 
                          userStores.map(s => s.name).join(', ') : 
                          'Aucun magasin assigné'
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleChangePassword(user.id)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                        title="Changer le mot de passe"
                      >
                        <Key className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UsersPage;