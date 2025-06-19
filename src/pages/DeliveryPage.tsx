import React, { useState, useEffect } from 'react';
import { Edit, Check, Printer, FileText, TruckIcon, AlertTriangle, Truck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { updateDeliveryStatus, getProductionPlans } from '../services/productionService';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Delivery-specific types
interface DeliveryProductionItem {
  id: string;
  variety_id: string;
  variety_name: string;
  form_id: string;
  form_name: string;
  quantity: number;
  received?: number;
  waste?: number;
}

interface DeliveryBoxProduction {
  id: string;
  box_id: string;
  box_name: string;
  quantity: number;
  received?: number;
  waste?: number;
}

interface DeliveryStoreProduction {
  id: string;
  store_id: string;
  store_name: string;
  deliverydate?: string;
  total_quantity: number;
  delivery_confirmed: boolean;
  waste_reported: boolean;
  production_items?: DeliveryProductionItem[];
  box_productions?: DeliveryBoxProduction[];
}

interface DeliveryProductionPlan {
  id: string;
  date: string;
  total_production: number;
  status: string;
  store_productions?: DeliveryStoreProduction[];
}

const DeliveryPage: React.FC = () => {
  const { currentUser, isAdmin, isProduction } = useAuth();
  const { forms } = useAdmin();
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<DeliveryProductionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [receivedQuantities, setReceivedQuantities] = useState<{ [key: string]: number }>({});
  const [wasteQuantities, setWasteQuantities] = useState<{ [key: string]: number }>({});
  const [boxReceivedQuantities, setBoxReceivedQuantities] = useState<{ [key: string]: number }>({});
  const [boxWasteQuantities, setBoxWasteQuantities] = useState<{ [key: string]: number }>({});
  
  const loadCurrentPlan = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load all recent production plans (last 7 days) to find stores with deliveries for the selected date
      const plans = await getProductionPlans(7);
      
      if (!plans || plans.length === 0) {
        setCurrentPlan(null);
        return;
      }
      
      // Find all stores that have deliveries scheduled for the selected delivery date
      const storesForDeliveryDate: DeliveryStoreProduction[] = [];
      
      plans.forEach((plan: any) => {
        if (plan.stores && Array.isArray(plan.stores)) {
          plan.stores.forEach((store: any) => {
            // Check if this store has a delivery date matching our selected date
            // If no delivery date is set, assume delivery is same day as production
            const storeDeliveryDate = store.deliverydate || plan.date;
            
            if (storeDeliveryDate === deliveryDate) {
              // Map the store data to match our interface
              const mappedStore: DeliveryStoreProduction = {
                id: store.id,
                store_id: store.store_id,
                store_name: store.store_name,
                deliverydate: store.deliverydate,
                total_quantity: store.total_quantity,
                delivery_confirmed: store.delivery_confirmed || false,
                waste_reported: store.waste_reported || false,
                production_items: store.production_items || [],
                box_productions: store.box_productions || []
              };
              storesForDeliveryDate.push(mappedStore);
            }
          });
        }
      });
      
      // Create a virtual plan for the delivery date with all matching stores
      if (storesForDeliveryDate.length > 0) {
        const totalProduction = storesForDeliveryDate.reduce((sum, store) => sum + store.total_quantity, 0);
        
        setCurrentPlan({
          id: `delivery-${deliveryDate}`,
          date: deliveryDate,
          total_production: totalProduction,
          status: 'delivery',
          store_productions: storesForDeliveryDate
        });
      } else {
        setCurrentPlan(null);
      }
      
      // Initialize received quantities from plan data
      if (storesForDeliveryDate.length > 0) {
        const quantities: { [key: string]: number } = {};
        const waste: { [key: string]: number } = {};
        const boxQuantities: { [key: string]: number } = {};
        const boxWaste: { [key: string]: number } = {};
        
        storesForDeliveryDate.forEach((store: DeliveryStoreProduction) => {
          store.production_items?.forEach((item: DeliveryProductionItem) => {
            if (item.received !== null && item.received !== undefined) quantities[item.id] = item.received;
            if (item.waste !== null && item.waste !== undefined) waste[item.id] = item.waste;
          });
          
          store.box_productions?.forEach((box: DeliveryBoxProduction) => {
            if (box.received !== null && box.received !== undefined) boxQuantities[box.id] = box.received;
            if (box.waste !== null && box.waste !== undefined) boxWaste[box.id] = box.waste;
          });
        });
        
        setReceivedQuantities(quantities);
        setWasteQuantities(waste);
        setBoxReceivedQuantities(boxQuantities);
        setBoxWasteQuantities(boxWaste);
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
  }, [deliveryDate]);

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
    
    // Use the actual production plan date instead of current date
    const productionDate = currentPlan?.date ? new Date(currentPlan.date).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');
    
    // Use the store's delivery date if available, otherwise fall back to production date
    const deliveryDate = storeDetails.deliverydate ? new Date(storeDetails.deliverydate).toLocaleDateString('fr-FR') : productionDate;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    
    const headers = [
      ['Date de la production', productionDate],
      ['Date de livraison', deliveryDate],
      ['Magasin', storeDetails.store_name]
    ];

    headers.forEach((row, i) => {
      doc.cell(14, 20 + (i * 10), 80, 10, row[0], i + 1, 'left');
      doc.cell(94, 20 + (i * 10), 80, 10, row[1], i + 1, 'left');
    });

    // Add individual items table
    const itemsTableHeaders = [
      ['Variété', 'Quantité Prévue (unité)', 'Quantité Reçue (unité)', 'Déchets (unité)']
    ];

    const itemsTableData = storeDetails.production_items?.map(item => [
      item.variety_name,
      item.quantity.toString(),
      receivedQuantities[item.id]?.toString() || item.received?.toString() || '',
      wasteQuantities[item.id]?.toString() || item.waste?.toString() || ''
    ]) || [];

    (doc as any).autoTable({
      startY: 60, // Adjusted to account for the extra header row
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
        ['Boîte', 'Quantité Prévue (unité)', 'Quantité Reçue (unité)', 'Déchets (unité)']
      ];

      const boxesTableData = storeDetails.box_productions.map(box => [
        box.box_name,
        box.quantity.toString(),
        boxReceivedQuantities[box.id]?.toString() || box.received?.toString() || '',
        boxWasteQuantities[box.id]?.toString() || box.waste?.toString() || ''
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

    // Update filename to include delivery date
    const fileDate = storeDetails.deliverydate ? new Date(storeDetails.deliverydate).toLocaleDateString('fr-FR') : productionDate;
    doc.save(`bulletin-livraison-${storeDetails.store_name}-${fileDate}.pdf`);
  };

  const handleConfirmDelivery = async () => {
    if (!storeDetails) return;

    try {
      setSaving(true);
      setError(null);

      // Prepare received quantities - use entered values or default to planned quantities
      const finalReceivedQuantities: { [key: string]: number } = {};
      const finalBoxReceivedQuantities: { [key: string]: number } = {};

      // For production items
      storeDetails.production_items?.forEach((item) => {
        finalReceivedQuantities[item.id] = receivedQuantities[item.id] !== undefined 
          ? receivedQuantities[item.id] 
          : item.quantity; // Default to planned quantity
      });

      // For box productions
      storeDetails.box_productions?.forEach((box) => {
        finalBoxReceivedQuantities[box.id] = boxReceivedQuantities[box.id] !== undefined 
          ? boxReceivedQuantities[box.id] 
          : box.quantity; // Default to planned quantity
      });

      await updateDeliveryStatus(storeDetails.id, {
        deliveryConfirmed: true,
        received: finalReceivedQuantities,
        boxReceived: finalBoxReceivedQuantities
      });

      // Update local state with the final quantities
      setReceivedQuantities(finalReceivedQuantities);
      setBoxReceivedQuantities(finalBoxReceivedQuantities);

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

      // Only save waste quantities since delivery must be confirmed first
      const updateData: any = {
        waste: wasteQuantities,
        boxWaste: boxWasteQuantities
      };

      await updateDeliveryStatus(storeDetails.id, updateData);

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
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
        <h1 className="text-3xl font-bold text-gray-900">Gestion des Livraisons</h1>
        <p className="text-gray-600 mt-1">Gérer les livraisons et suivre les déchets</p>
        </div>
        
        <div className="mt-4 md:mt-0">
          <div className="w-full md:w-auto">
            <label htmlFor="delivery-date" className="block text-sm font-medium text-gray-700 mb-1">
              Date de Livraison
            </label>
            <input
              type="date"
              id="delivery-date"
              name="delivery-date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="shadow-sm focus:ring-krispy-green focus:border-krispy-green block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
        </div>
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
                      store.delivery_confirmed && store.waste_reported
                        ? 'bg-krispy-green bg-opacity-10 text-krispy-green'
                        : store.delivery_confirmed && !store.waste_reported
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {store.delivery_confirmed && store.waste_reported ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Confirmé
                        </>
                      ) : store.delivery_confirmed && !store.waste_reported ? (
                        <>
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Déchets en attente
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
                    {store.deliverydate && (
                      <div className="text-xs text-gray-400 mt-1">
                        Livraison: {new Date(store.deliverydate).toLocaleDateString('fr-FR')}
                      </div>
                    )}
                  </div>
                </button>
              ))}
              
              {userStores.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-sm">
                    Aucune livraison prévue pour le {new Date(deliveryDate).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Sélectionnez une autre date pour voir les livraisons
                  </div>
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
                  <div className="mt-1 space-y-1">
                  <p className="text-gray-500">Total : {storeDetails.total_quantity} doughnuts</p>
                    {storeDetails.deliverydate && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Date de livraison:</span> {
                          new Date(storeDetails.deliverydate).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                        }
                      </p>
                    )}
                  </div>
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
                {(!storeDetails.delivery_confirmed || !storeDetails.waste_reported) && (currentUser?.storeIds?.includes(storeDetails.store_id) || isAdmin || isProduction) && (
                  <div className="mb-4 bg-blue-50 border-l-4 border-blue-400 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <Edit className="h-5 w-5 text-blue-400" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-blue-700">
                          <span className="font-medium">Processus de livraison:</span> 
                          {!storeDetails.delivery_confirmed && " 1. Confirmez d'abord la réception en ajustant les quantités reçues si nécessaire."}
                          {storeDetails.delivery_confirmed && !storeDetails.waste_reported && " 2. Vous pouvez maintenant signaler les déchets pour chaque variété."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variété</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Forme</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Prévu (unité)</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Reçu (unité)</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Déchets (unité)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {storeDetails.production_items?.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.variety_name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {forms.find(form => form.id === item.form_id)?.name || item.form_name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                          {!storeDetails.delivery_confirmed && (currentUser?.storeIds?.includes(storeDetails.store_id) || isAdmin || isProduction) ? (
                            <input
                              type="number"
                              min="0"
                              placeholder={item.quantity.toString()}
                              value={receivedQuantities[item.id] !== undefined ? receivedQuantities[item.id] : ''}
                              onChange={(e) => setReceivedQuantities({
                                ...receivedQuantities,
                                [item.id]: parseInt(e.target.value) || 0
                              })}
                              className="w-20 text-center border-2 border-blue-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm bg-blue-50 hover:bg-white transition-colors"
                              title={`Quantité prévue: ${item.quantity}. Ajustez si nécessaire.`}
                            />
                          ) : storeDetails.delivery_confirmed && isAdmin ? (
                            <input
                              type="number"
                              min="0"
                              placeholder={item.quantity.toString()}
                              value={receivedQuantities[item.id] !== undefined ? receivedQuantities[item.id] : (item.received !== null && item.received !== undefined ? item.received : '')}
                              onChange={(e) => setReceivedQuantities({
                                ...receivedQuantities,
                                [item.id]: parseInt(e.target.value) || 0
                              })}
                              className="w-20 text-center border-2 border-green-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm bg-green-50 hover:bg-white transition-colors"
                              title={`Admin: Modifier la quantité reçue. Quantité prévue: ${item.quantity}.`}
                            />
                          ) : (
                            // Show received quantity: prioritize database value, then local state, then dash
                            item.received !== null && item.received !== undefined 
                              ? item.received 
                              : (receivedQuantities[item.id] !== undefined ? receivedQuantities[item.id] : '-')
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                          {!storeDetails.waste_reported && storeDetails.delivery_confirmed && (currentUser?.storeIds?.includes(storeDetails.store_id) || isAdmin || isProduction) ? (
                            <input
                              type="number"
                              min="0"
                              max={
                                item.received !== null && item.received !== undefined 
                                  ? item.received 
                                  : (receivedQuantities[item.id] !== undefined ? receivedQuantities[item.id] : item.quantity)
                              }
                              placeholder="0"
                              value={wasteQuantities[item.id] !== undefined ? wasteQuantities[item.id] : ''}
                              onChange={(e) => setWasteQuantities({
                                ...wasteQuantities,
                                [item.id]: parseInt(e.target.value) || 0
                              })}
                              className="w-20 text-center border-2 border-orange-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm bg-orange-50 hover:bg-white transition-colors"
                              title={`Maximum: ${
                                item.received !== null && item.received !== undefined 
                                  ? item.received 
                                  : (receivedQuantities[item.id] !== undefined ? receivedQuantities[item.id] : item.quantity)
                              } doughnuts`}
                            />
                          ) : storeDetails.waste_reported && isAdmin ? (
                            <input
                              type="number"
                              min="0"
                              max={
                                item.received !== null && item.received !== undefined 
                                  ? item.received 
                                  : (receivedQuantities[item.id] !== undefined ? receivedQuantities[item.id] : item.quantity)
                              }
                              placeholder="0"
                              value={wasteQuantities[item.id] !== undefined ? wasteQuantities[item.id] : (item.waste !== null && item.waste !== undefined ? item.waste : '')}
                              onChange={(e) => setWasteQuantities({
                                ...wasteQuantities,
                                [item.id]: parseInt(e.target.value) || 0
                              })}
                              className="w-20 text-center border-2 border-red-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm bg-red-50 hover:bg-white transition-colors"
                              title={`Admin: Modifier les déchets. Maximum: ${
                                item.received !== null && item.received !== undefined 
                                  ? item.received 
                                  : (receivedQuantities[item.id] !== undefined ? receivedQuantities[item.id] : item.quantity)
                              } doughnuts`}
                            />
                          ) : !storeDetails.delivery_confirmed ? (
                            <span className="text-gray-400 text-sm">Confirmez d'abord la réception</span>
                          ) : (
                            wasteQuantities[item.id] !== undefined ? wasteQuantities[item.id] : (item.waste !== null && item.waste !== undefined ? item.waste : 0)
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
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Prévu (unité)</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Reçu (unité)</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Déchets (unité)</th>
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
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                              {!storeDetails.delivery_confirmed && (currentUser?.storeIds?.includes(storeDetails.store_id) || isAdmin || isProduction) ? (
                                <input
                                  type="number"
                                  min="0"
                                  placeholder={box.quantity.toString()}
                                  value={boxReceivedQuantities[box.id] !== undefined ? boxReceivedQuantities[box.id] : ''}
                                  onChange={(e) => setBoxReceivedQuantities({
                                    ...boxReceivedQuantities,
                                    [box.id]: parseInt(e.target.value) || 0
                                  })}
                                  className="w-20 text-center border-2 border-blue-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm bg-blue-50 hover:bg-white transition-colors"
                                  title={`Quantité prévue: ${box.quantity}. Ajustez si nécessaire.`}
                                />
                              ) : storeDetails.delivery_confirmed && isAdmin ? (
                                <input
                                  type="number"
                                  min="0"
                                  placeholder={box.quantity.toString()}
                                  value={boxReceivedQuantities[box.id] !== undefined ? boxReceivedQuantities[box.id] : (box.received !== null && box.received !== undefined ? box.received : '')}
                                  onChange={(e) => setBoxReceivedQuantities({
                                    ...boxReceivedQuantities,
                                    [box.id]: parseInt(e.target.value) || 0
                                  })}
                                  className="w-20 text-center border-2 border-green-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm bg-green-50 hover:bg-white transition-colors"
                                  title={`Admin: Modifier la quantité reçue. Quantité prévue: ${box.quantity}.`}
                                />
                              ) : (
                                // Show received quantity: prioritize database value, then local state, then dash
                                box.received !== null && box.received !== undefined 
                                  ? box.received 
                                  : (boxReceivedQuantities[box.id] !== undefined ? boxReceivedQuantities[box.id] : '-')
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                              {!storeDetails.waste_reported && storeDetails.delivery_confirmed && (currentUser?.storeIds?.includes(storeDetails.store_id) || isAdmin || isProduction) ? (
                                <input
                                  type="number"
                                  min="0"
                                  max={
                                    box.received !== null && box.received !== undefined 
                                      ? box.received 
                                      : (boxReceivedQuantities[box.id] !== undefined ? boxReceivedQuantities[box.id] : box.quantity)
                                  }
                                  placeholder="0"
                                  value={boxWasteQuantities[box.id] !== undefined ? boxWasteQuantities[box.id] : ''}
                                  onChange={(e) => setBoxWasteQuantities({
                                    ...boxWasteQuantities,
                                    [box.id]: parseInt(e.target.value) || 0
                                  })}
                                  className="w-20 text-center border-2 border-orange-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm bg-orange-50 hover:bg-white transition-colors"
                                  title={`Maximum: ${
                                    box.received !== null && box.received !== undefined 
                                      ? box.received 
                                      : (boxReceivedQuantities[box.id] !== undefined ? boxReceivedQuantities[box.id] : box.quantity)
                                  } boîtes`}
                                />
                              ) : storeDetails.waste_reported && isAdmin ? (
                                <input
                                  type="number"
                                  min="0"
                                  max={
                                    box.received !== null && box.received !== undefined 
                                      ? box.received 
                                      : (boxReceivedQuantities[box.id] !== undefined ? boxReceivedQuantities[box.id] : box.quantity)
                                  }
                                  placeholder="0"
                                  value={boxWasteQuantities[box.id] !== undefined ? boxWasteQuantities[box.id] : (box.waste !== null && box.waste !== undefined ? box.waste : '')}
                                  onChange={(e) => setBoxWasteQuantities({
                                    ...boxWasteQuantities,
                                    [box.id]: parseInt(e.target.value) || 0
                                  })}
                                  className="w-20 text-center border-2 border-red-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm bg-red-50 hover:bg-white transition-colors"
                                  title={`Admin: Modifier les déchets. Maximum: ${
                                    box.received !== null && box.received !== undefined 
                                      ? box.received 
                                      : (boxReceivedQuantities[box.id] !== undefined ? boxReceivedQuantities[box.id] : box.quantity)
                                  } boîtes`}
                                />
                              ) : !storeDetails.delivery_confirmed ? (
                                <span className="text-gray-400 text-sm">Confirmez d'abord la réception</span>
                              ) : (
                                boxWasteQuantities[box.id] !== undefined ? boxWasteQuantities[box.id] : (box.waste !== null && box.waste !== undefined ? box.waste : 0)
                              )}
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
                        {isAdmin && (
                          <span className="block text-xs text-gray-600 mt-1">
                            En tant qu'administrateur, vous pouvez modifier les quantités ci-dessus si nécessaire.
                          </span>
                        )}
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
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Enregistrement en cours...
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Signaler les Déchets
                      </>
                    )}
                  </button>
                </div>
              )}
              
              {storeDetails.delivery_confirmed && storeDetails.waste_reported && isAdmin && (
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={handleConfirmDelivery}
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Mise à jour en cours...
                      </>
                    ) : (
                      <>
                        <Edit className="h-4 w-4 mr-2" />
                        Mettre à jour les Quantités Reçues
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleReportWaste}
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Mise à jour en cours...
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Mettre à jour les Déchets
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