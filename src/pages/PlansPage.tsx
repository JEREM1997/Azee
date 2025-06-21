import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Eye, FileText, AlertTriangle, RefreshCw, Edit, Trash2 } from 'lucide-react';
import { getProductionPlans, deletePlan } from '../services/productionService';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';

interface ProductionPlan {
  id: string;
  date: string;
  total_production: number;
  status?: 'draft' | 'validated' | 'completed';
  created_at: string;
  stores: Array<{
    id: string;
    store_id: string;
    store_name: string;
    deliverydate?: string;
    total_quantity: number;
    production_items: Array<{
      variety_id: string;
      variety_name: string;
      quantity: number;
    }>;
    box_productions: Array<{
      box_id: string;
      box_name: string;
      quantity: number;
    }>;
  }>;
}

const PlansPage: React.FC = () => {
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ProductionPlan | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const { currentUser } = useAuth();
  const { varieties, forms, boxes } = useAdmin();

  // Determine permissions
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'production');

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const plansData = await getProductionPlans(30);
      console.log('Fetched plans data:', plansData);
      
      // Debug delivery dates in fetched plans
      if (plansData && plansData.length > 0) {
        plansData.forEach((plan: ProductionPlan) => {
          console.log(`Plan ${plan.id} (${plan.date}):`);
          plan.stores?.forEach((store: any) => {
            console.log(`  Store ${store.store_name}: deliverydate = ${store.deliverydate || 'NOT SET'}`);
            if (store.deliverydate) {
              console.log(`    - Raw deliverydate: "${store.deliverydate}"`);
              console.log(`    - Type: ${typeof store.deliverydate}`);
              console.log(`    - Length: ${store.deliverydate.length}`);
              console.log(`    - Parsed as Date: ${new Date(store.deliverydate)}`);
              console.log(`    - Formatted (fr-FR): ${new Date(store.deliverydate).toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}`);
            }
          });
        });
      }
      
      setPlans(plansData || []);
    } catch (err) {
      console.error('Error loading plans:', err);
      setError(err instanceof Error ? err.message : 'Error loading plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();

    const handlePlanUpdate = () => {
      console.log('Plan update event received, refreshing plans...');
      loadPlans();
    };

    window.addEventListener('planSaved', handlePlanUpdate);

    return () => {
      window.removeEventListener('planSaved', handlePlanUpdate);
    };
  }, [loadPlans]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleViewPlan = (plan: ProductionPlan) => {
    console.log('Viewing plan with stores:', plan.stores); // Debug log
    console.log('Plan date:', plan.date);
    console.log('Plan ID:', plan.id);
    
    plan.stores?.forEach(store => {
      console.log(`Store ${store.store_name}:`);
      console.log(`  - Store ID: ${store.store_id}`);
      console.log(`  - Delivery date: ${store.deliverydate || 'NOT SET'}`);
      console.log(`  - Total quantity: ${store.total_quantity}`);
      console.log(`  - Production items count: ${store.production_items?.length || 0}`);
      console.log(`  - Box productions count: ${store.box_productions?.length || 0}`);
    });
    
    setSelectedPlan(plan);
    setShowModal(true);
  };

  const handleEditPlan = (plan: ProductionPlan) => {
    // Navigate to production page with the plan's date
    window.location.href = `/production?date=${plan.date}`;
  };

  const handleDeletePlan = async (plan: ProductionPlan) => {
    const confirmMessage = `Êtes-vous sûr de vouloir supprimer le plan de production du ${formatDate(plan.date)} ?\n\nCette action est irréversible et supprimera :\n- Le plan de production\n- Toutes les productions par magasin\n- Tous les articles de production\n- Toutes les productions de boîtes\n\nTapez "SUPPRIMER" pour confirmer :`;
    
    const userInput = prompt(confirmMessage);
    
    if (userInput !== 'SUPPRIMER') {
      return;
    }

    try {
      setDeleting(plan.id);
      setError(null);
      
      console.log('Attempting to delete plan:', plan.id);
      
      const result = await deletePlan(plan.id);
      console.log('Delete result:', result);
      
      // Refresh the plans list
      await loadPlans();
      
      // Show success message
      alert('Plan de production supprimé avec succès.');
    } catch (err) {
      console.error('Error deleting plan:', err);
      
      // The error messages are now already in French from the service
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la suppression du plan';
      setError(errorMessage);
    } finally {
      setDeleting(null);
    }
  };

  const closeModal = () => {
    setSelectedPlan(null);
    setShowModal(false);
  };

  const refreshPlans = async () => {
    console.log('Manual refresh triggered');
    await loadPlans();
  };

  // Add effect to refresh when page becomes visible (user returns from editing)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Page became visible, refreshing plans...');
        loadPlans();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadPlans]);

  // Calculate production summary for a plan
  const calculatePlanSummary = (plan: ProductionPlan) => {
    const varietyTotals: { [varietyId: string]: number } = {};
    const formTotals: { [formId: string]: number } = {};
    const boxTotals: { [boxId: string]: number } = {};
    let totalIndividualDoughnuts = 0;
    let totalBoxDoughnuts = 0;

    plan.stores?.forEach(store => {
      // Calculate individual variety totals
      store.production_items?.forEach(item => {
        varietyTotals[item.variety_id] = (varietyTotals[item.variety_id] || 0) + item.quantity;
        totalIndividualDoughnuts += item.quantity;

        // Add to form totals
        const variety = varieties.find(v => v.id === item.variety_id);
        if (variety && variety.formId) {
          formTotals[variety.formId] = (formTotals[variety.formId] || 0) + item.quantity;
        }
      });

      // Calculate box totals and add box varieties to variety and form totals
      store.box_productions?.forEach(boxProd => {
        const box = boxes.find(b => b.name === boxProd.box_name);
        if (box) {
          boxTotals[box.id] = (boxTotals[box.id] || 0) + boxProd.quantity;
          totalBoxDoughnuts += box.size * boxProd.quantity;

          // Add varieties from boxes to variety and form totals
          if (box.varieties && box.varieties.length > 0) {
            box.varieties.forEach(boxVariety => {
              const variety = varieties.find(v => v.id === boxVariety.varietyId);
              if (variety) {
                const varietyQuantityFromBoxes = boxVariety.quantity * boxProd.quantity;
                varietyTotals[variety.id] = (varietyTotals[variety.id] || 0) + varietyQuantityFromBoxes;

                if (variety.formId) {
                  formTotals[variety.formId] = (formTotals[variety.formId] || 0) + varietyQuantityFromBoxes;
                }
              }
            });
          }
        }
      });
    });

    return {
      varietyTotals,
      formTotals,
      boxTotals,
      totalDoughnuts: totalIndividualDoughnuts + totalBoxDoughnuts,
      totalIndividualDoughnuts,
      totalBoxDoughnuts
    };
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
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Plans de Production</h1>
            <p className="text-gray-600 mt-1">Historique des plans de production sauvegardés</p>
          </div>
          <button
            onClick={refreshPlans}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
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
                <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Calendar className="h-6 w-6 text-krispy-green" />
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-krispy-green truncate">
                            {formatDate(plan.date)}
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
                const summary = calculatePlanSummary(selectedPlan);
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
                                      {box.name}: {boxCount} boîtes ({totalDoughnuts} doughnuts)
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
                          {varieties
                            .filter(v => v.isActive)
                            .map(variety => {
                              const total = summary.varietyTotals[variety.id] || 0;
                              if (total === 0) return null;
                              const dozens = Math.floor(total / 12);
                              const units = total % 12;
                              return (
                                <div key={variety.id} className="space-y-1">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-600">{variety.name}</span>
                                    <span className="text-xs font-medium text-gray-900">{total}</span>
                                  </div>
                                  <div className="text-xs text-gray-500 pl-2">
                                    {dozens > 0 && `${dozens} douzaine${dozens > 1 ? 's' : ''}`}
                                    {dozens > 0 && units > 0 && ' + '}
                                    {units > 0 && `${units} unité${units > 1 ? 's' : ''}`}
                                    {dozens === 0 && units === 0 && '0 unité'}
                                  </div>
                                </div>
                              );
                            })
                            .filter(Boolean)}
                        </div>
                      </div>

                      {/* Store Summary Card */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h5 className="text-sm font-medium text-gray-800 mb-2">Par Magasin</h5>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {selectedPlan.stores?.map(store => {
                            if (store.total_quantity === 0) return null;
                            return (
                              <div key={store.id} className="flex justify-between items-center">
                                <span className="text-xs text-gray-600">{store.store_name}</span>
                                <span className="text-xs font-medium text-gray-900">{store.total_quantity}</span>
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
                              const baseTotal = summary.formTotals[form.id] || 0;
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
                  <div key={store.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">{store.store_name}</h4>
                        {/* Show delivery date only if manually set */}
                        <div className="mt-1 text-sm text-gray-600">
                          <span className="font-medium">Date de Livraison:</span> {
                            store.deliverydate ? 
                            new Date(store.deliverydate).toLocaleDateString('fr-FR', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            }) : 'Non définie'
                          }
                        </div>
                      </div>
                      <span className="text-sm px-3 py-1 rounded-full bg-krispy-green bg-opacity-10 text-krispy-green">
                        {store.total_quantity} doughnuts
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
    </div>
  );
};

export default PlansPage; 