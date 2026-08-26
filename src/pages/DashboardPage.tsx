import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { productionService } from '../services/productionService';
import { ProductionPlan, StorePlan } from '../types';
import { Calendar, Check, AlertTriangle, FileText, Truck, X, Store, Factory, CheckCircle2, Clock3, ArrowUpRight } from 'lucide-react';
import ContentSkeleton from '../components/ContentSkeleton';

const DashboardPage: React.FC = () => {
  const { currentUser: user, isAdmin, isProduction, isStore } = useAuth();
  const [showAllStores, setShowAllStores] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [currentPlan, setCurrentPlan] = useState<ProductionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadPlan = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const plan = await productionService.getProductionPlan(selectedDate, showAllStores);
        
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
  }, [selectedDate, showAllStores]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const formatDate = (dateString: string) => {
    // Use a timezone-safe parser: treat the ISO string as plain local date components
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }

    const [year, month, day] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
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

  if (loading) return <ContentSkeleton variant="dashboard" label="Préparation du tableau de bord…" />;

  const allowedStoreIds = new Set((user?.storeIds || []).map(id => id.toString().toLowerCase()));
  const visibleStores = currentPlan?.stores?.filter(store => isAdmin || isProduction || showAllStores || allowedStoreIds.has(store.store_id?.toString().toLowerCase())) || [];
  const completed = visibleStores.filter(store => store.delivery_confirmed && store.waste_reported).length;
  const deliveries = visibleStores.filter(store => store.delivery_confirmed).length;
  const progress = visibleStores.length ? Math.round((completed / visibleStores.length) * 100) : 0;

  return (
    <div>
      <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div><p className="eyebrow">Centre des opérations</p><h1 className="page-heading mt-2">Bonjour {user?.fullName?.split(' ')[0] || 'à vous'} <span aria-hidden="true">👋</span></h1><p className="page-description">Suivez la production, les livraisons et l’avancement du réseau en un coup d’œil.</p></div>
        <div className="surface-card flex items-center gap-3 p-2.5 pl-4">
            <Calendar className="h-4 w-4 text-krispy-green" />
            <label htmlFor="date-selector" className="sr-only">Date d’activité</label>
            <input
              id="date-selector"
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="border-0 bg-transparent px-1 text-sm font-semibold text-slate-700 shadow-none focus:ring-0"
            />
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
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
      
      <section className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Production prévue', value: (currentPlan?.total_production || 0).toLocaleString('fr-FR'), unit: 'doughnuts', icon: Factory },
          { label: 'Magasins suivis', value: visibleStores.length, unit: 'points de vente', icon: Store },
          { label: 'Livraisons reçues', value: `${deliveries}/${visibleStores.length}`, unit: deliveries === visibleStores.length && visibleStores.length ? 'toutes reçues' : 'à contrôler', icon: Truck },
          { label: 'Journée complétée', value: `${progress}%`, unit: `${completed} magasin${completed > 1 ? 's' : ''} finalisé${completed > 1 ? 's' : ''}`, icon: CheckCircle2 },
        ].map(({label,value,unit,icon: Icon}, index) => <article className="kpi-card" key={label}><div className="mb-5 flex items-start justify-between"><span className="kpi-icon"><Icon className="h-5 w-5" /></span>{index === 0 && <span className="status-pill bg-emerald-50 text-emerald-700"><ArrowUpRight className="h-3 w-3" />Plan actif</span>}</div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{value}</p><p className="mt-1 text-xs text-slate-500">{unit}</p></article>)}
      </section>

      <section className="surface-card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-50" /><h2 className="text-lg font-bold text-slate-900">Suivi des magasins</h2></div><p className="mt-1 text-sm text-slate-500">Production du {formatDate(selectedDate)}</p></div>
                {(isAdmin || isProduction) && (
                  <button
                    onClick={() => setShowAllStores(prev => !prev)}
                    className="btn-secondary"
                  >
                    <Store className="h-4 w-4" />
                    {showAllStores ? 'Voir mes magasins' : 'Voir tous les magasins'}
                  </button>
                )}
        </div>
        {currentPlan && visibleStores.length ? <div className="overflow-hidden md:overflow-x-auto">
                <table className="responsive-table min-w-full divide-y divide-gray-200">
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
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {visibleStores.map((store) => {
                        // Calculate completion metrics
                        const totalItems = store.production_items?.length || 0;
                        const receivedItems = store.production_items?.filter(item => item.received !== null).length || 0;
                        const wasteItems = store.production_items?.filter(item => item.waste !== null).length || 0;
                        
                        const receivedPercentage = totalItems > 0 ? Math.round((receivedItems / totalItems) * 100) : 0;
                        const wastePercentage = totalItems > 0 ? Math.round((wasteItems / totalItems) * 100) : 0;
                        
                        return (
                          <tr key={store.store_id} className="group">
                            <td data-label="Magasin" className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Store className="h-4 w-4" /></span><div><div className="text-sm font-semibold text-slate-900">{store.store_name}</div><div className="text-xs text-slate-400">Point de vente</div></div></div>
                            </td>
                            <td data-label="Quantité" className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-bold text-slate-800">{store.total_quantity.toLocaleString('fr-FR')} <span className="font-normal text-slate-400">unités</span></div>
                            </td>
                            <td data-label="Livraison" className="px-6 py-4 whitespace-nowrap">
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
                            <td data-label="Déchets" className="px-6 py-4 whitespace-nowrap">
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
                            <td data-label="Statut" className="px-6 py-4 whitespace-nowrap">
                              <span className={`status-pill ${getStatusColor(store)}`}>
                                {getStatusIcon(store)}
                                {getStatusText(store)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div> : <div className="px-6 py-16 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Clock3 className="h-6 w-6" /></span><h3 className="mt-4 font-bold text-slate-800">Aucun plan pour cette journée</h3><p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Sélectionnez une autre date pour consulter la production et l’avancement des magasins.</p></div>}
      </section>
    </div>
  );
};

export default DashboardPage;
