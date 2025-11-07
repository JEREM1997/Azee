import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Eye, FileText, AlertTriangle, RefreshCw, Edit, Trash2, Plus } from 'lucide-react';
import { productionService } from '../services/productionService';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { ProductionPlan, StorePlan, ProductionItem, BoxProduction } from '../types';

const PlansPage: React.FC = () => {
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ProductionPlan | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [recentlySavedPlanId, setRecentlySavedPlanId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Modal state for creating a plan on a user-chosen date
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlanDate, setNewPlanDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [createError, setCreateError] = useState<string | null>(null);
  // Filters
  const [filterMode, setFilterMode] = useState<'last7' | 'last30' | 'thisMonth' | 'all' | 'custom'>('last7');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const { user } = useAuth();
  const { varieties, forms, boxes } = useAdmin();

  // Determine permissions
  const canEdit = user && (user.role === 'admin' || user.role === 'production');

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Determine requested date window based on filter
      const today = new Date();
      const todayStr = new Date(today.getTime()).toISOString().split('T')[0];
      let plansData: ProductionPlan[] = [];

      if (filterMode === 'all') {
        // Broad range to effectively fetch all
        const start = '2025-10-20';
        const end = '2025-11-06';
        plansData = await productionService.getProductionPlans(start, end);
      } else if (filterMode === 'last7') {
        // Last 7 days up to today (rolling window)
        plansData = await productionService.getProductionPlans('7', todayStr);
      } else if (filterMode === 'last30') {
        plansData = await productionService.getProductionPlans('30', todayStr);
      } else if (filterMode === 'thisMonth') {
        const year = today.getFullYear();
        const month = today.getMonth();
        const startDate = new Date(year, month, 1).toISOString().split('T')[0];
        // End of month
        const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
        plansData = await productionService.getProductionPlans(startDate, endDate);
      } else if (filterMode === 'custom') {
        const startDate = customStart || '2000-01-01';
        const endDate = customEnd || todayStr;
        plansData = await productionService.getProductionPlans(startDate, endDate);
      }
      
      // Check if we're expecting a recently saved plan
      const expectedPlanInfo = localStorage.getItem('recentlySavedPlan');
      let expectedPlan = null;
      if (expectedPlanInfo) {
        try {
          expectedPlan = JSON.parse(expectedPlanInfo);
          console.log('🔍 EXPECTED PLAN - Looking for recently saved plan:', expectedPlan);
        } catch (e) {
          console.error('Error parsing expected plan info:', e);
        }
      }
      
      console.log('🔄 Loading plans from server...');
      console.log('✅ Fetched plans data:', plansData);
      console.log('📊 Plans count:', plansData?.length || 0);
      
      // Specific search for the expected plan date
      if (expectedPlan && plansData && Array.isArray(plansData)) {
        console.log('🔍 SEARCHING FOR EXPECTED DATE - Looking for plans with date:', expectedPlan.date);
        const plansWithExpectedDate = plansData.filter((plan: ProductionPlan) => plan.date === expectedPlan.date);
        console.log('🔍 SEARCHING FOR EXPECTED DATE - Found', plansWithExpectedDate.length, 'plans with expected date');
        
        if (plansWithExpectedDate.length > 0) {
          console.log('✅ FOUND PLANS WITH EXPECTED DATE:', plansWithExpectedDate);
          plansWithExpectedDate.forEach((plan: ProductionPlan) => {
            console.log(`  - Plan ID: ${plan.id}, Date: ${plan.date}, Total: ${plan.total_production}`);
          });
        } else {
          console.log('❌ NO PLANS FOUND WITH EXPECTED DATE:', expectedPlan.date);
          console.log('❌ Available dates in response:', plansData.map((p: ProductionPlan) => p.date));
        }
        
        const foundExpectedPlan = plansData.find((plan: ProductionPlan) => plan.id === expectedPlan.id);
        if (foundExpectedPlan) {
          console.log('✅ EXPECTED PLAN FOUND - Recently saved plan is present in results');
          console.log('🔍 EXPECTED PLAN - Expected date:', expectedPlan.date);
          console.log('🔍 EXPECTED PLAN - Actual date:', foundExpectedPlan.date);
          console.log('🔍 EXPECTED PLAN - Dates match:', foundExpectedPlan.date === expectedPlan.date);
          
          if (foundExpectedPlan.date !== expectedPlan.date) {
            console.error('❌ DATE MISMATCH - Plan was saved with wrong date!');
            console.error('❌ DATE MISMATCH - Expected:', expectedPlan.date);
            console.error('❌ DATE MISMATCH - Got:', foundExpectedPlan.date);
          }
        } else {
          console.error('❌ EXPECTED PLAN MISSING - Recently saved plan not found in results!');
          console.error('❌ EXPECTED PLAN MISSING - Looking for ID:', expectedPlan.id);
          console.error('❌ EXPECTED PLAN MISSING - Looking for date:', expectedPlan.date);
          console.error('❌ EXPECTED PLAN MISSING - Available plan IDs:', plansData.map((p: ProductionPlan) => p.id));
          console.error('❌ EXPECTED PLAN MISSING - Available plan dates:', plansData.map((p: ProductionPlan) => p.date));
        }
      }
      
      // Debug delivery dates in fetched plans
      if (plansData && plansData.length > 0) {
        console.log('📅 Plan dates found:');
        plansData.forEach((plan: ProductionPlan) => {
          console.log(`  - ${plan.date} (ID: ${plan.id}, Total: ${plan.total_production})`);
          plan.stores?.forEach((store: StorePlan) => {
            console.log(`    Store ${store.store_name}: delivery_date = ${store.delivery_date || 'NOT SET'}`);
            if (store.delivery_date) {
              console.log(`    - Raw delivery_date: "${store.delivery_date}"`);
              console.log(`    - Type: ${typeof store.delivery_date}`);
              console.log(`    - Length: ${store.delivery_date.length}`);
              console.log(`    - Parsed as Date: ${new Date(store.delivery_date)}`);
              console.log(`    - Formatted (fr-FR): ${new Date(store.delivery_date).toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}`);
            }
          });
        });
      } else {
        console.log('⚠️ No plans data received or empty array');
      }
      
      // Debug store details
      if (plansData && plansData.length > 0) {
        console.log('📊 Store details:');
        plansData[0].stores?.forEach((store: StorePlan) => {
          console.log(`Store ${store.store_name}:`);
          console.log(`  - Store ID: ${store.store_id}`);
          console.log(`  - Delivery date: ${store.delivery_date || 'NOT SET'}`);
          console.log(`  - Total quantity: ${store.total_quantity}`);
          console.log(`  - Production items count: ${store.production_items?.length || 0}`);
          console.log(`  - Box productions count: ${store.box_productions?.length || 0}`);
        });
      }
      
      setPlans(
        (plansData || [])
          // current line – removes plans that have no stores or totals
          // .filter(p => (p.stores?.length ?? 0) > 0 && p.total_production > 0)

          // new line – keep every plan Supabase returns
          .filter(Boolean)
      );
      console.log('✅ Plans state updated successfully');
    } catch (err) {
      console.error('❌ Error loading plans:', err);
      setError(err instanceof Error ? err.message : 'Error loading plans');
    } finally {
      setLoading(false);
    }
  }, [filterMode, customStart, customEnd]);

  useEffect(() => {
    loadPlans();

    const handlePlanUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('Plan update event received, refreshing plans...', customEvent?.detail);
      
      // Track the recently saved plan for visual feedback
      if (customEvent?.detail?.planId) {
        setRecentlySavedPlanId(customEvent.detail.planId);
        // Clear the highlight after 10 seconds
        setTimeout(() => setRecentlySavedPlanId(null), 10000);
      }
      
      loadPlans();
    };

    // Check for recently saved plan in localStorage
    const checkRecentlySavedPlan = () => {
      try {
        const savedPlanInfo = localStorage.getItem('recentlySavedPlan');
        if (savedPlanInfo) {
          const planInfo = JSON.parse(savedPlanInfo);
          const timeDiff = Date.now() - planInfo.timestamp;
          
          console.log('🔍 RECENT PLAN DEBUG - Recently saved plan info:', planInfo);
          console.log('🔍 RECENT PLAN DEBUG - Expected plan ID:', planInfo.id);
          console.log('🔍 RECENT PLAN DEBUG - Expected plan date:', planInfo.date);
          console.log('🔍 RECENT PLAN DEBUG - Time since save:', Math.round(timeDiff / 1000), 'seconds');
          
          // If plan was saved within last 30 seconds, force a refresh
          if (timeDiff < 30000) {
            console.log('🔍 RECENT PLAN DEBUG - Plan is recent, forcing refresh');
            setRecentlySavedPlanId(planInfo.id);
            // Clear the highlight after 10 seconds
            setTimeout(() => setRecentlySavedPlanId(null), 10000);
            loadPlans();
            // Clear the saved plan info after using it
            localStorage.removeItem('recentlySavedPlan');
          } else {
            console.log('🔍 RECENT PLAN DEBUG - Plan is too old, skipping refresh');
          }
        } else {
          console.log('🔍 RECENT PLAN DEBUG - No recently saved plan found in localStorage');
        }
      } catch (error) {
        console.error('Error checking recently saved plan:', error);
      }
    };

    // Check immediately on mount
    checkRecentlySavedPlan();

    window.addEventListener('planSaved', handlePlanUpdate as EventListener);

    return () => {
      window.removeEventListener('planSaved', handlePlanUpdate as EventListener);
    };
  }, [loadPlans]);

  // Timezone-safe date formatter (shared with DeliveryPage)
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

  // Calculate production summary for a plan (totals per variety / form / box)
  const calculatePlanSummary = (plan: ProductionPlan) => {
    const varietyTotals: { [varietyId: string]: number } = {};
    const formTotals: { [formId: string]: number } = {};
    const boxTotals: { [boxId: string]: number } = {};
    const storeTotals: { [storeId: string]: number } = {};  // total doughnuts per store

    let totalIndividualDoughnuts = 0;
    let totalBoxDoughnuts = 0;
    let totalBoxes = 0;

    // Iterate through stores
    plan.stores.forEach(store => {
      // Individual items
      store.production_items.forEach(item => {
        // Variety totals
        varietyTotals[item.variety_id] = (varietyTotals[item.variety_id] || 0) + item.quantity;

        // Form totals (need to map variety -> form)
        const variety = varieties.find(v => v.id === item.variety_id);
        if (variety && variety.formId) {
          formTotals[variety.formId] = (formTotals[variety.formId] || 0) + item.quantity;
        }

        totalIndividualDoughnuts += item.quantity;
        storeTotals[store.store_id] = (storeTotals[store.store_id] || 0) + item.quantity;
      });

      // If no items at all, ensure storeTotals includes the store's total_quantity
      if (!(store.store_id in storeTotals)) {
        storeTotals[store.store_id] = store.total_quantity;
      }

      // Boxes
      store.box_productions.forEach(boxProd => {
        boxTotals[boxProd.box_id] = (boxTotals[boxProd.box_id] || 0) + boxProd.quantity;
        totalBoxes += boxProd.quantity;

        const boxDef = boxes.find(b => b.id === boxProd.box_id);
        if (boxDef) {
          totalBoxDoughnuts += boxDef.size * boxProd.quantity;

          // Add varieties contained in box to totals
          boxDef.varieties?.forEach(v => {
            const totalFromBoxes = v.quantity * boxProd.quantity;
            varietyTotals[v.varietyId] = (varietyTotals[v.varietyId] || 0) + totalFromBoxes;

            const variety = varieties.find(varObj => varObj.id === v.varietyId);
            if (variety && variety.formId) {
              formTotals[variety.formId] = (formTotals[variety.formId] || 0) + totalFromBoxes;
            }
          });
        }
      });
    });

    // Fallback: if no items found but total_production present, use that
    if (totalIndividualDoughnuts === 0 && plan.total_production > 0) {
      totalIndividualDoughnuts = plan.total_production;
    }

    return {
      varietyTotals,
      formTotals,
      boxTotals,
      storeTotals,
      totalIndividualDoughnuts,
      totalBoxDoughnuts,
      totalBoxes,
      totalDoughnuts: totalIndividualDoughnuts + totalBoxDoughnuts
    };
  };

  // Pre-compute summary for selected plan so it can be reused across modal sections
  const planSummary = selectedPlan ? calculatePlanSummary(selectedPlan) : null;

  const formatDate = (dateString: string) => formatDateSafe(dateString);

  const handleViewPlan = (plan: ProductionPlan) => {
    console.log('Viewing plan with stores:', plan.stores); // Debug log
    console.log('Plan date:', plan.date);
    console.log('Plan ID:', plan.id);
    
    plan.stores?.forEach(store => {
      console.log(`Store ${store.store_name}:`);
      console.log(`  - Store ID: ${store.store_id}`);
      console.log(`  - Delivery date: ${store.delivery_date || 'NOT SET'}`);
      console.log(`  - Total quantity: ${store.total_quantity}`);
      console.log(`  - Production items count: ${store.production_items?.length || 0}`);
      console.log(`  - Box productions count: ${store.box_productions?.length || 0}`);
    });
    
    setSelectedPlan(plan);
    setShowModal(true);
  };

  const handleEditPlan = (plan: ProductionPlan) => {
    // Navigate to production page with the plan's date
    const editUrl = `/production?date=${plan.date}`;
    console.log('🔧 EDIT PLAN DEBUG - Editing plan:', plan.id);
    console.log('🔧 EDIT PLAN DEBUG - Plan date:', plan.date);
    console.log('🔧 EDIT PLAN DEBUG - Constructed URL:', editUrl);
    console.log('🔧 EDIT PLAN DEBUG - Full plan object:', plan);
    
    window.location.href = editUrl;
  };

  const handleDeletePlan = async (plan: ProductionPlan) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le plan de production du ${formatDate(plan.date)} ?`)) {
      return;
    }

    try {
      setDeleting(plan.id);
      await productionService.deleteProductionPlan(plan.id);
      setPlans(prevPlans => prevPlans.filter(p => p.id !== plan.id));
    } catch (err) {
      console.error('Error deleting plan:', err);
      setError(err instanceof Error ? err.message : 'Error deleting plan');
    } finally {
      setDeleting(null);
    }
  };

  const openCreateModal = () => {
    setNewPlanDate(new Date().toISOString().split('T')[0]);
    setCreateError(null);
    setShowCreateModal(true);
  };

  const handleCreateNewPlan = async () => {
    if (creating) return;

    // Validate
    if (!newPlanDate) {
      setCreateError('Veuillez sélectionner une date.');
      return;
    }
    if (plans.some(p => p.date === newPlanDate)) {
      setCreateError('Un plan existe déjà pour cette date.');
      return;
    }

    try {
      setCreating(true);
      await productionService.saveProductionPlan({
        id: '',
        date: newPlanDate,
        total_production: 0,
        status: 'draft',
        stores: []
      } as any);

      setShowCreateModal(false);
      await loadPlans();
    } catch (error) {
      console.error('Error creating plan:', error);
      setCreateError('Erreur lors de la création du plan.');
    } finally {
      setCreating(false);
    }
  };

  const closeModal = () => {
    setSelectedPlan(null);
    setShowModal(false);
  };

  const refreshPlans = async () => {
    console.log('Manual refresh triggered');
    setRefreshing(true);
    try {
      await loadPlans();
      console.log('✅ Manual refresh completed successfully');
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Add effect to refresh when page becomes visible (user returns from editing)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('👁️ Page became visible, checking for updates...');
        
        // Check for recently saved plans first
        const savedPlanInfo = localStorage.getItem('recentlySavedPlan');
        if (savedPlanInfo) {
          console.log('🔍 Found recently saved plan info, refreshing immediately');
          try {
            const planInfo = JSON.parse(savedPlanInfo);
            setRecentlySavedPlanId(planInfo.id);
            setTimeout(() => setRecentlySavedPlanId(null), 10000);
            localStorage.removeItem('recentlySavedPlan');
          } catch (error) {
            console.error('Error parsing saved plan info:', error);
          }
          loadPlans();
        } else {
          // Add a small delay to ensure any pending operations complete
          setTimeout(() => {
            console.log('🔄 Refreshing plans after visibility change...');
            loadPlans();
          }, 500);
        }
      }
    };

    const handleFocus = () => {
      console.log('🎯 Window focused, refreshing plans...');
      loadPlans();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadPlans]);

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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Plans de Production</h1>
            <p className="text-gray-600 mt-1">Historique des plans de production sauvegardés</p>
          </div>
          <div className="flex space-x-2">
            <div className="flex items-center space-x-2">
              <select
                value={filterMode}
                onChange={e => setFilterMode(e.target.value as any)}
                className="border border-gray-300 rounded-md px-2 py-2 text-sm"
                title="Filtrer par période"
              >
                <option value="last7">7 derniers jours</option>
                <option value="last30">30 derniers jours</option>
                <option value="thisMonth">Ce mois</option>
                <option value="all">Tout</option>
                <option value="custom">Plage personnalisée…</option>
              </select>
              {filterMode === 'custom' && (
                <div className="flex items-center space-x-2">
                  <input
                    type="date"
                    value={customStart}
                    onChange={e => setCustomStart(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-2 text-sm"
                    placeholder="Début"
                  />
                  <span className="text-gray-500">→</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={e => setCustomEnd(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-2 text-sm"
                    placeholder="Fin"
                  />
                </div>
              )}
            </div>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-krispy-green hover:bg-krispy-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green disabled:opacity-50"
              disabled={creating}
            >
              <Plus className="h-4 w-4 mr-2" />
              {creating ? 'Création...' : 'Nouveau Plan'}
            </button>
            <button
              onClick={refreshPlans}
              disabled={loading || refreshing}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading || refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Actualisation...' : 'Actualiser'}
            </button>
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

      {plans.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun plan de production</h3>
          <p className="mt-1 text-sm text-gray-500">
            Aucun plan de production n'a été sauvegardé pour le moment.
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {plans.map((plan) => (
              <li key={plan.id}>
                <div className={`px-4 py-4 sm:px-6 hover:bg-gray-50 transition-colors duration-200 ${
                  recentlySavedPlanId === plan.id 
                    ? 'bg-green-50 border-l-4 border-green-400 shadow-md' 
                    : ''
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Calendar className={`h-6 w-6 ${
                          recentlySavedPlanId === plan.id ? 'text-green-600' : 'text-krispy-green'
                        }`} />
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <p className={`text-sm font-medium truncate ${
                            recentlySavedPlanId === plan.id ? 'text-green-700' : 'text-krispy-green'
                          }`}>
                            {formatDate(plan.date)}
                            {recentlySavedPlanId === plan.id && (
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 animate-pulse">
                                ✨ Récemment sauvegardé
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center text-sm text-gray-500">
                          <p>
                            Total: <span className="font-medium">{plan.total_production}</span> doughnuts
                            {plan.stores && (
                              <span className="ml-4">
                                {plan.stores.length} magasin{plan.stores.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewPlan(plan)}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Voir détails
                        </button>
                        {canEdit && (
                          <>
                            <button
                              onClick={() => handleEditPlan(plan)}
                              className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-krispy-green hover:bg-krispy-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Modifier
                            </button>
                            <button
                              onClick={() => handleDeletePlan(plan)}
                              disabled={deleting === plan.id}
                              className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Supprimer ce plan de production"
                            >
                              {deleting === plan.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Suppression...
                                </>
                              ) : (
                                <>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Supprimer
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Plan Details Modal */}
      {showModal && selectedPlan && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Plan de Production - {formatDate(selectedPlan.date)}
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Fermer</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Production Summary Section */}
              {(() => {
                const summary = planSummary!;
                return (
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">Résumé de la Production</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Total Doughnuts Card */}
                      <div className="bg-krispy-green bg-opacity-10 rounded-lg p-4">
                        <h5 className="text-sm font-medium text-krispy-green mb-2">Total Doughnuts</h5>
                        <p className="text-2xl font-bold text-krispy-green">{summary.totalDoughnuts}</p>
                        <div className="mt-2 text-xs text-gray-600">
                          <p>Individuels: {summary.totalIndividualDoughnuts}</p>
                          <div className="mt-1">
                            <p className="font-medium">En Boîtes: {summary.totalBoxDoughnuts}</p>
                            <div className="ml-2 space-y-1 max-h-16 overflow-y-auto">
                              {boxes
                                .filter(b => b.isActive)
                                .map(box => {
                                  const boxCount = summary.boxTotals[box.id] || 0;
                                  if (boxCount === 0) return null;
                                  const totalDoughnuts = boxCount * box.size;
                                  return (
                                    <div key={box.id} className="text-xs text-gray-500">
                                      {box.name}: {planSummary?.boxTotals[box.id] || 0} boîtes ({totalDoughnuts} doughnuts)
                                    </div>
                                  );
                                })
                                .filter(Boolean)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Main Varieties Card */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h5 className="text-sm font-medium text-gray-800 mb-2">Variétés Principales</h5>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {Object.entries(planSummary?.varietyTotals || {})
                            .filter(([, qty]) => qty > 0)
                            .map(([varId, qty]) => {
                              const variety = varieties.find(v => v.id === varId);
                              const name = variety ? variety.name : `Variété ${varId}`;
                              const dozens = Math.floor(qty as number / 12);
                              const units = (qty as number) % 12;
                              return (
                                <div key={varId} className="space-y-1">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-600">{name}</span>
                                    <span className="text-xs font-medium text-gray-900">{qty as number}</span>
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
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h5 className="text-sm font-medium text-gray-800 mb-2">Par Magasin</h5>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {selectedPlan.stores?.map(store => {
                            const totalQuantity = planSummary?.storeTotals[store.store_id] || 0;
                            if (totalQuantity === 0) return null;
                            return (
                              <div key={store.store_id} className="flex justify-between items-center">
                                <span className="text-xs text-gray-600">{store.store_name}</span>
                                <span className="text-xs font-medium text-gray-900">{totalQuantity}</span>
                              </div>
                            );
                          }).filter(Boolean)}
                        </div>
                      </div>

                      {/* Forms with Reserve Card */}
                      <div className="bg-blue-50 rounded-lg p-4">
                        <h5 className="text-sm font-medium text-blue-800 mb-2">Par Forme (avec 5% de réserve)</h5>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {forms
                            .filter(f => f.isActive)
                            .map(form => {
                              const baseTotal = planSummary?.formTotals[form.id] || 0;
                              if (baseTotal === 0) return null;
                              const totalWithReserve = Math.ceil(baseTotal * 1.05);
                              return (
                                <div key={form.id} className="space-y-1">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-600">{form.name}</span>
                                    <span className="text-xs font-medium text-blue-900">{totalWithReserve}</span>
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
                );
              })()}

              <div className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-krispy-green bg-opacity-10 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-krispy-green">Total Production</h4>
                    <p className="text-2xl font-bold text-krispy-green">{selectedPlan.total_production}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-800">Magasins</h4>
                    <p className="text-2xl font-bold text-gray-900">{selectedPlan.stores?.length || 0}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {selectedPlan.stores?.map((store) => (
                  <div key={store.store_id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">{store.store_name}</h4>
                        {/* Show delivery date only if manually set */}
                        <div className="mt-1 text-sm text-gray-600">
                          <span className="font-medium">Date de Livraison:</span> {
                            formatDateSafe(store.delivery_date || (store as any).deliverydate || selectedPlan.date)
                          }
                        </div>
                      </div>
                      <span className="text-sm px-3 py-1 rounded-full bg-krispy-green bg-opacity-10 text-krispy-green">
                        {planSummary?.storeTotals[store.store_id] || 0} doughnuts
                      </span>
                    </div>

                    {/* Varieties Section - Enhanced with Forms */}
                    {store.production_items && store.production_items.length > 0 && (
                      <div className="mb-6">
                        <h5 className="text-lg font-medium text-gray-700 mb-3">Variétés</h5>
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
                              {store.production_items.map((item, index) => {
                                const variety = varieties.find(v => v.id === item.variety_id);
                                const form = variety?.formId ? forms.find(f => f.id === variety.formId) : null;
                                return (
                                  <tr key={index}>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                      {item.variety_name}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                      {form ? form.name : 'Non définie'}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                                      {item.quantity}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Boxes Section - Enhanced with Full Details */}
                    {store.box_productions && store.box_productions.length > 0 && (
                      <div>
                        <h5 className="text-lg font-medium text-gray-700 mb-3">Boîtes Disponibles</h5>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Boîte</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Taille</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variétés Configurées</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Formes de Doughnuts</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité de Boîtes</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité Totale</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {store.box_productions.map((boxProd, index) => {
                                const box = boxes.find(b => b.name === boxProd.box_name);
                                const totalDoughnuts = box ? box.size * boxProd.quantity : 0;
                                
                                // Get unique forms from the varieties in this box
                                const boxForms = box?.varieties && box.varieties.length > 0 ? 
                                  [...new Set(box.varieties
                                    .map(boxVariety => {
                                      const variety = varieties.find(v => v.id === boxVariety.varietyId);
                                      if (variety && variety.formId) {
                                        return variety.formId;
                                      }
                                      return null;
                                    })
                                    .filter(formId => formId !== null)
                                  )] : [];
                                
                                return (
                                  <tr key={index}>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                      {boxProd.box_name}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                                      {box ? `${box.size} doughnuts` : 'N/A'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500">
                                      {box?.varieties && box.varieties.length > 0 ? (
                                        <div className="space-y-1">
                                          {box.varieties.map((boxVariety, vIndex) => {
                                            const variety = varieties.find(v => v.id === boxVariety.varietyId);
                                            return variety ? (
                                              <div key={vIndex} className="text-xs">
                                                {variety.name}: {boxVariety.quantity}
                                              </div>
                                            ) : null;
                                          })}
                                        </div>
                                      ) : (
                                        <span className="text-xs text-gray-400 italic">Aucune variété configurée</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500">
                                      {boxForms.length > 0 ? (
                                        <div className="space-y-1">
                                          {boxForms.map((formId, fIndex) => {
                                            const form = forms.find(f => f.id === formId);
                                            return form ? (
                                              <div key={fIndex} className="text-xs">
                                                {form.name}
                                              </div>
                                            ) : null;
                                          })}
                                        </div>
                                      ) : (
                                        <span className="text-xs text-gray-400 italic">Aucune forme définie</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                                      {boxProd.quantity}
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
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={closeModal}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Plan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6">
            <h2 className="text-xl font-semibold mb-4">Créer un nouveau plan</h2>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date de production</label>
            <input
              type="date"
              value={newPlanDate}
              onChange={e => setNewPlanDate(e.target.value)}
              max={(() => {
                const maxDate = new Date();
                maxDate.setFullYear(maxDate.getFullYear() + 10);
                return maxDate.toISOString().split('T')[0];
              })()}
              className="border border-gray-300 rounded-md p-2 w-full mb-4"
            />
            {createError && (
              <p className="text-red-600 text-sm mb-4">{createError}</p>
            )}
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300"
                disabled={creating}
              >Annuler</button>
              <button
                onClick={handleCreateNewPlan}
                className="px-4 py-2 rounded-md text-white bg-krispy-green hover:bg-krispy-green-dark disabled:opacity-50"
                disabled={creating}
              >{creating ? 'Création...' : 'Créer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlansPage; 