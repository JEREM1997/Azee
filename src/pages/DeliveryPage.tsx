import React, { useState, useEffect } from 'react';
import { Edit, Check, Printer, FileText, TruckIcon, AlertTriangle, Truck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { apiService } from '../services/apiService';

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
  id: string;                 // PK in store_productions or synthetic ID for orders
  store_id: string;           // FK to stores table
  store_name: string;         // Friendly name
  deliverydate?: string;      // YYYY-MM-DD, optional
  total_quantity: number;     // Sum of all varieties + boxes
  delivery_confirmed: boolean;
  waste_reported: boolean;
  production_items?: DeliveryProductionItem[];
  box_productions?: DeliveryBoxProduction[];
  production_date?: string;
  source_type?: 'plan' | 'order';
  source_label?: string;
  source_order_id?: string | null;
  customer_name?: string | null;
  company_name?: string | null;
  customer_phone?: string | null;
  handledBy?: string | null;
  deliveredBy?: string | null;
  comments?: string | null;
}

interface DeliveryProductionPlan {
  id: string;
  date: string;
  total_production: number;
  status: string;
  store_productions?: DeliveryStoreProduction[];
  delivery_entries?: DeliveryStoreProduction[];
}

const DeliveryPage: React.FC = () => {
  const { currentUser, isAdmin, isProduction, isStore } = useAuth();
  const { forms } = useAdmin();
  const [showAllStores, setShowAllStores] = useState(false);
  
  // Timezone-safe date formatting function
  const formatDateSafe = (dateStr: string) => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<DeliveryProductionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState<string>(() => {
    // Avoid timezone issues by creating date in local timezone
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  
  const [receivedQuantities, setReceivedQuantities] = useState<{ [key: string]: number }>({});
  const [wasteQuantities, setWasteQuantities] = useState<{ [key: string]: number }>({});
  const [boxReceivedQuantities, setBoxReceivedQuantities] = useState<{ [key: string]: number }>({});
  const [boxWasteQuantities, setBoxWasteQuantities] = useState<{ [key: string]: number }>({});
  
  // Function to initialize local state with current values from the plan
  const initializeLocalState = (stores: DeliveryStoreProduction[]) => {
    console.log('ðŸ”„ Initializing local state for', stores.length, 'stores');
    
    const newReceivedQuantities: { [key: string]: number } = {};
    const newWasteQuantities: { [key: string]: number } = {};
    const newBoxReceivedQuantities: { [key: string]: number } = {};
    const newBoxWasteQuantities: { [key: string]: number } = {};
    
    stores.forEach(store => {
      console.log(`ðŸª Store ${store.store_name}: delivery_confirmed=${store.delivery_confirmed}, waste_reported=${store.waste_reported}`);
      
      // Initialize production items
      store.production_items?.forEach(item => {
        if (item.received !== null && item.received !== undefined) {
          newReceivedQuantities[item.id] = item.received;
          console.log(`  ðŸ“¦ Item ${item.variety_name}: received=${item.received}`);
        }
        if (item.waste !== null && item.waste !== undefined) {
          newWasteQuantities[item.id] = item.waste;
          console.log(`  ðŸ—‘ï¸ Item ${item.variety_name}: waste=${item.waste}`);
        }
      });
      
      // Initialize box productions
      store.box_productions?.forEach(box => {
        if (box.received !== null && box.received !== undefined) {
          newBoxReceivedQuantities[box.id] = box.received;
          console.log(`  ðŸ“¦ Box ${box.box_name}: received=${box.received}`);
        }
        if (box.waste !== null && box.waste !== undefined) {
          newBoxWasteQuantities[box.id] = box.waste;
          console.log(`  ðŸ—‘ï¸ Box ${box.box_name}: waste=${box.waste}`);
        }
      });
    });
    
    console.log('ðŸ“Š Setting local state:', {
      receivedQuantities: Object.keys(newReceivedQuantities).length,
      wasteQuantities: Object.keys(newWasteQuantities).length,
      boxReceivedQuantities: Object.keys(newBoxReceivedQuantities).length,
      boxWasteQuantities: Object.keys(newBoxWasteQuantities).length
    });
    
    setReceivedQuantities(newReceivedQuantities);
    setWasteQuantities(newWasteQuantities);
    setBoxReceivedQuantities(newBoxReceivedQuantities);
    setBoxWasteQuantities(newBoxWasteQuantities);
  };
  
  const loadCurrentPlan = async () => {
    try {
      console.log('ðŸ”„ Loading current plan...');
      setLoading(true);
      setError(null);
      
      // Charger uniquement une fenÃªtre autour de la date de livraison sÃ©lectionnÃ©e (Â±15 jours)
      const rangeDays = 15;

      const selected = new Date(deliveryDate);

      // SÃ©curitÃ© au cas oÃ¹ deliveryDate serait vide ou invalide
      if (isNaN(selected.getTime())) {
        throw new Error(`Invalid deliveryDate: ${deliveryDate}`);
      }

      const start = new Date(selected);
      start.setDate(start.getDate() - rangeDays);

      const end = new Date(selected);
      end.setDate(end.getDate() + rangeDays);

      // On envoie des dates au format YYYY-MM-DD
      const startDate = start.toISOString().split('T')[0];
      const endDate = end.toISOString().split('T')[0];

      console.log('ðŸ“… Fetching plans from', startDate, 'to', endDate, 'for deliveryDate', deliveryDate);

      const { data: plans, error } = await apiService.production.getProductionPlans(
        startDate,
        endDate,
        showAllStores
      );
      
      if (error) {
        console.error('âŒ Error fetching plans:', error);
        setCurrentPlan(null);
        return;
      }
      
      if (!plans || plans.length === 0) {
        console.log('â„¹ï¸ No production plans found in the database');
        setCurrentPlan(null);
        return;
      }
      
      console.log(`ðŸ“‹ Found ${plans.length} plans from server`);
      
      // Process all stores from all plans
      const allStores: DeliveryStoreProduction[] = [];
      
      plans.forEach((plan: any) => {
        const deliveryEntries = Array.isArray(plan.delivery_entries)
          ? plan.delivery_entries
          : Array.isArray(plan.stores)
            ? plan.stores
            : [];

        if (deliveryEntries.length > 0) {
          deliveryEntries.forEach((store: any) => {
            // For each store, create a store production record
            allStores.push({
              id: store.id || `delivery:${plan.date}:${store.store_id}`,
              store_id: store.store_id,
              store_name: store.store_name,
              deliverydate: store.delivery_date || store.deliverydate || plan.date,
              total_quantity: store.total_quantity || 0,
              delivery_confirmed: store.delivery_confirmed || false,
              waste_reported: store.waste_reported || false,
              production_items: store.production_items || [],
              box_productions: store.box_productions || [],
              production_date: store.production_date || plan.date,
              source_type: store.source_type || 'plan',
              source_label: store.source_label || 'Plan habituel',
              source_order_id: store.source_order_id || null,
              customer_name: store.customer_name || null,
              company_name: store.company_name || null,
              customer_phone: store.customer_phone || null,
              handledBy: store.handled_by || store.handledBy || null,
              deliveredBy: store.delivered_by || store.deliveredBy || null,
              comments: store.comments || null,
            });
          });
        }
      });
      
      // Filter stores based on the selected delivery date and user permissions
      const filteredStores = allStores.filter(store => {
        // Normalize dates for comparison
        const normalize = (d: string) => d ? new Date(d).toISOString().split('T')[0] : '';
        const isMatchingDate = normalize(store.deliverydate || '') === normalize(deliveryDate);
        
        // Check if user has access to this store
        const hasAccess = isAdmin || isProduction || 
                         !currentUser?.storeIds || 
                         currentUser.storeIds.length === 0 || 
                         currentUser.storeIds.includes(store.store_id);
        
        return isMatchingDate && (showAllStores || hasAccess);
      });
      
      if (filteredStores.length > 0) {
        console.log(`âœ… Found ${filteredStores.length} stores for delivery date ${deliveryDate}`);
        
        // Calculate total production
        const totalProduction = filteredStores.reduce((sum, store) => sum + (store.total_quantity || 0), 0);
        
        // Create a map to ensure unique stores by ID
        const storeMap = new Map();
        filteredStores.forEach(store => {
          storeMap.set(store.id, store);
        });
        
        const uniqueStores = Array.from(storeMap.values());
        
        // Create the production plan with all stores
        setCurrentPlan({
          id: `delivery-${deliveryDate}`,
          date: deliveryDate,
          total_production: totalProduction,
          status: 'delivery',
          store_productions: uniqueStores
        });
        
        // Always initialize local state with the latest data
        initializeLocalState(uniqueStores);
      } else {
        console.log(`â„¹ï¸ No stores found for delivery date ${deliveryDate}`);
        setCurrentPlan(null);
      }
    } catch (err) {
      console.error('âŒ Error loading production plan:', err);
      setError(err instanceof Error ? err.message : 'Error loading production plan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentPlan();
  }, [deliveryDate, showAllStores]);

  // Effect to restore local state when component mounts or when plan changes
  // Only initialize state if it's empty to avoid overwriting user changes
  useEffect(() => {
    if (currentPlan?.store_productions) {
      // Only restore if local state is empty (initial load)
      const hasLocalState = Object.keys(receivedQuantities).length > 0 || 
                           Object.keys(wasteQuantities).length > 0 ||
                           Object.keys(boxReceivedQuantities).length > 0 ||
                           Object.keys(boxWasteQuantities).length > 0;
      
      if (!hasLocalState) {
        // Restore local state from the current plan
        const newReceivedQuantities: { [key: string]: number } = {};
        const newWasteQuantities: { [key: string]: number } = {};
        const newBoxReceivedQuantities: { [key: string]: number } = {};
        const newBoxWasteQuantities: { [key: string]: number } = {};
        
        currentPlan.store_productions.forEach(store => {
          store.production_items?.forEach(item => {
            if (item.received !== null && item.received !== undefined) {
              newReceivedQuantities[item.id] = item.received;
            }
            if (item.waste !== null && item.waste !== undefined) {
              newWasteQuantities[item.id] = item.waste;
            }
          });
          
          store.box_productions?.forEach(box => {
            if (box.received !== null && box.received !== undefined) {
              newBoxReceivedQuantities[box.id] = box.received;
            }
            if (box.waste !== null && box.waste !== undefined) {
              newBoxWasteQuantities[box.id] = box.waste;
            }
          });
        });
        
        // Update local state with server values only if no local changes exist
        setReceivedQuantities(newReceivedQuantities);
        setWasteQuantities(newWasteQuantities);
        setBoxReceivedQuantities(newBoxReceivedQuantities);
        setBoxWasteQuantities(newBoxWasteQuantities);
      }
    }
  }, [currentPlan]);

  // Effect to sync local state when selected store changes
  // Only merge server data if local state doesn't have values to preserve user input
  useEffect(() => {
    if (storeDetails && currentPlan) {
      // Update local state to reflect the current store's data
      const newReceivedQuantities: { [key: string]: number } = {};
      const newWasteQuantities: { [key: string]: number } = {};
      const newBoxReceivedQuantities: { [key: string]: number } = {};
      const newBoxWasteQuantities: { [key: string]: number } = {};
      
      // Initialize with current values from the store
      storeDetails.production_items?.forEach(item => {
        if (item.received !== null && item.received !== undefined) {
          newReceivedQuantities[item.id] = item.received;
        }
        if (item.waste !== null && item.waste !== undefined) {
          newWasteQuantities[item.id] = item.waste;
        }
      });
      
      storeDetails.box_productions?.forEach(box => {
        if (box.received !== null && box.received !== undefined) {
          newBoxReceivedQuantities[box.id] = box.received;
        }
        if (box.waste !== null && box.waste !== undefined) {
          newBoxWasteQuantities[box.id] = box.waste;
        }
      });
      
      // Merge with existing local state to preserve user input
      // Only update if the local state doesn't already have a value for that item
      setReceivedQuantities(prev => {
        const merged = { ...prev };
        Object.keys(newReceivedQuantities).forEach(key => {
          if (merged[key] === undefined) {
            merged[key] = newReceivedQuantities[key];
          }
        });
        return merged;
      });
      
      setWasteQuantities(prev => {
        const merged = { ...prev };
        Object.keys(newWasteQuantities).forEach(key => {
          if (merged[key] === undefined) {
            merged[key] = newWasteQuantities[key];
          }
        });
        return merged;
      });
      
      setBoxReceivedQuantities(prev => {
        const merged = { ...prev };
        Object.keys(newBoxReceivedQuantities).forEach(key => {
          if (merged[key] === undefined) {
            merged[key] = newBoxReceivedQuantities[key];
          }
        });
        return merged;
      });
      
      setBoxWasteQuantities(prev => {
        const merged = { ...prev };
        Object.keys(newBoxWasteQuantities).forEach(key => {
          if (merged[key] === undefined) {
            merged[key] = newBoxWasteQuantities[key];
          }
        });
        return merged;
      });
    }
  }, [selectedStore, currentPlan]);

  // Filter stores based on user role and store IDs
  const clean = (s:string)=>s.trim().toLowerCase();

  const allowedStoreIds = new Set(
    (currentUser?.storeIds || []).map(clean)
  );

  const userStoresUnsorted = currentPlan?.store_productions?.filter(store=>{
    if (isAdmin || isProduction) return true;
    if (showAllStores) return true;
    return allowedStoreIds.has(clean(store.store_id ?? ''));
  }) || [];

  const userStores = userStoresUnsorted.sort((a,b)=>a.store_name.localeCompare(b.store_name));

  const storeDetails = selectedStore 
    ? currentPlan?.store_productions?.find(store => store.id === selectedStore)
    : null;
  const isOrderDelivery = storeDetails?.source_type === 'order';
  const canManageSelectedDelivery = !!storeDetails && !isOrderDelivery && !!(
    currentUser?.storeIds?.includes(storeDetails.store_id) || isAdmin || isProduction
  );
  const canEditSelectedDelivery = !!storeDetails && !isOrderDelivery && !!(
    isAdmin || currentUser?.storeIds?.includes(storeDetails.store_id)
  );

  const generateDeliveryBulletin = () => {
    if (!storeDetails) return;

    const doc = new jsPDF();
    
    // Use the actual production plan date instead of current date
    const productionDate = storeDetails.production_date ? formatDateSafe(storeDetails.production_date) : formatDateSafe(currentPlan?.date ?? new Date().toISOString().split('T')[0]);
    
    // Use the store's delivery date if available, otherwise fall back to production date
    const deliveryDate = storeDetails.deliverydate ? formatDateSafe(storeDetails.deliverydate) : productionDate;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    
    const headers = [
      ['Type', storeDetails.source_label || 'Plan habituel'],
      ['Date de la production', productionDate],
      ['Date de livraison', deliveryDate],
      ['Magasin', storeDetails.store_name]
    ];

    if (storeDetails.source_order_id) {
      headers.push(['Commande', storeDetails.source_order_id]);
    }
    if (storeDetails.company_name) {
      headers.push(['Societe', storeDetails.company_name]);
    }
    if (storeDetails.customer_name) {
      headers.push(['Client', storeDetails.customer_name]);
    }
    if (storeDetails.customer_phone) {
      headers.push(['Telephone', storeDetails.customer_phone]);
    }
    if (storeDetails.handledBy) {
      headers.push(['Traitee par', storeDetails.handledBy]);
    }
    if (storeDetails.deliveredBy) {
      headers.push(['Livree par', storeDetails.deliveredBy]);
    }

     let currentY = 20;
    headers.forEach(([label, value]) => {
      const wrappedValue = doc.splitTextToSize(String(value), 105);
      doc.text(`${label}:`, 20, currentY);
      doc.text(wrappedValue, 70, currentY);
      currentY += Math.max(wrappedValue.length, 1) * 8;
    });

    // Add individual items table
    const itemsTableHeaders = [
      ['VariÃ©tÃ©', 'QuantitÃ© PrÃ©vue (unitÃ©)', 'QuantitÃ© ReÃ§ue (unitÃ©)', 'DÃ©chets (unitÃ©)']
    ];

    const itemsTableData = storeDetails.production_items?.slice().sort((a,b)=>a.variety_name.localeCompare(b.variety_name)).map(item => [
      item.variety_name,
      item.quantity.toString(),
      receivedQuantities[item.id]?.toString() || item.received?.toString() || '',
      wasteQuantities[item.id]?.toString() || item.waste?.toString() || ''
    ]) || [];

    (doc as any).autoTable({
      startY: currentY + 6,
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
        ['BoÃ®te', 'QuantitÃ© PrÃ©vue (unitÃ©)', 'QuantitÃ© ReÃ§ue (unitÃ©)', 'DÃ©chets (unitÃ©)']
      ];

      const boxesTableData = storeDetails.box_productions.slice().sort((a,b)=>a.box_name.localeCompare(b.box_name)).map(box => [
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
    if (storeDetails.comments) {
      doc.text(`Commentaire: ${storeDetails.comments}`, 20, finalY + 15);
    }
    doc.line(20, finalY + 30, 190, finalY + 30);
    doc.text('Signature:', 20, finalY + 40);

    // Update filename to include delivery date
    const fileDate = storeDetails.deliverydate ? formatDateSafe(storeDetails.deliverydate) : productionDate;
    const filePrefix = isOrderDelivery ? 'bulletin-livraison-commande' : 'bulletin-livraison';
    doc.save(`${filePrefix}-${storeDetails.store_name}-${fileDate}.pdf`);
  };

  const handleConfirmDelivery = async () => {
    if (!storeDetails) return;
    if (isOrderDelivery) {
      setError('La reception d une commande validee reste en lecture seule pour le moment. Le bulletin dedie est disponible.');
      return;
    }

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
          : item.quantity;
      });

      // For box productions
      storeDetails.box_productions?.forEach((box) => {
        finalBoxReceivedQuantities[box.id] = boxReceivedQuantities[box.id] !== undefined 
          ? boxReceivedQuantities[box.id] 
          : box.quantity;
      });

      const validationErrors: string[] = [];

      storeDetails.production_items?.forEach((item) => {
        // No validation on over-receipt at this stage
      });

      storeDetails.box_productions?.forEach((box) => {
        // No validation on over-receipt at this stage
      });

      if (validationErrors.length > 0) {
        setError(validationErrors.join('\n'));
        setSaving(false);
        return;
      }

      const { error } = await apiService.delivery.updateDeliveryStatus(storeDetails.id, {
        deliveryConfirmed: true,
        received: finalReceivedQuantities,
        boxReceived: finalBoxReceivedQuantities
      });

      if (error) throw error;

      // Update local state with the final quantities
      setReceivedQuantities(finalReceivedQuantities);
      setBoxReceivedQuantities(finalBoxReceivedQuantities);

      // Update the current plan state immediately to reflect changes
      if (currentPlan && storeDetails) {
        const updatedPlan = { ...currentPlan };
        const storeIndex = updatedPlan.store_productions?.findIndex(s => s.id === storeDetails.id);
        
        if (storeIndex !== undefined && updatedPlan.store_productions) {
          updatedPlan.store_productions[storeIndex] = {
            ...updatedPlan.store_productions[storeIndex],
            delivery_confirmed: true
          };
          
          // Update production items with received quantities
          if (updatedPlan.store_productions[storeIndex].production_items) {
            updatedPlan.store_productions[storeIndex].production_items = 
              updatedPlan.store_productions[storeIndex].production_items!.map(item => ({
                ...item,
                received: finalReceivedQuantities[item.id] ?? item.received ?? item.quantity
              }));
          }
          
          // Update box productions with received quantities
          if (updatedPlan.store_productions[storeIndex].box_productions) {
            updatedPlan.store_productions[storeIndex].box_productions = 
              updatedPlan.store_productions[storeIndex].box_productions!.map(box => ({
                ...box,
                received: finalBoxReceivedQuantities[box.id] ?? box.received ?? box.quantity
              }));
          }
          
          setCurrentPlan(updatedPlan);
        }
      }

      // Add a small delay to ensure server has processed the update
      console.log('âœ… Delivery confirmed, reloading plan in 500ms...');
      setTimeout(async () => {
        try {
          console.log('ðŸ”„ Reloading plan after delivery confirmation...');
          await loadCurrentPlan();
          console.log('âœ… Plan reloaded successfully');
        } catch (error) {
          console.error('Error reloading plan after delivery confirmation:', error);
          // Don't show error to user as the main operation succeeded
        }
      }, 500);
    } catch (err) {
      console.error('Error confirming delivery:', err);
      setError(err instanceof Error ? err.message : 'Error confirming delivery');
    } finally {
      setSaving(false);
    }
  };

  const handleReportWaste = async () => {
    if (!storeDetails) return;
    if (isOrderDelivery) {
      setError('Les dechets des commandes validees ne sont pas encore saisis separement. Utilisez le bulletin dedie.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Validate that for every item and box: planned = received + waste
      const validationErrors: string[] = [];

      storeDetails.production_items?.forEach((item) => {
        const planned = item.quantity;
        const received =
          receivedQuantities[item.id] !== undefined
            ? receivedQuantities[item.id]
            : item.received ?? planned;
        const waste =
          wasteQuantities[item.id] !== undefined
            ? wasteQuantities[item.id]
            : item.waste ?? 0;

        if (waste > received) {
          validationErrors.push(
            `${item.variety_name}: prÃ©vu ${planned}, reÃ§u ${received}, dÃ©chets ${waste}`
          );
        }
      });

      storeDetails.box_productions?.forEach((box) => {
        const planned = box.quantity;
        const received =
          boxReceivedQuantities[box.id] !== undefined
            ? boxReceivedQuantities[box.id]
            : box.received ?? planned;
        const waste =
          boxWasteQuantities[box.id] !== undefined
            ? boxWasteQuantities[box.id]
            : box.waste ?? 0;

        if (waste > received) {
          validationErrors.push(
            `${box.box_name}: prÃ©vu ${planned}, reÃ§u ${received}, dÃ©chets ${waste}`
          );
        }
      });

      if (validationErrors.length > 0) {
        setError(
          `Les dÃ©chets dÃ©passent les quantitÃ©s reÃ§ues pour:\n- ${validationErrors.join(
            '\n- '
          )}`
        );
        setSaving(false);
        return;
      }

      // Only save waste quantities since delivery must be confirmed first
      const updateData = {
        waste: wasteQuantities,
        boxWaste: boxWasteQuantities
      };

      const { error } = await apiService.delivery.updateDeliveryStatus(storeDetails.id, updateData);
      
      if (error) throw error;

      // Update the current plan state immediately to reflect changes
      if (currentPlan && storeDetails) {
        const updatedPlan = { ...currentPlan };
        const storeIndex = updatedPlan.store_productions?.findIndex(s => s.id === storeDetails.id);
        
        if (storeIndex !== undefined && updatedPlan.store_productions) {
          updatedPlan.store_productions[storeIndex] = {
            ...updatedPlan.store_productions[storeIndex],
            waste_reported: true
          };
          
          // Update production items with waste quantities
          if (updatedPlan.store_productions[storeIndex].production_items) {
            updatedPlan.store_productions[storeIndex].production_items = 
              updatedPlan.store_productions[storeIndex].production_items!.map(item => ({
                ...item,
                waste: wasteQuantities[item.id] ?? item.waste ?? 0
              }));
          }
          
          // Update box productions with waste quantities
          if (updatedPlan.store_productions[storeIndex].box_productions) {
            updatedPlan.store_productions[storeIndex].box_productions = 
              updatedPlan.store_productions[storeIndex].box_productions!.map(box => ({
                ...box,
                waste: boxWasteQuantities[box.id] ?? box.waste ?? 0
              }));
          }
          
          setCurrentPlan(updatedPlan);
        }
      }

      // Add a small delay to ensure server has processed the update
      console.log('âœ… Waste reported, reloading plan in 500ms...');
      setTimeout(async () => {
        try {
          console.log('ðŸ”„ Reloading plan after waste reporting...');
          await loadCurrentPlan();
          console.log('âœ… Plan reloaded successfully');
        } catch (error) {
          console.error('Error reloading plan after waste reporting:', error);
          // Don't show error to user as the main operation succeeded
        }
      }, 500);
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
        <div className="flex items-center space-x-4 flex-wrap">
        <h1 className="text-3xl font-bold text-gray-900">Gestion des Livraisons</h1>
        {(isAdmin || isProduction) && (
          <button
            onClick={() => setShowAllStores(prev => !prev)}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green"
          >
            {showAllStores ? 'Voir mes magasins' : 'Voir tous les magasins'}
          </button>
        )}
        </div>
        <p className="text-gray-600 mt-1">GÃ©rer les livraisons et suivre les dÃ©chets</p>

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
                      store.source_type === 'order'
                        ? 'bg-blue-100 text-blue-800'
                        : store.delivery_confirmed && store.waste_reported
                        ? 'bg-krispy-green bg-opacity-10 text-krispy-green'
                        : store.delivery_confirmed && !store.waste_reported
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {store.source_type === 'order' ? (
                        <>Commande</>
                      ) : store.delivery_confirmed && store.waste_reported ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          ConfirmÃ©
                        </>
                      ) : store.delivery_confirmed && !store.waste_reported ? (
                        <>
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          DÃ©chets en attente
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
                    {store.total_quantity} doughnuts prÃ©vus
                    {store.source_type === 'order' && (
                      <div className="text-xs text-blue-500 mt-1">
                        Bulletin de livraison dedie a la commande
                      </div>
                    )}
                    {store.deliverydate && (
                      <div className="text-xs text-gray-400 mt-1">
                        Livraison: {formatDateSafe(store.deliverydate)}
                      </div>
                    )}
                  </div>
                </button>
              ))}
              
              {userStores.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-sm">
                    Aucune livraison prÃ©vue pour le {formatDateSafe(deliveryDate)}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    SÃ©lectionnez une autre date pour voir les livraisons
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* DÃ©tails de livraison */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-krispy-green" />
              DÃ©tails de la Livraison
            </h2>
          </div>
          
          {selectedStore && storeDetails ? (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{storeDetails.store_name}</h3>
                  <div className="mt-1 space-y-1">
                  <p className="text-gray-500">Total : {storeDetails.total_quantity} doughnuts</p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Source:</span> {storeDetails.source_label || 'Plan habituel'}
                    </p>
                    {storeDetails.source_order_id && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Commande:</span> {storeDetails.source_order_id}
                      </p>
                    )}
                    {storeDetails.company_name && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Societe:</span> {storeDetails.company_name}
                      </p>
                    )}
                    {storeDetails.customer_name && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Client:</span> {storeDetails.customer_name}
                      </p>
                    )}
                    {storeDetails.handledBy && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Traitee par:</span> {storeDetails.handledBy}
                      </p>
                    )}
                    {storeDetails.deliveredBy && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Livree par:</span> {storeDetails.deliveredBy}
                      </p>
                    )}
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Date de livraison:</span> {
                        storeDetails.deliverydate ? formatDateSafe(storeDetails.deliverydate) : 'Non dÃ©finie'
                      }
                    </p>
                  </div>
                </div>
                <div className="space-x-2">
                  {(isAdmin || isProduction || currentUser?.storeIds?.includes(storeDetails.store_id)) && (
                    <button
                      onClick={generateDeliveryBulletin}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green"
                    >
                      <Printer className="h-4 w-4 mr-1" />
                      TÃ©lÃ©charger le Bulletin
                    </button>
                  )}
                </div>
              </div>
              
              <div className="overflow-x-auto">
                {isOrderDelivery && (
                  <div className="mb-4 bg-blue-50 border-l-4 border-blue-400 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <FileText className="h-5 w-5 text-blue-400" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-blue-700">
                        Cette ligne provient d une commande validee. Elle garde sa propre date de livraison, son propre bulletin, et elle est consideree comme recue a 100% avec 0 dechet.  
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {!isOrderDelivery && (!storeDetails.delivery_confirmed || !storeDetails.waste_reported) && canManageSelectedDelivery && (
                  <div className="mb-4 bg-blue-50 border-l-4 border-blue-400 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <Edit className="h-5 w-5 text-blue-400" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-blue-700">
                          <span className="font-medium">Processus de livraison:</span> 
                          {!storeDetails.delivery_confirmed && " 1. Confirmez d'abord la rÃ©ception en ajustant les quantitÃ©s reÃ§ues si nÃ©cessaire."}
                          {storeDetails.delivery_confirmed && !storeDetails.waste_reported && " 2. Vous pouvez maintenant signaler les dÃ©chets pour chaque variÃ©tÃ©."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">VariÃ©tÃ©</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Forme</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">PrÃ©vu (unitÃ©)</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">ReÃ§u (unitÃ©)</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">DÃ©chets (unitÃ©)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {storeDetails.production_items?.slice().sort((a,b)=>a.variety_name.localeCompare(b.variety_name)).map((item) => (
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
                          {!isOrderDelivery && !storeDetails.delivery_confirmed && canManageSelectedDelivery ? (
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
                              title={`QuantitÃ© prÃ©vue: ${item.quantity}. Ajustez si nÃ©cessaire.`}
                            />
                          ) : !isOrderDelivery && storeDetails.delivery_confirmed && canEditSelectedDelivery ? (
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
                              title={`Admin: Modifier la quantitÃ© reÃ§ue. QuantitÃ© prÃ©vue: ${item.quantity}.`}
                            />
                          ) : (
                            item.received !== null && item.received !== undefined 
                              ? item.received 
                              : (receivedQuantities[item.id] !== undefined ? receivedQuantities[item.id] : '-')
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                          {!isOrderDelivery && !storeDetails.waste_reported && storeDetails.delivery_confirmed && canManageSelectedDelivery ? (
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
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                const maxAllowed = item.received !== null && item.received !== undefined
                                  ? item.received
                                  : (receivedQuantities[item.id] !== undefined ? receivedQuantities[item.id] : item.quantity);
                                setWasteQuantities({
                                  ...wasteQuantities,
                                  [item.id]: Math.min(val, maxAllowed)
                                });
                              }}
                              className="w-20 text-center border-2 border-orange-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm bg-orange-50 hover:bg-white transition-colors"
                              title={`Maximum: ${
                                item.received !== null && item.received !== undefined 
                                  ? item.received 
                                  : (receivedQuantities[item.id] !== undefined ? receivedQuantities[item.id] : item.quantity)
                              } doughnuts`}
                            />
                          ) : !isOrderDelivery && storeDetails.waste_reported && canEditSelectedDelivery ? (
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
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                const maxAllowed = item.received !== null && item.received !== undefined
                                  ? item.received
                                  : (receivedQuantities[item.id] !== undefined ? receivedQuantities[item.id] : item.quantity);
                                setWasteQuantities({
                                  ...wasteQuantities,
                                  [item.id]: Math.min(val, maxAllowed)
                                });
                              }}
                              className="w-20 text-center border-2 border-red-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm bg-red-50 hover:bg-white transition-colors"
                              title={`Admin: Modifier les dÃ©chets. Maximum: ${
                                item.received !== null && item.received !== undefined 
                                  ? item.received 
                                  : (receivedQuantities[item.id] !== undefined ? receivedQuantities[item.id] : item.quantity)
                              } doughnuts`}
                            />
                          ) : isOrderDelivery ? (
                            item.waste ?? 0
                          ) : !storeDetails.delivery_confirmed ? (
                            <span className="text-gray-400 text-sm">Confirmez d'abord la rÃ©ception</span>
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
                  <h3 className="text-lg font-medium text-gray-900 mb-4">BoÃ®tes</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BoÃ®te</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">PrÃ©vu (unitÃ©)</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">ReÃ§u (unitÃ©)</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">DÃ©chets (unitÃ©)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {storeDetails.box_productions.slice().sort((a,b)=>a.box_name.localeCompare(b.box_name)).map((box) => (
                          <tr key={box.id}>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              {box.box_name}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                              {box.quantity}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                              {!isOrderDelivery && !storeDetails.delivery_confirmed && canManageSelectedDelivery ? (
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
                                  title={`QuantitÃ© prÃ©vue: ${box.quantity}. Ajustez si nÃ©cessaire.`}
                                />
                              ) : !isOrderDelivery && storeDetails.delivery_confirmed && canEditSelectedDelivery ? (
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
                                  title={`Admin: Modifier la quantitÃ© reÃ§ue. QuantitÃ© prÃ©vue: ${box.quantity}.`}
                                />
                              ) : (
                                box.received !== null && box.received !== undefined 
                                  ? box.received 
                                  : (boxReceivedQuantities[box.id] !== undefined ? boxReceivedQuantities[box.id] : '-')
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                              {!isOrderDelivery && !storeDetails.waste_reported && storeDetails.delivery_confirmed && canManageSelectedDelivery ? (
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
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    const maxAllowed = box.received !== null && box.received !== undefined
                                      ? box.received
                                      : (boxReceivedQuantities[box.id] !== undefined ? boxReceivedQuantities[box.id] : box.quantity);
                                    setBoxWasteQuantities({
                                      ...boxWasteQuantities,
                                      [box.id]: Math.min(val, maxAllowed)
                                    });
                                  }}
                                  className="w-20 text-center border-2 border-orange-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm bg-orange-50 hover:bg-white transition-colors"
                                  title={`Maximum: ${
                                    box.received !== null && box.received !== undefined 
                                      ? box.received 
                                      : (boxReceivedQuantities[box.id] !== undefined ? boxReceivedQuantities[box.id] : box.quantity)
                                  } boÃ®tes`}
                                />
                              ) : !isOrderDelivery && storeDetails.waste_reported && canEditSelectedDelivery ? (
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
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    const maxAllowed = box.received !== null && box.received !== undefined
                                      ? box.received
                                      : (boxReceivedQuantities[box.id] !== undefined ? boxReceivedQuantities[box.id] : box.quantity);
                                    setBoxWasteQuantities({
                                      ...boxWasteQuantities,
                                      [box.id]: Math.min(val, maxAllowed)
                                    });
                                  }}
                                  className="w-20 text-center border-2 border-red-300 rounded-md shadow-sm focus:ring-krispy-green focus:border-krispy-green sm:text-sm bg-red-50 hover:bg-white transition-colors"
                                  title={`Admin: Modifier les dÃ©chets. Maximum: ${
                                    box.received !== null && box.received !== undefined 
                                      ? box.received 
                                      : (boxReceivedQuantities[box.id] !== undefined ? boxReceivedQuantities[box.id] : box.quantity)
                                  } boÃ®tes`}
                                />
                              ) : isOrderDelivery ? (
                                box.waste ?? 0
                              ) : !storeDetails.delivery_confirmed ? (
                                <span className="text-gray-400 text-sm">Confirmez d'abord la rÃ©ception</span>
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
              
              {!isOrderDelivery && storeDetails.delivery_confirmed && storeDetails.waste_reported && (
                <div className="mt-6 bg-krispy-green bg-opacity-5 border-l-4 border-krispy-green p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <Check className="h-5 w-5 text-krispy-green" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-krispy-green">
                        Livraison confirmÃ©e et dÃ©chets reportÃ©s
                        {isAdmin && (
                          <span className="block text-xs text-gray-600 mt-1">
                            En tant qu'administrateur, vous pouvez modifier les quantitÃ©s ci-dessus si nÃ©cessaire.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {!isOrderDelivery && !storeDetails.delivery_confirmed && canManageSelectedDelivery && (
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
                        Confirmer la RÃ©ception
                      </>
                    )}
                  </button>
                </div>
              )}
              
              {!isOrderDelivery && storeDetails.delivery_confirmed && !storeDetails.waste_reported && canManageSelectedDelivery && (
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
                        Signaler les DÃ©chets
                      </>
                    )}
                  </button>
                </div>
              )}
              
              {!isOrderDelivery && storeDetails.delivery_confirmed && storeDetails.waste_reported && canEditSelectedDelivery && (
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={handleConfirmDelivery}
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Mise Ã  jour en cours...
                      </>
                    ) : (
                      <>
                        <Edit className="h-4 w-4 mr-2" />
                        Mettre Ã  jour les QuantitÃ©s ReÃ§ues
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
                        Mise Ã  jour en cours...
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Mettre Ã  jour les DÃ©chets
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500">
              SÃ©lectionnez un magasin pour voir les dÃ©tails de livraison
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeliveryPage;
