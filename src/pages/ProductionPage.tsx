import React, { useState, useEffect, useContext, useMemo } from 'react';
import { Plus, Minus, Save, AlertTriangle, Edit, Sparkles, Brain, TrendingUp, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';
import { useAuth } from '../context/AuthContext';
import { aiForecastService, AIForecastResult } from '../services/aiForecastService';
import { productionService } from '../services/productionService';
import { ProductionPlan, Store as StoreType, DonutVariety, BoxConfiguration } from '../types';

const ProductionPage: React.FC = () => {
  // Get date from URL params or use today's date
  const urlParams = new URLSearchParams(window.location.search);
  const urlDate = urlParams.get('date');

  // Timezone-safe date formatter (same logic as DeliveryPage)
  const formatDateSafe = (dateStr: string) => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };
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

  // AI Forecasting state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiForecasts, setAiForecasts] = useState<AIForecastResult[]>([]);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const { stores, varieties, boxes, forms } = useAdmin();
  const { user } = useAuth();

  // Determine permissions
  const canEdit = user && (user.role === 'admin' || user.role === 'production');
  const isStoreManager = user && user.role === 'store';
  const assignedStoreIds = isStoreManager ? (user.storeIds || []) : [];

  // Filter stores based on role
  const visibleStores = canEdit
    ? stores.filter(store => store.isActive)
    : stores.filter(store => store.isActive && assignedStoreIds.includes(store.id));

  console.log('🌐 URL DEBUG - Current URL:', window.location.href);
  console.log('🌐 URL DEBUG - URL search params:', window.location.search);
  console.log('🌐 URL DEBUG - URL date parameter:', urlDate);
  console.log('🌐 URL DEBUG - Today\'s date:', new Date().toISOString().split('T')[0]);
  console.log('🌐 URL DEBUG - Initial date state:', urlDate || new Date().toISOString().split('T')[0]);
  console.log('🌐 URL DEBUG - Date state after initialization:', date);

  useEffect(() => {
    const loadPlan = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('🔍 LOAD DEBUG - Loading plan for date:', date);
        console.log('🔍 LOAD DEBUG - Date type:', typeof date);
        console.log('🔍 LOAD DEBUG - Date length:', date?.length);
        
        const plan = await productionService.getProductionPlan(date);
        
        console.log('🔍 LOAD DEBUG - Received plan:', plan);
        console.log('🔍 LOAD DEBUG - Plan date in response:', plan?.date);
        console.log('🔍 LOAD DEBUG - Expected date was:', date);
        console.log('🔍 LOAD DEBUG - Dates match:', plan?.date === date);
        
        if (plan) {
          console.log('🔍 LOAD DEBUG - Plan found, setting existing plan ID:', plan.id);
          setExistingPlanId(plan.id);
          
          // Convert plan data to storeProductions format
          const newStoreProductions: typeof storeProductions = {};
          const newStoreBoxes: typeof storeBoxes = {};
          const newStoreDeliveryDates: typeof storeDeliveryDates = {};
          
          // Add null check and ensure stores is an array before iterating
          if (plan.stores && Array.isArray(plan.stores)) {
            plan.stores.forEach((store: any) => {
              if (store && store.store_id) {
                // Handle variety productions
                if (store.production_items && Array.isArray(store.production_items)) {
                  newStoreProductions[store.store_id] = store.production_items.reduce((acc: any, item: any) => ({
                    ...acc,
                    [item.variety_id]: item.quantity
                  }), {});
                }
                
                // Handle box productions
                if (store.box_productions && Array.isArray(store.box_productions)) {
                  newStoreBoxes[store.store_id] = store.box_productions.reduce((acc: any, box: any) => ({
                  ...acc,
                    [box.box_id]: box.quantity
                }), {});
                }

                // Handle delivery dates - check both camelCase and snake_case
                const deliveryDate = store.deliverydate;
                console.log(`🗓️ LOAD DEBUG - Store ${store.store_id} deliverydate from DB:`, deliveryDate);
                if (deliveryDate) {
                  console.log(`Loading delivery date for store ${store.store_id}:`, deliveryDate);
                  newStoreDeliveryDates[store.store_id] = deliveryDate;
                } else {
                  console.log(`⚠️ LOAD DEBUG - No delivery date found for store ${store.store_id}`);
                }
              }
            });
          }

          setStoreProductions(newStoreProductions);
          setStoreBoxes(newStoreBoxes);
          console.log('🗓️ LOAD DEBUG - Setting storeDeliveryDates to:', newStoreDeliveryDates);
          setStoreDeliveryDates(newStoreDeliveryDates);
        } else {
          console.log('🔍 LOAD DEBUG - No plan found for date:', date);
          // Initialize empty store productions and boxes if no plan exists
          initializeStoreProductions();
          initializeStoreBoxes();
          setExistingPlanId(null);
        }
      } catch (err) {
        console.error('Error loading plan:', err);
        const errorMessage = err instanceof Error ? err.message : 'Error loading plan';
        
        if (errorMessage.includes('Session expired')) {
          setError('Votre session a expiré. La page va se recharger dans quelques secondes...');
          // Reload the page after a short delay to get a fresh session
          setTimeout(() => window.location.reload(), 3000);
        } else if (errorMessage.includes('Authentication required')) {
          setError('Veuillez vous reconnecter pour continuer.');
          // Redirect to login page
          window.location.href = '/login';
        } else {
          setError(errorMessage);
          // Initialize empty state on error
          initializeStoreProductions();
          initializeStoreBoxes();
        }
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
    
    console.log('🚦 VALIDATION DEBUG - areAllDeliveryDatesSet called');
    console.log('🚦 VALIDATION DEBUG - activeStores count:', activeStores.length);
    console.log('🚦 VALIDATION DEBUG - storeDeliveryDates state:', storeDeliveryDates);
    console.log('🚦 VALIDATION DEBUG - loading state:', loading);
    console.log('🚦 VALIDATION DEBUG - storeTotals:', totals.storeTotals);
    
    const result = activeStores.every((store: any) => {
      const storeTotal = totals.storeTotals[store.id] || 0;
      // Only require delivery date if store has production
      if (storeTotal > 0) {
        const hasDeliveryDate = storeDeliveryDates[store.id] && storeDeliveryDates[store.id].trim() !== '';
        console.log(`🚦 VALIDATION DEBUG - Store ${store.name} (${store.id}): total=${storeTotal}, deliveryDate="${storeDeliveryDates[store.id]}", hasDeliveryDate=${hasDeliveryDate}`);
        return hasDeliveryDate;
      }
      console.log(`🚦 VALIDATION DEBUG - Store ${store.name} (${store.id}): total=${storeTotal}, skipping (no production)`);
      return true; // No production = no delivery date required
    });
    
    console.log('🚦 VALIDATION DEBUG - areAllDeliveryDatesSet result:', result);
    return result;
  };

  // Get stores that need delivery dates
  const getStoresNeedingDeliveryDates = () => {
    const storesNeeding = stores.filter((store: any) => {
      if (!store.isActive) return false;
      const storeTotal = totals.storeTotals[store.id] || 0;
      if (storeTotal === 0) return false; // No production = no delivery date needed
      const needsDate = !storeDeliveryDates[store.id] || storeDeliveryDates[store.id].trim() === '';
      console.log(`🚦 VALIDATION DEBUG - Store ${store.name} needs delivery date:`, needsDate);
      return needsDate;
    });
    
    console.log('🚦 VALIDATION DEBUG - getStoresNeedingDeliveryDates result:', storesNeeding.map(s => s.name));
    return storesNeeding;
  };
  
  const isPlanValid = totals.grandTotal > 0;
  const allDeliveryDatesSet = loading
    ? true          // skip validation while data still loading
    : areAllDeliveryDatesSet();
  const storesNeedingDates = loading ? [] : getStoresNeedingDeliveryDates();

  const handleSavePlan = async () => {
    try {
      setError(null);
      setSaving(true);

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Validate that all stores with production have delivery dates
      if (!allDeliveryDatesSet) {
        const storeNames = storesNeedingDates.map(store => store.name).join(', ');
        throw new Error(`Veuillez définir les dates de livraison pour: ${storeNames}`);
      }

      console.log('🗓️ SAVE DEBUG - Current date state:', date);
      console.log('🗓️ SAVE DEBUG - Date type:', typeof date);
      console.log('🗓️ SAVE DEBUG - Date length:', date?.length);
      console.log('🗓️ SAVE DEBUG - Date parsed as Date object:', new Date(date));
      console.log('🗓️ SAVE DEBUG - Date ISO string:', new Date(date).toISOString());
      console.log('🗓️ SAVE DEBUG - Date local string:', new Date(date).toLocaleDateString());

      const planData = {
        date,
        totalProduction: totals.grandTotal,
        status: 'draft',
        userId: user.id,
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

      console.log('🗓️ SAVE DEBUG - Final planData being sent:', planData);
      console.log('🗓️ SAVE DEBUG - planData.date:', planData.date);
      console.log('🗓️ SAVE DEBUG - planData structure:', JSON.stringify(planData, null, 2));

      console.log('Saving plan data:', planData); // Debug log
      console.log('Store delivery dates being saved:', storeDeliveryDates); // Debug delivery dates
      
      // Transform planData to match ProductionPlan interface
      const productionPlanData: ProductionPlan = {
        id: existingPlanId || '',
        date: planData.date,
        total_production: planData.totalProduction,
        status: 'draft',
        stores: planData.stores.map((store: { 
          storeId: string;
          storeName: string;
          deliveryDate?: string;
          totalQuantity: number;
          items: Array<{
            varietyId: string;
            varietyName: string;
            formId: string;
            formName: string;
            quantity: number;
          }>;
          boxes: Array<{
            boxId: string;
            boxName: string;
            quantity: number;
          }>;
        }) => ({
          store_id: store.storeId,
          store_name: store.storeName,
          delivery_date: store.deliveryDate,
          total_quantity: store.totalQuantity,
          production_items: store.items.map(item => ({
            variety_id: item.varietyId,
            variety_name: item.varietyName,
            form_id: item.formId,
            form_name: item.formName,
            quantity: item.quantity,
            received: undefined,
            waste: undefined
          })),
          box_productions: store.boxes.map(box => ({
            box_id: box.boxId,
            box_name: box.boxName,
            quantity: box.quantity,
            received: undefined,
            waste: undefined
          })),
          confirmed: false,
          delivery_confirmed: false,
          waste_reported: false
        }))
      };
      
      await productionService.saveProductionPlan(productionPlanData);
      
      console.log('🗓️ SAVE DEBUG - Expected date after save:', date);
      
      // Store the saved plan info in localStorage for immediate access by PlansPage
      const savedPlanInfo = {
        id: existingPlanId,
        date: date,
        timestamp: Date.now()
      };
      
      console.log('🗓️ SAVE DEBUG - Storing in localStorage:', savedPlanInfo);
      localStorage.setItem('recentlySavedPlan', JSON.stringify(savedPlanInfo));
      
      // Dispatch event to notify Plans page to refresh
      window.dispatchEvent(new CustomEvent('planSaved', { 
        detail: { planId: existingPlanId, date: date }
      }));
      
      console.log('🗓️ SAVE DEBUG - Dispatched planSaved event with date:', date);
      
      // Show success message with link to Plans page
      const successMessage = existingPlanId 
        ? 'Plan de production mis à jour avec succès !\n\nVoulez-vous voir tous les plans sauvegardés ?'
        : 'Plan de production enregistré avec succès !\n\nVoulez-vous voir tous les plans sauvegardés ?';
      
      if (window.confirm(successMessage)) {
        // Add a small delay to ensure event propagates before navigation
        setTimeout(() => {
          window.location.href = '/plans';
        }, 100);
      }
    } catch (error) {
      console.error('Error saving production plan:', error);
      setError(error instanceof Error ? error.message : 'Erreur lors de l\'enregistrement du plan de production');
    } finally {
      setSaving(false);
    }
  };

  // Reset every variety & box quantity to 0
  const resetAllQuantities = () => {
    const clearedProductions: typeof storeProductions = {};
    const clearedBoxes: typeof storeBoxes = {};

    stores.filter(s => s.isActive).forEach(store => {
      clearedProductions[store.id] = {};
      store.availableVarieties.forEach(varId => {
        clearedProductions[store.id][varId] = 0;
      });

      clearedBoxes[store.id] = {};
      store.availableBoxes.forEach(boxId => {
        clearedBoxes[store.id][boxId] = 0;
      });
    });

    setStoreProductions(clearedProductions);
    setStoreBoxes(clearedBoxes);
  };

  // AI Forecasting Functions
  const generateAIForecast = async () => {
    try {
      setAiLoading(true);
      setAiError(null);
      
      console.log('🤖 Generating AI forecast for date:', date);
      
      const activeStores = stores.filter((s: StoreType) => s.isActive);
      const activeVarieties = varieties.filter((v: DonutVariety) => v.isActive);
      const activeBoxes = boxes.filter((b: BoxConfiguration) => b.isActive);
      
      const forecasts = await aiForecastService.generateForecast(
        date,
        activeStores,
        activeVarieties,
        activeBoxes
      );
      
      setAiForecasts(forecasts);
      setShowAiModal(true);
      
      console.log('✅ AI forecast generated for', forecasts.length, 'stores');
    } catch (err) {
      console.error('❌ AI forecast error:', err);
      setAiError(err instanceof Error ? err.message : 'Erreur lors de la génération des prévisions IA');
    } finally {
      setAiLoading(false);
    }
  };

  const applyAIRecommendations = () => {
    if (aiForecasts.length === 0) return;

    const newStoreProductions: typeof storeProductions = {};
    const newStoreBoxes: typeof storeBoxes = {};

    // Apply AI recommendations to production quantities
    aiForecasts.forEach(forecast => {
      // Initialize store data if not exists
      if (!newStoreProductions[forecast.storeId]) {
        newStoreProductions[forecast.storeId] = {};
      }
      if (!newStoreBoxes[forecast.storeId]) {
        newStoreBoxes[forecast.storeId] = {};
      }

      // Apply variety predictions
      forecast.predictions.forEach(prediction => {
        newStoreProductions[forecast.storeId][prediction.varietyId] = prediction.recommendedProduction;
      });

      // Apply box predictions
      forecast.boxPredictions.forEach(boxPrediction => {
        newStoreBoxes[forecast.storeId][boxPrediction.boxId] = boxPrediction.recommendedProduction;
      });
    });

    // Merge with existing data to preserve any manual entries for stores not in AI forecast
    setStoreProductions(prev => ({ ...prev, ...newStoreProductions }));
    setStoreBoxes(prev => ({ ...prev, ...newStoreBoxes }));

    setShowAiModal(false);

    // Show success message
    const totalStores = aiForecasts.length;
    const totalProduction = aiForecasts.reduce((sum, f) => sum + f.totalRecommendedProduction, 0);
    const avgWaste = aiForecasts.reduce((sum, f) => sum + f.estimatedWastePercent, 0) / totalStores;

    alert(`🤖 Prévisions IA appliquées avec succès!\n\n` +
          `✅ ${totalStores} magasin${totalStores > 1 ? 's' : ''} configuré${totalStores > 1 ? 's' : ''}\n` +
          `📊 Production totale recommandée: ${totalProduction.toLocaleString()} doughnuts\n` +
          `♻️ Déchets estimés: ${avgWaste.toFixed(1)}% (objectif: <30%)\n\n` +
          `Les quantités ont été automatiquement remplies. Vous pouvez les ajuster manuellement si nécessaire.`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-krispy-green"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
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
              onChange={(e) => {
                console.log('📅 DATE INPUT DEBUG - Date changed from:', date, 'to:', e.target.value);
                console.log('📅 DATE INPUT DEBUG - Event target value type:', typeof e.target.value);
                console.log('📅 DATE INPUT DEBUG - Event target value length:', e.target.value?.length);
                setDate(e.target.value);
                console.log('📅 DATE INPUT DEBUG - State should now be:', e.target.value);
              }}
              className="shadow-sm focus:ring-krispy-green focus:border-krispy-green block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
          
          {canEdit && (
          <div className="flex space-x-4 items-end">
            <button
              onClick={generateAIForecast}
              disabled={aiLoading || saving}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Générer des prévisions IA basées sur l'historique des ventes"
            >
              {aiLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Analyse IA...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Prévisions IA
                </>
              )}
            </button>
            <button
              onClick={resetAllQuantities}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green disabled:opacity-50"
              title="Remettre toutes les quantités à zéro"
            >
              <Minus className="h-4 w-4 mr-2" />
              Tout à zéro
            </button>
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

      {aiError && (
        <div className="mb-8 bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                <span className="font-medium">Erreur IA:</span> {aiError}
              </p>
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
                        storeDeliveryDates[store.id]
                          ? formatDateSafe(storeDeliveryDates[store.id])
                          : 'Non définie'
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

      {/* AI Forecast Modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-purple-100">
                    <Brain className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Prévisions IA de Production
                    </h3>
                    <p className="text-sm text-gray-500">
                      Recommandations basées sur l'analyse de l'historique des ventes
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAiModal(false)}
                  className="bg-gray-200 hover:bg-gray-300 rounded-full p-2"
                >
                  <span className="sr-only">Fermer</span>
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {/* Summary Cards */}
              {aiForecasts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <Store className="h-5 w-5 text-purple-600 mr-2" />
                      <h4 className="font-medium text-purple-900">Magasins Analysés</h4>
                    </div>
                    <p className="text-2xl font-bold text-purple-600 mt-2">
                      {aiForecasts.length}
                    </p>
                    <p className="text-sm text-purple-700">
                      magasin{aiForecasts.length > 1 ? 's' : ''} avec des données historiques
                    </p>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
                      <h4 className="font-medium text-green-900">Production Totale</h4>
                    </div>
                    <p className="text-2xl font-bold text-green-600 mt-2">
                      {aiForecasts.reduce((sum, f) => sum + f.totalRecommendedProduction, 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-green-700">doughnuts recommandés</p>
                  </div>

                  <div className="bg-yellow-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <Sparkles className="h-5 w-5 text-yellow-600 mr-2" />
                      <h4 className="font-medium text-yellow-900">Déchets Estimés</h4>
                    </div>
                    <p className="text-2xl font-bold text-yellow-600 mt-2">
                      {(aiForecasts.reduce((sum, f) => sum + f.estimatedWastePercent, 0) / aiForecasts.length).toFixed(1)}%
                    </p>
                    <p className="text-sm text-yellow-700">moyenne (objectif: &lt;30%)</p>
                  </div>
                </div>
              )}

              {/* Detailed Predictions */}
              <div className="max-h-96 overflow-y-auto">
                {aiForecasts.map((forecast) => (
                  <div key={forecast.storeId} className="mb-6 border border-gray-200 rounded-lg p-4">
                    {/* Store Header */}
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-900 text-lg">{forecast.storeName}</h4>
                      <div className="flex space-x-4 text-sm">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                          Ventes prédites: {forecast.totalPredictedSales}
                        </span>
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                          Production recommandée: {forecast.totalRecommendedProduction}
                        </span>
                        <span className={`px-2 py-1 rounded ${
                          forecast.estimatedWastePercent <= 30 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          Déchets: {forecast.estimatedWastePercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Varieties Predictions */}
                    {forecast.predictions.length > 0 && (
                      <div className="mb-4">
                        <h5 className="font-medium text-gray-800 mb-2">Variétés Individuelles</h5>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Variété</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Ventes Prédites</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Recommandation</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Sécurité</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Raisonnement</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {forecast.predictions.map((prediction) => (
                                <tr key={prediction.varietyId}>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {prediction.varietyName}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-center text-gray-500">
                                    {prediction.predictedSales}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-center font-medium text-green-600">
                                    {prediction.recommendedProduction}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-center text-gray-500">
                                    {(prediction.confidence * 100).toFixed(0)}%
                                  </td>
                                  <td className="px-3 py-2 text-xs text-gray-600 max-w-xs">
                                    {prediction.reasoning}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Box Predictions */}
                    {forecast.boxPredictions.length > 0 && (
                      <div>
                        <h5 className="font-medium text-gray-800 mb-2">Boîtes</h5>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Boîte</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Ventes Prédites</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Recommandation</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Sécurité</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Raisonnement</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {forecast.boxPredictions.map((boxPrediction) => (
                                <tr key={boxPrediction.boxId}>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {boxPrediction.boxName}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-center text-gray-500">
                                    {boxPrediction.predictedSales}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-center font-medium text-green-600">
                                    {boxPrediction.recommendedProduction}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-center text-gray-500">
                                    {(boxPrediction.confidence * 100).toFixed(0)}%
                                  </td>
                                  <td className="px-3 py-2 text-xs text-gray-600 max-w-xs">
                                    {boxPrediction.reasoning}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Modal Actions */}
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <p className="font-medium">🎯 Objectifs de l'IA:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Éviter les ruptures de stock en fin de journée</li>
                    <li>Maintenir les déchets sous 30% par magasin</li>
                    <li>Optimiser la production basée sur l'historique réel</li>
                  </ul>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowAiModal(false)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={applyAIRecommendations}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Appliquer les Recommandations
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionPage;