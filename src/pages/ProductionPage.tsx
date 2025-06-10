import React, { useState, useEffect } from 'react';
import { Plus, Minus, Save, Check, AlertTriangle } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { savePlan, getCurrentDayPlan, validatePlan } from '../services/productionService';
import { useAuth } from '../context/AuthContext';

const ProductionPage: React.FC = () => {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [storeProductions, setStoreProductions] = useState<{
    [storeId: string]: {
      [varietyId: string]: number;
    };
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingPlanId, setExistingPlanId] = useState<string | null>(null);

  const { stores, varieties } = useAdmin();
  const { currentUser } = useAuth();

  useEffect(() => {
    const loadPlan = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const plan = await getCurrentDayPlan(date);
        
        if (plan) {
          setExistingPlanId(plan.id);
          
          // Convert plan data to storeProductions format
          const newStoreProductions: typeof storeProductions = {};
          
          // Add null check and ensure stores is an array before iterating
          if (plan.stores && Array.isArray(plan.stores)) {
            plan.stores.forEach(store => {
              if (store && store.store_id && store.items && Array.isArray(store.items)) {
                newStoreProductions[store.store_id] = store.items.reduce((acc, item) => ({
                  ...acc,
                  [item.variety_id]: item.quantity
                }), {});
              }
            });
          }

          setStoreProductions(newStoreProductions);
        } else {
          // Initialize empty store productions if no plan exists
          initializeStoreProductions();
        }
      } catch (err) {
        console.error('Error loading plan:', err);
        setError(err instanceof Error ? err.message : 'Error loading plan');
        initializeStoreProductions();
      } finally {
        setLoading(false);
      }
    };

    loadPlan();
  }, [date, stores, varieties]);

  const initializeStoreProductions = () => {
    const initialProductions: typeof storeProductions = {};
    
    stores.filter(store => store.isActive).forEach(store => {
      initialProductions[store.id] = store.availableVarieties.reduce((acc, varietyId) => {
        const variety = varieties.find(v => v.id === varietyId);
        if (variety?.isActive) {
          acc[varietyId] = 0;
        }
        return acc;
      }, {} as { [key: string]: number });
    });
    
    setStoreProductions(initialProductions);
  };

  const calculateTotals = () => {
    const storeTotals: { [storeId: string]: number } = {};
    let grandTotal = 0;
    
    Object.entries(storeProductions).forEach(([storeId, storeData]) => {
      storeTotals[storeId] = 0;
      
      Object.values(storeData).forEach(quantity => {
        storeTotals[storeId] += quantity;
        grandTotal += quantity;
      });
    });
    
    return {
      storeTotals,
      grandTotal
    };
  };

  const totals = calculateTotals();
  const isPlanValid = totals.grandTotal > 0;

  const handleSavePlan = async () => {
    try {
      setError(null);
      setSaving(true);

      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const planData = {
        date,
        totalProduction: totals.grandTotal,
        status: 'draft',
        existingPlanId,
        stores: stores.filter(store => store.isActive).map(store => {
          const storeData = storeProductions[store.id] || {};
          const items = [];

          for (const [varietyId, quantity] of Object.entries(storeData)) {
            if (quantity > 0) {
              const variety = varieties.find(v => v.id === varietyId);
              if (variety) {
                items.push({
                  varietyId,
                  varietyName: variety.name,
                  quantity
                });
              }
            }
          }

          return {
            storeId: store.id,
            storeName: store.name,
            totalQuantity: totals.storeTotals[store.id] || 0,
            items
          };
        }).filter(store => store.totalQuantity > 0)
      };

      await savePlan(planData);
      alert('Plan de production enregistré avec succès !');
    } catch (error) {
      console.error('Error saving production plan:', error);
      setError(error instanceof Error ? error.message : 'Erreur lors de l\'enregistrement du plan de production');
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    try {
      setError(null);
      setSaving(true);

      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      if (!existingPlanId) {
        throw new Error('Veuillez d\'abord sauvegarder le plan');
      }

      await validatePlan(existingPlanId);
      alert('Plan de production validé avec succès !');
    } catch (error) {
      console.error('Error validating production plan:', error);
      setError(error instanceof Error ? error.message : 'Erreur lors de la validation du plan de production');
    } finally {
      setSaving(false);
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
          <h1 className="text-3xl font-bold text-gray-900">Plan de Production</h1>
          <p className="text-gray-600 mt-1">Créer et gérer le plan de production</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex items-center space-x-4">
          <div className="w-full md:w-auto">
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
              Date de Production
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="shadow-sm focus:ring-krispy-green focus:border-krispy-green block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
          
          <div className="flex space-x-4 items-end">
            <button
              onClick={handleSavePlan}
              disabled={!isPlanValid || saving}
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
                  {existingPlanId ? 'Mettre à jour' : 'Enregistrer'}
                </>
              )}
            </button>

            {existingPlanId && (
              <button
                onClick={handleValidate}
                disabled={saving || !isPlanValid}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-krispy-green hover:bg-krispy-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green disabled:opacity-50"
              >
                <Check className="h-4 w-4 mr-2" />
                Valider
              </button>
            )}
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

      <div className="space-y-8">
        {stores.filter(store => store.isActive).map(store => (
          <div key={store.id} className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">{store.name}</h2>
              <span className="text-sm px-3 py-1 rounded-full bg-krispy-green bg-opacity-10 text-krispy-green">
                Total : {totals.storeTotals[store.id] || 0} doughnuts
              </span>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variété</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {varieties
                      .filter(variety => 
                        variety.isActive && 
                        store.availableVarieties.includes(variety.id)
                      )
                      .map(variety => (
                        <tr key={variety.id}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {variety.name}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                            <div className="flex items-center justify-center">
                              <button
                                onClick={() => {
                                  const currentQuantity = storeProductions[store.id]?.[variety.id] || 0;
                                  setStoreProductions(prev => ({
                                    ...prev,
                                    [store.id]: {
                                      ...prev[store.id],
                                      [variety.id]: Math.max(0, currentQuantity - 12)
                                    }
                                  }));
                                }}
                                className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={storeProductions[store.id]?.[variety.id] || 0}
                                onChange={(e) => {
                                  const newQuantity = parseInt(e.target.value, 10) || 0;
                                  setStoreProductions(prev => ({
                                    ...prev,
                                    [store.id]: {
                                      ...prev[store.id],
                                      [variety.id]: newQuantity
                                    }
                                  }));
                                }}
                                className="mx-1 w-16 text-center border-gray-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm"
                              />
                              <button
                                onClick={() => {
                                  const currentQuantity = storeProductions[store.id]?.[variety.id] || 0;
                                  setStoreProductions(prev => ({
                                    ...prev,
                                    [store.id]: {
                                      ...prev[store.id],
                                      [variety.id]: currentQuantity + 12
                                    }
                                  }));
                                }}
                                className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductionPage;