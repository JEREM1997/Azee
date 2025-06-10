import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, Coffee, ShoppingBag, Check, Printer, FileText, TruckIcon, AlertTriangle, Truck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getCurrentDayPlan, updateDeliveryStatus } from '../services/productionService';
import { ProductionPlan } from '../types';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const DeliveryPage: React.FC = () => {
  const { currentUser, isAdmin, isProduction } = useAuth();
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<ProductionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [receivedQuantities, setReceivedQuantities] = useState<{ [key: string]: number }>({});
  const [wasteQuantities, setWasteQuantities] = useState<{ [key: string]: number }>({});
  
  const loadCurrentPlan = async () => {
    try {
      setLoading(true);
      setError(null);
      const today = new Date().toISOString().split('T')[0];
      const plan = await getCurrentDayPlan(today);
      setCurrentPlan(plan);
      
      // Initialize received quantities from plan data
      if (plan?.store_productions) {
        const quantities: { [key: string]: number } = {};
        const waste: { [key: string]: number } = {};
        
        plan.store_productions.forEach(store => {
          store.production_items?.forEach(item => {
            if (item.received !== null) quantities[item.id] = item.received;
            if (item.waste !== null) waste[item.id] = item.waste;
          });
        });
        
        setReceivedQuantities(quantities);
        setWasteQuantities(waste);
      }
    } catch (err) {
      console.error('Error loading current production plan:', err);
      setError(err instanceof Error ? err.message : 'Error loading current production plan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentPlan();
  }, []);

  // Filter stores based on user role and store IDs
  const userStores = currentPlan?.store_productions?.filter(store => {
    if (isAdmin || isProduction) return true;
    return currentUser?.storeIds?.includes(store.store_id);
  }) || [];

  const storeDetails = selectedStore 
    ? currentPlan?.store_productions?.find(store => store.id === selectedStore)
    : null;

  const generateDeliveryBulletin = () => {
    if (!storeDetails) return;

    const doc = new jsPDF();
    
    const today = new Date();
    const productionDate = today.toLocaleDateString('fr-FR');
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    
    const headers = [
      ['Date de la production', productionDate],
      ['Magasin', storeDetails.store_name]
    ];

    headers.forEach((row, i) => {
      doc.cell(14, 20 + (i * 10), 80, 10, row[0], i + 1, 'left');
      doc.cell(94, 20 + (i * 10), 80, 10, row[1], i + 1, 'left');
    });

    // Add individual items table
    const itemsTableHeaders = [
      ['Variété', 'Quantité Prévue', 'Quantité Reçue', 'Déchets']
    ];

    const itemsTableData = storeDetails.production_items?.map(item => [
      item.variety_name,
      item.quantity.toString(),
      receivedQuantities[item.id]?.toString() || '',
      wasteQuantities[item.id]?.toString() || ''
    ]) || [];

    (doc as any).autoTable({
      startY: 50,
      head: itemsTableHeaders,
      body: itemsTableData,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 2
      }
    });

    // Add boxes table if there are any boxes
    if (storeDetails.box_productions && storeDetails.box_productions.length > 0) {
      const boxesTableHeaders = [
        ['Boîte', 'Quantité']
      ];

      const boxesTableData = storeDetails.box_productions.map(box => [
        box.box_name,
        box.quantity.toString()
      ]);

      (doc as any).autoTable({
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: boxesTableHeaders,
        body: boxesTableData,
        theme: 'grid',
        styles: {
          fontSize: 10,
          cellPadding: 2
        }
      });
    }

    const finalY = (doc as any).lastAutoTable.finalY || 150;
    doc.line(20, finalY + 30, 190, finalY + 30);
    doc.text('Signature:', 20, finalY + 40);

    doc.save(`bulletin-livraison-${storeDetails.store_name}-${productionDate}.pdf`);
  };

  const handleConfirmDelivery = async () => {
    if (!storeDetails) return;

    try {
      setSaving(true);
      setError(null);

      await updateDeliveryStatus(storeDetails.id, {
        deliveryConfirmed: true,
        received: receivedQuantities
      });

      await loadCurrentPlan();
    } catch (err) {
      console.error('Error confirming delivery:', err);
      setError(err instanceof Error ? err.message : 'Error confirming delivery');
    } finally {
      setSaving(false);
    }
  };

  const handleReportWaste = async () => {
    if (!storeDetails) return;

    try {
      setSaving(true);
      setError(null);

      await updateDeliveryStatus(storeDetails.id, {
        waste: wasteQuantities
      });

      await loadCurrentPlan();
    } catch (err) {
      console.error('Error reporting waste:', err);
      setError(err instanceof Error ? err.message : 'Error reporting waste');
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Gestion des Livraisons</h1>
        <p className="text-gray-600 mt-1">Gérer les livraisons et suivre les déchets</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
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
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Liste des magasins */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <TruckIcon className="h-5 w-5 mr-2 text-krispy-green" />
              Livraisons du Jour
            </h2>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {userStores.map((store) => (
                <button
                  key={store.id}
                  onClick={() => setSelectedStore(store.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    selectedStore === store.id
                      ? 'bg-krispy-green bg-opacity-10 border-l-4 border-krispy-green'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">{store.store_name}</span>
                    <span className={`text-sm inline-flex items-center px-2.5 py-0.5 rounded-full font-medium ${
                      store.delivery_confirmed
                        ? 'bg-krispy-green bg-opacity-10 text-krispy-green'
                        : 'bg-krispy-red bg-opacity-10 text-krispy-red'
                    }`}>
                      {store.delivery_confirmed ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Confirmé
                        </>
                      ) : (
                        <>
                          <Truck className="h-3 w-3 mr-1" />
                          En attente
                        </>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-gray-500">
                    {store.total_quantity} doughnuts prévus
                  </div>
                </button>
              ))}
              
              {userStores.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Aucune livraison prévue pour aujourd'hui
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Détails de livraison */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-krispy-green" />
              Détails de la Livraison
            </h2>
          </div>
          
          {selectedStore && storeDetails ? (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{storeDetails.store_name}</h3>
                  <p className="text-gray-500">Total : {storeDetails.total_quantity} doughnuts</p>
                </div>
                <div className="space-x-2">
                  {(isAdmin || isProduction) && (
                    <button
                      onClick={generateDeliveryBulletin}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green"
                    >
                      <Printer className="h-4 w-4 mr-1" />
                      Télécharger le Bulletin
                    </button>
                  )}
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variété</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Forme</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Prévu</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Reçu</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Déchets</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {storeDetails.production_items?.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.variety_name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {item.form_name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                          {!storeDetails.delivery_confirmed && (currentUser?.storeIds?.includes(storeDetails.store_id) || isAdmin || isProduction) ? (
                            <input
                              type="number"
                              min="0"
                              value={receivedQuantities[item.id] || item.quantity}
                              onChange={(e) => setReceivedQuantities({
                                ...receivedQuantities,
                                [item.id]: parseInt(e.target.value) || 0
                              })}
                              className="w-20 text-center border-gray-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm"
                            />
                          ) : (
                            item.received || '-'
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                          {storeDetails.delivery_confirmed && !storeDetails.waste_reported && (currentUser?.storeIds?.includes(storeDetails.store_id) || isAdmin || isProduction) ? (
                            <input
                              type="number"
                              min="0"
                              max={item.received || item.quantity}
                              value={wasteQuantities[item.id] || 0}
                              onChange={(e) => setWasteQuantities({
                                ...wasteQuantities,
                                [item.id]: parseInt(e.target.value) || 0
                              })}
                              className="w-20 text-center border-gray-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm"
                            />
                          ) : (
                            item.waste || '-'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Box information */}
              {storeDetails.box_productions && storeDetails.box_productions.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Boîtes</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Boîte</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {storeDetails.box_productions.map((box) => (
                          <tr key={box.id}>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              {box.box_name}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                              {box.quantity}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {storeDetails.delivery_confirmed && storeDetails.waste_reported && (
                <div className="mt-6 bg-krispy-green bg-opacity-5 border-l-4 border-krispy-green p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <Check className="h-5 w-5 text-krispy-green" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-krispy-green">
                        Livraison confirmée et déchets reportés
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {!storeDetails.delivery_confirmed && (currentUser?.storeIds?.includes(storeDetails.store_id) || isAdmin || isProduction) && (
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleConfirmDelivery}
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-krispy-green hover:bg-krispy-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Confirmation en cours...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Confirmer la Réception
                      </>
                    )}
                  </button>
                </div>
              )}
              
              {storeDetails.delivery_confirmed && !storeDetails.waste_reported && (currentUser?.storeIds?.includes(storeDetails.store_id) || isAdmin || isProduction) && (
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleReportWaste}
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-krispy-green hover:bg-krispy-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Enregistrement en cours...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Signaler les Déchets
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500">
              Sélectionnez un magasin pour voir les détails de livraison
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeliveryPage;