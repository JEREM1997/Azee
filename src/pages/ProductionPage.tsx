import React, { useState, useEffect } from 'react';
import { Plus, Minus, Save, AlertTriangle, Edit } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { savePlan, getCurrentDayPlan } from '../services/productionService';
import { useAuth } from '../context/AuthContext';

const ProductionPage: React.FC = () => {
  // Get date from URL params or use today's date
  const urlParams = new URLSearchParams(window.location.search);
  const urlDate = urlParams.get('date');
  const [date, setDate] = useState<string>(urlDate || new Date().toISOString().split('T')[0]);
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
  const [storeDeliveryDates, setStoreDeliveryDates] = useState<{
    [storeId: string]: string;
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
          const newStoreDeliveryDates: typeof storeDeliveryDates = {};
          
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

                // Handle delivery dates - only use manually set dates
                if (store.deliverydate) {
                  console.log(`Loading delivery date for store ${store.store_id}:`, store.deliverydate);
                  newStoreDeliveryDates[store.store_id] = store.deliverydate;
                }
              }
            });
          }

          setStoreProductions(newStoreProductions);
          setStoreBoxes(newStoreBoxes);
          setStoreDeliveryDates(newStoreDeliveryDates);
        } else {
          // Initialize empty store productions and boxes if no plan exists
          initializeStoreProductions();
          initializeStoreBoxes();
          // No delivery date initialization - must be set manually
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
    const boxTotals: { [boxId: string]: number } = {};
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

    // Calculate box totals and add box varieties to variety and form totals
    Object.values(storeBoxes).forEach((storeBoxData) => {
      Object.entries(storeBoxData).forEach(([boxId, boxQuantity]) => {
        const box = boxes.find(b => b.id === boxId);
        if (box && boxQuantity > 0) {
          boxTotals[boxId] = (boxTotals[boxId] || 0) + boxQuantity;
          totalBoxDoughnuts += box.size * boxQuantity;

          // Add varieties from boxes to variety and form totals
          if (box.varieties && box.varieties.length > 0) {
            box.varieties.forEach(boxVariety => {
              const variety = varieties.find(v => v.id === boxVariety.varietyId);
              if (variety) {
                // Calculate total quantity of this variety from all boxes
                const varietyQuantityFromBoxes = boxVariety.quantity * boxQuantity;
                varietyTotals[variety.id] = (varietyTotals[variety.id] || 0) + varietyQuantityFromBoxes;

                // Add to form totals
                if (variety.formId) {
                  formTotals[variety.formId] = (formTotals[variety.formId] || 0) + varietyQuantityFromBoxes;
                }
              }
            });
          }
        }
      });
    });

    totalDoughnuts = totalIndividualDoughnuts + totalBoxDoughnuts;

    return {
      varietyTotals,
      formTotals,
      boxTotals,
      totalDoughnuts,
      totalBoxDoughnuts,
      totalIndividualDoughnuts
    };
  };

  const totals = calculateTotals();
  const summary = calculateSummary();
  
  // Check if all stores have delivery dates set
  const areAllDeliveryDatesSet = () => {
    const activeStores = stores.filter((store: any) => store.isActive);
    return activeStores.every((store: any) => {
      const storeTotal = totals.storeTotals[store.id] || 0;
      // Only require delivery date if store has production
      if (storeTotal > 0) {
        return storeDeliveryDates[store.id] && storeDeliveryDates[store.id].trim() !== '';
      }
      return true; // No production = no delivery date required
    });
  };

  // Get stores that need delivery dates
  const getStoresNeedingDeliveryDates = () => {
    return stores.filter((store: any) => {
      if (!store.isActive) return false;
      const storeTotal = totals.storeTotals[store.id] || 0;
      if (storeTotal === 0) return false; // No production = no delivery date needed
      return !storeDeliveryDates[store.id] || storeDeliveryDates[store.id].trim() === '';
    });
  };
  
  const isPlanValid = totals.grandTotal > 0;
  const allDeliveryDatesSet = areAllDeliveryDatesSet();
  const storesNeedingDates = getStoresNeedingDeliveryDates();

  const handleSavePlan = async () => {
    try {
      setError(null);
      setSaving(true);

      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Validate that all stores with production have delivery dates
      if (!allDeliveryDatesSet) {
        const storeNames = storesNeedingDates.map(store => store.name).join(', ');
        throw new Error(`Veuillez définir les dates de livraison pour: ${storeNames}`);
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
                const form = variety.formId ? forms.find(f => f.id === variety.formId) : null;
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
            deliveryDate: storeDeliveryDates[store.id], // No fallback - must be explicitly set
            totalQuantity: totals.storeTotals[store.id] || 0,
            items,
            boxes: boxItems
          };
        }).filter(store => store.totalQuantity > 0 || (store.boxes && store.boxes.length > 0))
      };

      console.log('Saving plan data:', planData); // Debug log
      console.log('Store delivery dates being saved:', storeDeliveryDates); // Debug delivery dates
      const savedPlanId = await savePlan(planData);
      if (savedPlanId) {
        setExistingPlanId(savedPlanId);
        
        // Dispatch event to notify Plans page to refresh
        window.dispatchEvent(new CustomEvent('planSaved'));
        
        // Show success message with link to Plans page
        const message = existingPlanId 
          ? 'Plan de production mis à jour avec succès !\n\nVoulez-vous voir tous les plans sauvegardés ?'
          : 'Plan de production enregistré avec succès !\n\nVoulez-vous voir tous les plans sauvegardés ?';
        
        if (window.confirm(message)) {
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
          <p className="text-gray-600 mt-1">
            {existingPlanId ? 'Modifier le plan de production existant' : 'Créer et gérer le plan de production'}
          </p>
          {existingPlanId && (
            <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              <Edit className="h-3 w-3 mr-1" />
              Plan existant en cours de modification
            </div>
          )}
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
              disabled={!isPlanValid || !allDeliveryDatesSet || saving}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-krispy-green hover:bg-krispy-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green disabled:opacity-50"
              title={!allDeliveryDatesSet ? `Dates de livraison manquantes pour: ${storesNeedingDates.map(s => s.name).join(', ')}` : ''}
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

      {/* Validation Messages */}
      {!allDeliveryDatesSet && totals.grandTotal > 0 && (
        <div className="mb-8 bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <span className="font-medium">Dates de livraison manquantes:</span> Veuillez définir les dates de livraison pour {storesNeedingDates.map(store => store.name).join(', ')} avant d'enregistrer le plan.
              </p>
            </div>
          </div>
        </div>
      )}

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

      {/* Production Summary Section */}
      {summary.totalDoughnuts > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Résumé de la Production</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Doughnuts Card */}
            <div className="bg-krispy-green bg-opacity-10 rounded-lg p-6">
              <h3 className="text-sm font-medium text-krispy-green mb-2">Total Doughnuts</h3>
              <p className="text-3xl font-bold text-krispy-green">{summary.totalDoughnuts}</p>
              <div className="mt-3 text-sm text-gray-600">
                <p>Individuels: {summary.totalIndividualDoughnuts}</p>
                <p className="font-medium">En Boîtes: {summary.totalBoxDoughnuts}</p>
                {Object.entries(summary.boxTotals).length > 0 && (
                  <div className="mt-2 space-y-1 max-h-20 overflow-y-auto">
                    {boxes
                      .filter(b => b.isActive && (summary.boxTotals[b.id] || 0) > 0)
                      .map(box => {
                        const boxCount = summary.boxTotals[box.id] || 0;
                        const totalDoughnuts = boxCount * box.size;
                        return (
                          <div key={box.id} className="text-xs text-gray-500">
                            {box.name}: {boxCount} boîtes ({totalDoughnuts} doughnuts)
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            {/* Main Varieties Card */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-800 mb-2">Variétés Principales</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {varieties
                  .filter(v => v.isActive && (summary.varietyTotals[v.id] || 0) > 0)
                  .map(variety => {
                    const total = summary.varietyTotals[variety.id] || 0;
                    const dozens = Math.floor(total / 12);
                    const units = total % 12;
                    return (
                      <div key={variety.id} className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">{variety.name}</span>
                          <span className="text-sm font-medium text-gray-900">{total}</span>
                        </div>
                        <div className="text-xs text-gray-500 pl-2">
                          {dozens > 0 && `${dozens} douzaine${dozens > 1 ? 's' : ''}`}
                          {dozens > 0 && units > 0 && ' + '}
                          {units > 0 && `${units} unité${units > 1 ? 's' : ''}`}
                          {dozens === 0 && units === 0 && '0 unité'}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Store Summary Card */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-800 mb-2">Par Magasin</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {visibleStores
                  .filter(store => (totals.storeTotals[store.id] || 0) > 0)
                  .map(store => (
                    <div key={store.id} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">{store.name}</span>
                      <span className="text-sm font-medium text-gray-900">{totals.storeTotals[store.id] || 0}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Forms with Reserve Card */}
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="text-sm font-medium text-blue-800 mb-2">Par Forme (avec 5% de réserve)</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {forms
                  .filter(f => f.isActive && (summary.formTotals[f.id] || 0) > 0)
                  .map(form => {
                    const baseTotal = summary.formTotals[form.id] || 0;
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
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {visibleStores.map(store => {
          const storeTotal = totals.storeTotals[store.id] || 0;
          const needsDeliveryDate = storeTotal > 0 && (!storeDeliveryDates[store.id] || storeDeliveryDates[store.id].trim() === '');
          
          return (
          <div key={store.id} className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">{store.name}</h2>
                  {canEdit && (
                    <div className="flex items-center space-x-4">
                      <div>
                        <label htmlFor={`delivery-date-${store.id}`} className={`block text-sm font-medium mb-1 ${needsDeliveryDate ? 'text-red-700' : 'text-gray-700'}`}>
                          Date de Livraison {needsDeliveryDate && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type="date"
                          id={`delivery-date-${store.id}`}
                          value={storeDeliveryDates[store.id] || ''}
                          onChange={(e) => {
                            setStoreDeliveryDates(prev => ({
                              ...prev,
                              [store.id]: e.target.value
                            }));
                          }}
                          className={`shadow-sm focus:ring-krispy-green focus:border-krispy-green block w-full sm:text-sm border-gray-300 rounded-md ${needsDeliveryDate ? 'border-red-300 bg-red-50' : ''}`}
                          required={storeTotal > 0}
                        />
                        {needsDeliveryDate && (
                          <p className="mt-1 text-xs text-red-600">Date de livraison requise pour ce magasin</p>
                        )}
                      </div>
                    </div>
                  )}
                  {!canEdit && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Date de Livraison:</span> {
                        storeDeliveryDates[store.id] ? 
                        new Date(storeDeliveryDates[store.id]).toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }) : 'Non définie'
                      }
                    </div>
                  )}
                </div>
                <div className="mt-4 md:mt-0">
              <span className="text-sm px-3 py-1 rounded-full bg-krispy-green bg-opacity-10 text-krispy-green">
                Total : {totals.storeTotals[store.id] || 0} doughnuts
              </span>
                </div>
              </div>
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
                                      [variety.id]: Math.max(0, currentQuantity - 1)
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
                                      [variety.id]: currentQuantity + 1
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
          );
        })}
      </div>
    </div>
  );
};

export default ProductionPage;