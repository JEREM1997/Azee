import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { productionService } from '../services/productionService';
import { ProductionPlan, StorePlan } from '../types';
import { Calendar, Check, AlertTriangle, TrendingUp, FileText, Truck, X, Store } from 'lucide-react';

const DashboardPage: React.FC = () => {
  const { user, isAdmin, isProduction } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [currentPlan, setCurrentPlan] = useState<ProductionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadPlan = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const plan = await productionService.getProductionPlan(selectedDate);
        
        // Set the plan directly since it already matches our TypeScript interface
        setCurrentPlan(plan);
      } catch (err) {
        console.error('Error in loadPlan:', err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    loadPlan();
  }, [selectedDate]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (store: StorePlan) => {
    if (store.delivery_confirmed && store.waste_reported) {
      return 'bg-green-100 text-green-800'; // Completed
    } else if (store.delivery_confirmed) {
      return 'bg-yellow-100 text-yellow-800'; // Partially completed
    } else if (store.confirmed) {
      return 'bg-blue-100 text-blue-800'; // Confirmed
    } else {
      return 'bg-gray-100 text-gray-800'; // Pending
    }
  };

  const getStatusText = (store: StorePlan) => {
    if (store.delivery_confirmed && store.waste_reported) {
      return 'Complété';
    } else if (store.delivery_confirmed) {
      return 'Livraison confirmée';
    } else if (store.confirmed) {
      return 'Production confirmée';
    } else {
      return 'En attente';
    }
  };

  const getStatusIcon = (store: StorePlan) => {
    if (store.delivery_confirmed && store.waste_reported) {
      return <Check className="h-4 w-4 mr-1" />;
    } else if (store.delivery_confirmed) {
      return <Truck className="h-4 w-4 mr-1" />;
    } else if (store.confirmed) {
      return <FileText className="h-4 w-4 mr-1" />;
    } else {
      return <AlertTriangle className="h-4 w-4 mr-1" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-krispy-green"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tableau de Bord</h1>
          <p className="text-gray-600 mt-1">Bienvenue, <span className="font-semibold">{user?.fullName}</span> !</p>
        </div>
        
        <div className="mt-4 md:mt-0">
          <div className="flex items-center space-x-2">
            <label htmlFor="date-selector" className="text-sm font-medium text-gray-700">
              Sélectionner une date:
            </label>
            <input
              id="date-selector"
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="shadow-sm focus:ring-krispy-green focus:border-krispy-green block sm:text-sm border-gray-300 rounded-md"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-8 bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-krispy-green" />
            Production du {formatDate(selectedDate)}
          </h2>
        </div>
        <div className="p-6">
          {currentPlan ? (
            <div>
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-medium text-gray-900">
                    Production totale: <span className="font-bold">{currentPlan.total_production}</span> doughnuts
                  </p>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Magasin
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantité
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Livraison
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Déchets
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentPlan.stores && currentPlan.stores.map((store) => {
                      // Calculate completion metrics
                      const totalItems = store.production_items?.length || 0;
                      const receivedItems = store.production_items?.filter(item => item.received !== null).length || 0;
                      const wasteItems = store.production_items?.filter(item => item.waste !== null).length || 0;
                      
                      const receivedPercentage = totalItems > 0 ? Math.round((receivedItems / totalItems) * 100) : 0;
                      const wastePercentage = totalItems > 0 ? Math.round((wasteItems / totalItems) * 100) : 0;
                      
                      return (
                        <tr key={store.store_id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{store.store_name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{store.total_quantity} doughnuts</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {store.delivery_confirmed ? (
                              <div className="flex items-center">
                                <Check className="h-5 w-5 text-green-500 mr-1.5" />
                                <span className="text-sm text-gray-900">Confirmée ({receivedPercentage}%)</span>
                              </div>
                            ) : (
                              <div className="flex items-center">
                                <X className="h-5 w-5 text-gray-400 mr-1.5" />
                                <span className="text-sm text-gray-500">En attente</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {store.waste_reported ? (
                              <div className="flex items-center">
                                <Check className="h-5 w-5 text-green-500 mr-1.5" />
                                <span className="text-sm text-gray-900">Reportés ({wastePercentage}%)</span>
                              </div>
                            ) : (
                              <div className="flex items-center">
                                <X className="h-5 w-5 text-gray-400 mr-1.5" />
                                <span className="text-sm text-gray-500">Non reportés</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(store)}`}>
                              {getStatusIcon(store)}
                              {getStatusText(store)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">Aucun plan de production trouvé pour cette date.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;