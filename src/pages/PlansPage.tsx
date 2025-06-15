import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Eye, FileText, AlertTriangle, Clock, CheckCircle, RefreshCw } from 'lucide-react';
import { getProductionPlans } from '../services/productionService';

interface ProductionPlan {
  id: string;
  date: string;
  total_production: number;
  status: 'draft' | 'validated' | 'completed';
  created_at: string;
  stores: Array<{
    id: string;
    store_id: string;
    store_name: string;
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

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const plansData = await getProductionPlans(30);
      console.log('Fetched plans data:', plansData);
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
      loadPlans();
    };

    window.addEventListener('planSaved', handlePlanUpdate);

    return () => {
      window.removeEventListener('planSaved', handlePlanUpdate);
    };
  }, [loadPlans]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'validated':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Brouillon';
      case 'validated':
        return 'Validé';
      case 'completed':
        return 'Terminé';
      default:
        return 'Inconnu';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'validated':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleViewPlan = (plan: ProductionPlan) => {
    setSelectedPlan(plan);
    setShowModal(true);
  };

  const closeModal = () => {
    setSelectedPlan(null);
    setShowModal(false);
  };

  const refreshPlans = async () => {
    await loadPlans();
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
                          <div className="ml-2 flex-shrink-0 flex">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(plan.status)}`}>
                              {getStatusIcon(plan.status)}
                              <span className="ml-1">{getStatusText(plan.status)}</span>
                            </span>
                          </div>
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
                      <button
                        onClick={() => handleViewPlan(plan)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Voir détails
                      </button>
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
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
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

              <div className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-krispy-green bg-opacity-10 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-krispy-green">Total Production</h4>
                    <p className="text-2xl font-bold text-krispy-green">{selectedPlan.total_production}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-800">Statut</h4>
                    <div className="flex items-center mt-1">
                      {getStatusIcon(selectedPlan.status)}
                      <span className="ml-2 text-sm font-medium">{getStatusText(selectedPlan.status)}</span>
                    </div>
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
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-medium text-gray-900">{store.store_name}</h4>
                      <span className="text-sm px-3 py-1 rounded-full bg-krispy-green bg-opacity-10 text-krispy-green">
                        {store.total_quantity} doughnuts
                      </span>
                    </div>

                    {store.production_items && store.production_items.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Variétés</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {store.production_items.map((item, index) => (
                            <div key={index} className="flex justify-between items-center py-1">
                              <span className="text-sm text-gray-600">{item.variety_name}</span>
                              <span className="text-sm font-medium text-gray-900">{item.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {store.box_productions && store.box_productions.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Boîtes</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {store.box_productions.map((box, index) => (
                            <div key={index} className="flex justify-between items-center py-1">
                              <span className="text-sm text-gray-600">{box.box_name}</span>
                              <span className="text-sm font-medium text-gray-900">{box.quantity} boîtes</span>
                            </div>
                          ))}
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