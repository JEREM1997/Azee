import React, { useState, useEffect } from 'react';
import { Plus, Minus, Save, AlertTriangle } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { savePlan, getCurrentDayPlan } from '../services/productionService';
import { useAuth } from '../context/AuthContext';

const ProductionPage: React.FC = () => {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [storeProductions, setStoreProductions] = useState<{
    [storeId: string]: {
      [varietyId: string]: number;
    };
  }>({});
  const [storeBoxes, setStoreBoxes] = useState<{
    [storeId: string]: {
      [boxId: string]: number;
    };
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingPlanId, setExistingPlanId] = useState<string | null>(null);

  const { stores, varieties, boxes, forms } = useAdmin();
  const { currentUser } = useAuth();

  // Determine permissions
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'production');
  const isStoreManager = currentUser && currentUser.role === 'store';
  const assignedStoreIds = isStoreManager ? (currentUser.storeIds || []) : [];

  // Filter stores based on role
  const visibleStores = canEdit
    ? stores.filter(store => store.isActive)
    : stores.filter(store => store.isActive && assignedStoreIds.includes(store.id));

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
          const newStoreBoxes: typeof storeBoxes = {};
          
          // Add null check and ensure stores is an array before iterating
          if (plan.stores && Array.isArray(plan.stores)) {
            plan.stores.forEach((store: any) => {
              if (store && store.store_id) {
                // Handle variety productions - fix field mapping
                if (store.production_items && Array.isArray(store.production_items)) {
                  newStoreProductions[store.store_id] = store.production_items.reduce((acc: any, item: any) => ({
                  ...acc,
                  [item.variety_id]: item.quantity
                }), {});
                }
                
                // Handle box productions - fix field mapping
                if (store.box_productions && Array.isArray(store.box_productions)) {
                  newStoreBoxes[store.store_id] = store.box_productions.reduce((acc: any, box: any) => ({
                    ...acc,
                    [box.box_id]: box.quantity
                  }), {});
                }
              }
            });
          }

          setStoreProductions(newStoreProductions);
          setStoreBoxes(newStoreBoxes);
        } else {
          // Initialize empty store productions and boxes if no plan exists
          initializeStoreProductions();
          initializeStoreBoxes();
        }
      } catch (err) {
        console.error('Error loading plan:', err);
        setError(err instanceof Error ? err.message : 'Error loading plan');
        initializeStoreProductions();
        initializeStoreBoxes();
      } finally {
        setLoading(false);
      }
    };

    loadPlan();
  }, [date, stores, varieties, boxes, forms]);

  const initializeStoreProductions = () => {
    const initialProductions: typeof storeProductions = {};
    
    stores.filter((store: any) => store.isActive).forEach((store: any) => {
      initialProductions[store.id] = store.availableVarieties.reduce((acc: { [key: string]: number }, varietyId: string) => {
        const variety = varieties.find((v: any) => v.id === varietyId);
        if (variety?.isActive) {
          acc[varietyId] = 0;
        }
        return acc;
      }, {} as { [key: string]: number });
    });
    
    setStoreProductions(initialProductions);
  };

  const initializeStoreBoxes = () => {
    const initialBoxes: typeof storeBoxes = {};
    
    stores.filter((store: any) => store.isActive).forEach((store: any) => {
      initialBoxes[store.id] = store.availableBoxes.reduce((acc: { [key: string]: number }, boxId: string) => {
        const box = boxes.find((b: any) => b.id === boxId);
        if (box?.isActive) {
          acc[boxId] = 0;
        }
        return acc;
      }, {} as { [key: string]: number });
    });
    
    setStoreBoxes(initialBoxes);
  };

  const calculateTotals = () => {
    const storeTotals: { [storeId: string]: number } = {};
    let grandTotal = 0;
    
    // Calculate totals for individual doughnuts
    Object.entries(storeProductions).forEach(([storeId, storeData]) => {
      storeTotals[storeId] = 0;
      
      Object.values(storeData).forEach(quantity => {
        storeTotals[storeId] += quantity;
        grandTotal += quantity;
      });
    });

    // Add box quantities to totals
    Object.entries(storeBoxes).forEach(([storeId, boxData]) => {
      if (!storeTotals[storeId]) {
        storeTotals[storeId] = 0;
      }
      
      Object.entries(boxData).forEach(([boxId, quantity]) => {
        const box = boxes.find(b => b.id === boxId);
        if (box) {
          const boxDoughnuts = box.size * quantity;
          storeTotals[storeId] += boxDoughnuts;
          grandTotal += boxDoughnuts;
        }
      });
    });
    
    return {
      storeTotals,
      grandTotal
    };
  };

  const calculateSummary = () => {
    const varietyTotals: { [varietyId: string]: number } = {};
    const formTotals: { [formId: string]: number } = {};
    let totalDoughnuts = 0;
    let totalBoxDoughnuts = 0;
    let totalIndividualDoughnuts = 0;

    // Calculate individual variety totals
    Object.values(storeProductions).forEach((storeData) => {
      Object.entries(storeData).forEach(([varietyId, quantity]) => {
        varietyTotals[varietyId] = (varietyTotals[varietyId] || 0) + quantity;
        totalIndividualDoughnuts += quantity;

        // Add to form totals
        const variety = varieties.find(v => v.id === varietyId);
        if (variety && variety.formId) {
          formTotals[variety.formId] = (formTotals[variety.formId] || 0) + quantity;
        }
      });
    });

    // Calculate box totals
    Object.values(storeBoxes).forEach((storeBoxData) => {
      Object.entries(storeBoxData).forEach(([boxId, quantity]) => {
        const box = boxes.find(b => b.id === boxId);
        if (box) {
          totalBoxDoughnuts += box.size * quantity;
        }
      });
    });

    totalDoughnuts = totalIndividualDoughnuts + totalBoxDoughnuts;

    return {
      varietyTotals,
      formTotals,
      totalDoughnuts,
      totalBoxDoughnuts,
      totalIndividualDoughnuts
    };
  };

  const totals = calculateTotals();
  const summary = calculateSummary();
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
        userId: currentUser.id,
        existingPlanId,
        stores: stores.filter(store => store.isActive).map(store => {
          const storeData = storeProductions[store.id] || {};
          const storeBoxData = storeBoxes[store.id] || {};
          const items = [];
          const boxItems = [];

          // Add variety items
          for (const [varietyId, quantity] of Object.entries(storeData)) {
            if (quantity > 0) {
              const variety = varieties.find(v => v.id === varietyId);
              if (variety) {
                const form = variety.formId ? varieties.find(v => v.id === variety.formId) : null;
                items.push({
                  varietyId,
                  varietyName: variety.name,
                  formId: variety.formId || '',
                  formName: form?.name || 'Standard',
                  quantity
                });
              }
            }
          }

          // Add box items
          for (const [boxId, quantity] of Object.entries(storeBoxData)) {
            if (quantity > 0) {
              const box = boxes.find(b => b.id === boxId);
              if (box) {
                boxItems.push({
                  boxId,
                  boxName: box.name,
                  quantity
                });
              }
            }
          }

          return {
            storeId: store.id,
            storeName: store.name,
            totalQuantity: totals.storeTotals[store.id] || 0,
            items,
            boxes: boxItems
          };
        }).filter(store => store.totalQuantity > 0 || (store.boxes && store.boxes.length > 0))
      };

      console.log('Saving plan data:', planData); // Debug log
      const savedPlanId = await savePlan(planData);
      if (savedPlanId) {
        setExistingPlanId(savedPlanId);
        
        // Dispatch event to notify Plans page to refresh
        window.dispatchEvent(new CustomEvent('planSaved'));
        
        // Show success message with link to Plans page
        if (window.confirm('Plan de production enregistré avec succès !\n\nVoulez-vous voir tous les plans sauvegardés ?')) {
          window.location.href = '/plans';
        }
      } else {
        throw new Error('No plan ID returned from save operation');
      }
    } catch (error) {
      console.error('Error saving production plan:', error);
      setError(error instanceof Error ? error.message : 'Erreur lors de l\'enregistrement du plan de production');
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
          
          {canEdit && (
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
          </div>
          )}
        </div>
      </div>

      {/* Production Summary Section */}
      <div className="mb-8 bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Résumé de la Production</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Doughnuts Card */}
            <div className="bg-krispy-green bg-opacity-10 rounded-lg p-4">
              <h3 className="text-lg font-medium text-krispy-green mb-2">Total Doughnuts</h3>
              <p className="text-3xl font-bold text-krispy-green">{summary.totalDoughnuts}</p>
              <div className="mt-2 text-sm text-gray-600">
                <p>Individuels: {summary.totalIndividualDoughnuts}</p>
                <p>En Boîtes: {summary.totalBoxDoughnuts}</p>
              </div>
            </div>

            {/* Main Varieties Card */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-800 mb-2">Variétés Principales</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {varieties
                  .filter(v => v.isActive)
                  .map(variety => {
                    const total = summary.varietyTotals[variety.id] || 0;
                    if (total === 0) return null;
                    return (
                      <div key={variety.id} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{variety.name}</span>
                        <span className="text-sm font-medium text-gray-900">{total}</span>
                      </div>
                    );
                  })
                  .filter(Boolean)}
              </div>
            </div>

            {/* Store Summary Card */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-800 mb-2">Par Magasin</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {stores
                  .filter(store => store.isActive)
                  .map(store => {
                    const storeTotal = totals.storeTotals[store.id] || 0;
                    if (storeTotal === 0) return null;
                    return (
                      <div key={store.id} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{store.name}</span>
                        <span className="text-sm font-medium text-gray-900">{storeTotal}</span>
                      </div>
                    );
                  })
                  .filter(Boolean)}
              </div>
            </div>

            {/* Forms with Reserve Card */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-lg font-medium text-blue-800 mb-2">Par Forme (avec 5% de réserve)</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {forms
                  .filter(f => f.isActive)
                  .map(form => {
                    const baseTotal = summary.formTotals[form.id] || 0;
                    if (baseTotal === 0) return null;
                    const totalWithReserve = Math.ceil(baseTotal * 1.05);
                    return (
                      <div key={form.id} className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">{form.name}</span>
                          <span className="text-sm font-medium text-blue-900">{totalWithReserve}</span>
                        </div>
                        <div className="text-xs text-gray-500 pl-2">
                          Base: {baseTotal} + Réserve: {totalWithReserve - baseTotal}
                        </div>
                      </div>
                    );
                  })
                  .filter(Boolean)}
              </div>
            </div>
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
        {visibleStores.map(store => (
          <div key={store.id} className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">{store.name}</h2>
              <span className="text-sm px-3 py-1 rounded-full bg-krispy-green bg-opacity-10 text-krispy-green">
                Total : {totals.storeTotals[store.id] || 0} doughnuts
              </span>
            </div>
            <div className="p-6">
              {/* Varieties Section */}
              <div className="mb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Variétés</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variété</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Forme</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {varieties
                      .filter(variety => 
                        variety.isActive && 
                        store.availableVarieties.includes(variety.id)
                      )
                        .map(variety => {
                          const form = variety.formId ? forms.find(f => f.id === variety.formId) : null;
                          return (
                        <tr key={variety.id}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {variety.name}
                          </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {form ? form.name : 'Non définie'}
                              </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                            <div className="flex items-center justify-center">
                                  {canEdit ? (
                                    <>
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
                                    </>
                                  ) : (
                                    <span>{storeProductions[store.id]?.[variety.id] || 0}</span>
                                  )}
                            </div>
                          </td>
                        </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Boxes Section */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Boîtes Disponibles</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Boîte</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Taille</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité de Boîtes</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité Totale</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {boxes
                        .filter(box => 
                          box.isActive && 
                          store.availableBoxes.includes(box.id)
                        )
                        .map(box => {
                          const boxCount = storeBoxes[store.id]?.[box.id] || 0;
                          const totalDoughnuts = boxCount * box.size;
                          return (
                            <tr key={box.id}>
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {box.name}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                                {box.size} doughnuts
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                                <div className="flex items-center justify-center">
                                  {canEdit ? (
                                    <>
                                      <button
                                        onClick={() => {
                                          const currentQuantity = storeBoxes[store.id]?.[box.id] || 0;
                                          setStoreBoxes(prev => ({
                                            ...prev,
                                            [store.id]: {
                                              ...prev[store.id],
                                              [box.id]: Math.max(0, currentQuantity - 1)
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
                                        value={boxCount}
                                        onChange={(e) => {
                                          const newQuantity = parseInt(e.target.value, 10) || 0;
                                          setStoreBoxes(prev => ({
                                            ...prev,
                                            [store.id]: {
                                              ...prev[store.id],
                                              [box.id]: newQuantity
                                            }
                                          }));
                                        }}
                                        className="mx-1 w-16 text-center border-gray-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm"
                                      />
                                      <button
                                        onClick={() => {
                                          const currentQuantity = storeBoxes[store.id]?.[box.id] || 0;
                                          setStoreBoxes(prev => ({
                                            ...prev,
                                            [store.id]: {
                                              ...prev[store.id],
                                              [box.id]: currentQuantity + 1
                                            }
                                          }));
                                        }}
                                        className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
                                      >
                                        <Plus className="h-4 w-4" />
                                      </button>
                                    </>
                                  ) : (
                                    <span>{boxCount}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                                {totalDoughnuts} doughnuts
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {canEdit && (
        <div className="mt-8 flex space-x-4 justify-end">
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
        </div>
      )}
    </div>
  );
};

export default ProductionPage;