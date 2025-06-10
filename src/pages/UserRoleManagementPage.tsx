import React, { useState, useEffect } from 'react';
import { Users, Shield, Edit, Save, X, AlertTriangle, Check, History } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUsersWithRoles, updateUserRole, getUserRoleHistory } from '../services/userRoleService';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'production' | 'store';
  storeIds: string[];
  lastUpdated?: string;
  updatedBy?: string;
}

interface RoleHistory {
  id: string;
  userId: string;
  oldRole: string;
  newRole: string;
  changedBy: string;
  changedAt: string;
  reason?: string;
}

const UserRoleManagementPage: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<'admin' | 'production' | 'store'>('store');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [roleHistory, setRoleHistory] = useState<RoleHistory[]>([]);
  const [changeReason, setChangeReason] = useState('');

  // Redirection si pas admin
  useEffect(() => {
    if (!isAdmin) {
      window.location.href = '/';
    }
  }, [isAdmin]);

  // Chargement des utilisateurs
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const usersData = await getUsersWithRoles();
      setUsers(usersData);
    } catch (err) {
      console.error('Erreur lors du chargement des utilisateurs:', err);
      setError('Impossible de charger la liste des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  const loadRoleHistory = async (userId: string) => {
    try {
      const history = await getUserRoleHistory(userId);
      setRoleHistory(history);
      setShowHistory(true);
    } catch (err) {
      console.error('Erreur lors du chargement de l\'historique:', err);
      setError('Impossible de charger l\'historique des rôles');
    }
  };

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setChangeReason('');
    setError(null);
    setSuccess(null);
  };

  const handleRoleChange = () => {
    if (!selectedUser || !changeReason.trim()) {
      setError('Veuillez sélectionner un utilisateur et fournir une raison pour le changement');
      return;
    }

    if (selectedUser.role === newRole) {
      setError('Le nouveau rôle doit être différent du rôle actuel');
      return;
    }

    setShowConfirmDialog(true);
  };

  const confirmRoleChange = async () => {
    if (!selectedUser || !currentUser) return;

    try {
      setSaving(true);
      setError(null);
      setShowConfirmDialog(false);

      await updateUserRole(selectedUser.id, newRole, changeReason, currentUser.id);
      
      setSuccess(`Rôle de ${selectedUser.fullName} mis à jour avec succès`);
      setSelectedUser(null);
      setChangeReason('');
      
      // Recharger la liste des utilisateurs
      await loadUsers();
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err) {
      console.error('Erreur lors de la mise à jour du rôle:', err);
      setError('Impossible de mettre à jour le rôle utilisateur');
    } finally {
      setSaving(false);
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrateur';
      case 'production': return 'Production';
      case 'store': return 'Magasin';
      default: return role;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'production': return 'bg-blue-100 text-blue-800';
      case 'store': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isAdmin) {
    return null;
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
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Shield className="h-8 w-8 mr-3 text-krispy-green" />
          Gestion des Rôles Utilisateurs
        </h1>
        <p className="text-gray-600 mt-2">
          Interface sécurisée pour la gestion des rôles et permissions utilisateurs
        </p>
      </div>

      {/* Messages d'erreur et de succès */}
      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4">
          <div className="flex">
            <Check className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Liste des utilisateurs */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <Users className="h-5 w-5 mr-2 text-krispy-green" />
              Liste des Utilisateurs
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {users.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleUserSelect(user)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedUser?.id === user.id
                      ? 'border-krispy-green bg-krispy-green bg-opacity-5'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{user.fullName}</h3>
                      <p className="text-sm text-gray-500">{user.email}</p>
                      {user.lastUpdated && (
                        <p className="text-xs text-gray-400 mt-1">
                          Modifié le {new Date(user.lastUpdated).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                        {getRoleDisplayName(user.role)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          loadRoleHistory(user.id);
                        }}
                        className="text-xs text-krispy-green hover:text-krispy-green-dark flex items-center"
                      >
                        <History className="h-3 w-3 mr-1" />
                        Historique
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panneau de modification */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <Edit className="h-5 w-5 mr-2 text-krispy-green" />
              Modification du Rôle
            </h2>
          </div>
          <div className="p-6">
            {selectedUser ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{selectedUser.fullName}</h3>
                  <p className="text-sm text-gray-500">{selectedUser.email}</p>
                  <p className="text-sm text-gray-600 mt-2">
                    Rôle actuel: <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(selectedUser.role)}`}>
                      {getRoleDisplayName(selectedUser.role)}
                    </span>
                  </p>
                </div>

                <div>
                  <label htmlFor="newRole" className="block text-sm font-medium text-gray-700 mb-2">
                    Nouveau Rôle
                  </label>
                  <select
                    id="newRole"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as 'admin' | 'production' | 'store')}
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green"
                  >
                    <option value="admin">Administrateur</option>
                    <option value="production">Production</option>
                    <option value="store">Magasin</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                    Raison du Changement *
                  </label>
                  <textarea
                    id="reason"
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    rows={3}
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green"
                    placeholder="Expliquez pourquoi ce changement de rôle est nécessaire..."
                    required
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={handleRoleChange}
                    disabled={saving || selectedUser.role === newRole || !changeReason.trim()}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-krispy-green hover:bg-krispy-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Modifier le Rôle
                  </button>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun utilisateur sélectionné</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Sélectionnez un utilisateur dans la liste pour modifier son rôle
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialog de confirmation */}
      {showConfirmDialog && selectedUser && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirmer le Changement de Rôle</h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Vous êtes sur le point de changer le rôle de <strong>{selectedUser.fullName}</strong> de{' '}
                <span className="font-medium">{getRoleDisplayName(selectedUser.role)}</span> vers{' '}
                <span className="font-medium">{getRoleDisplayName(newRole)}</span>.
              </p>
              <p className="text-sm text-gray-600 mt-2">
                <strong>Raison:</strong> {changeReason}
              </p>
            </div>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    Cette action sera enregistrée dans l'historique et ne peut pas être annulée.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={confirmRoleChange}
                disabled={saving}
                className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-krispy-green hover:bg-krispy-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Modification...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Confirmer
                  </>
                )}
              </button>
              <button
                onClick={() => setShowConfirmDialog(false)}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog d'historique */}
      {showHistory && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Historique des Rôles</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              {roleHistory.map((entry) => (
                <div key={entry.id} className="border-l-4 border-krispy-green pl-4 py-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {getRoleDisplayName(entry.oldRole)} → {getRoleDisplayName(entry.newRole)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Par {entry.changedBy} le {new Date(entry.changedAt).toLocaleString('fr-FR')}
                      </p>
                      {entry.reason && (
                        <p className="text-xs text-gray-600 mt-1">Raison: {entry.reason}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {roleHistory.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  Aucun historique de changement de rôle disponible
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserRoleManagementPage;