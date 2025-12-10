import React, { useState, useEffect } from 'react';
import { BarChart2, PieChart, TrendingUp, DollarSign, Store, Target, Package, Printer } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { productionService } from '../services/productionService';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';

// Helper: consistent number format for PDF (comma as thousands separator)
const formatNum = (n: number) => n.toLocaleString('en-US');

const getWeek = (date: Date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
};

interface ProductionData {
  date: string;
  production: number;
  waste: number;
  wastePercent: number;
  received: number;
  boxes: number;
  boxDoughnuts: number;
}

interface StorePerformance {
  id: string;
  name: string;
  production: number;
  received: number;
  waste: number;
  wastePercent: number;
  cost: number;
  wasteCost: number;
}

interface VarietyPopularity {
  id: string;
  name: string;
  quantity: number;
  percentage: number;
  formName?: string;
}

interface BoxPopularity {
  id: string;
  name: string;
  size: number;
  quantity: number;
  totalDoughnuts: number;
  percentage: number;
  varieties: Array<{
    name: string;
    quantity: number;
  }>;
  forms: string[];
}

interface PerformanceComparison {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  isIncrease: boolean;
}

const StatsPage: React.FC = () => {
  const { stores, varieties, boxes, forms } = useAdmin();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [selectedWeek, setSelectedWeek] = useState<number>(getWeek(new Date()));
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [productionData, setProductionData] = useState<ProductionData[]>([]);
  const [rawProductionPlans, setRawProductionPlans] = useState<any[]>([]); // Store raw plans data
  const [selectedStores, setSelectedStores] = useState<string[]>([]); // Add store filter
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
      const loadProductionData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1) Nombre de jours à charger selon la période
      let daysToFetch = 30;
      switch (selectedPeriod) {
        case 'day':
          daysToFetch = 8;
          break;
        case 'week':
          daysToFetch = 14;
          break;
        case 'month':
          daysToFetch = 62;
          break;
        case 'year':
          daysToFetch = 365;
          break;
      }

      // 2) Calculer une date de référence cohérente
      let referenceDateStr = selectedDate;

      if (selectedPeriod === 'day') {
        referenceDateStr = selectedDate;
      } else if (selectedPeriod === 'week') {
        const jan1 = new Date(selectedYear, 0, 1);
        const weekOffset = (selectedWeek - 1) * 7;
        const refDate = new Date(jan1);
        refDate.setDate(jan1.getDate() + weekOffset + 3);
        referenceDateStr = refDate.toISOString().split('T')[0];
      } else if (selectedPeriod === 'month') {
        const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0);
        referenceDateStr = lastDayOfMonth.toISOString().split('T')[0];
      } else if (selectedPeriod === 'year') {
        const lastDayOfYear = new Date(selectedYear, 11, 31);
        referenceDateStr = lastDayOfYear.toISOString().split('T')[0];
      }

      console.log(
        '📊 Stats – period:',
        selectedPeriod,
        'daysToFetch:',
        daysToFetch,
        'referenceDate:',
        referenceDateStr
      );

      // 3) Appel au service
      const plans = await productionService.getProductionPlans(
        daysToFetch.toString(),
        referenceDateStr
      );

      if (!plans || plans.length === 0) {
        setProductionData([]);
        setRawProductionPlans([]);
        return;
      }

      setRawProductionPlans(plans);

      // 4) Transformer les données
      const transformedData: ProductionData[] = plans.map((plan: any) => {
        let totalProduction = 0;
        let totalReceived = 0;
        let totalWaste = 0;
        let totalBoxes = 0;
        let totalBoxDoughnuts = 0;

        if (plan.stores && Array.isArray(plan.stores)) {
          plan.stores.forEach((store: any) => {
            totalProduction += store.total_quantity || 0;

            // Items individuels
            if (store.production_items && Array.isArray(store.production_items)) {
              store.production_items.forEach((item: any) => {
                if (item.received !== null && item.received !== undefined) {
                  totalReceived += item.received;
                }
                if (item.waste !== null && item.waste !== undefined) {
                  totalWaste += item.waste;
                }
              });
            }

            // Boxes
            if (store.box_productions && Array.isArray(store.box_productions)) {
              store.box_productions.forEach((box: any) => {
                const boxQuantity = box.quantity || 0;
                totalBoxes += boxQuantity;

                const boxConfig = boxes.find(b => b.name === box.box_name);
                const boxSize = boxConfig ? boxConfig.size : 12;
                const boxDoughnuts = boxQuantity * boxSize;
                totalBoxDoughnuts += boxDoughnuts;

                if (box.received !== null && box.received !== undefined) {
                  totalReceived += box.received * boxSize;
                }

                if (box.waste !== null && box.waste !== undefined) {
                  totalWaste += box.waste * boxSize;
                }
              });
            }
          });
        }

        const wastePercent =
          totalReceived > 0 ? (totalWaste / totalReceived) * 100 : 0;

        return {
          date: plan.date,
          production: totalProduction,
          received: totalReceived,
          waste: totalWaste,
          wastePercent,
          boxes: totalBoxes,
          boxDoughnuts: totalBoxDoughnuts,
        };
      });

      setProductionData(transformedData);
    } catch (err) {
      console.error('Error loading production data:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Error loading production data'
      );
    } finally {
      setLoading(false);
    }
  };       
  useEffect(() => {
    loadProductionData();
  }, [
    selectedPeriod,
    selectedDate,
    selectedWeek,
    selectedMonth,
    selectedYear,
    selectedStores
  ]);
      
      // Store the raw production plans data for real data extraction
      setRawProductionPlans(plans);
      
      // Transform production plans into detailed statistics data
      const transformedData: ProductionData[] = plans.map((plan: any) => {
        let totalProduction = 0;
        let totalReceived = 0;
        let totalWaste = 0;
        let totalBoxes = 0;
        let totalBoxDoughnuts = 0;
        
        if (plan.stores && Array.isArray(plan.stores)) {
          plan.stores.forEach((store: any) => {
            totalProduction += store.total_quantity || 0;
            
            // Calculate received quantities from individual items
            if (store.production_items && Array.isArray(store.production_items)) {
              store.production_items.forEach((item: any) => {
                if (item.received !== null && item.received !== undefined) {
                  totalReceived += item.received;
                } // else do not add planned quantity – received not yet reported
                
                if (item.waste !== null && item.waste !== undefined) {
                  totalWaste += item.waste;
                }
              });
            }
            
            // Calculate box quantities and their doughnut equivalents
            if (store.box_productions && Array.isArray(store.box_productions)) {
              store.box_productions.forEach((box: any) => {
                const boxQuantity = box.quantity || 0;
                totalBoxes += boxQuantity;
                
                // Find box configuration to get size
                const boxConfig = boxes.find(b => b.name === box.box_name);
                const boxSize = boxConfig ? boxConfig.size : 12; // Default to 12 if not found
                const boxDoughnuts = boxQuantity * boxSize;
                totalBoxDoughnuts += boxDoughnuts;
                
                if (box.received !== null && box.received !== undefined) {
                  totalReceived += box.received * boxSize;
                }
                
                if (box.waste !== null && box.waste !== undefined) {
                  totalWaste += box.waste * boxSize;
                }
              });
            }
          });
        }
        
        const wastePercent = totalReceived > 0 ? (totalWaste / totalReceived) * 100 : 0;
        
        return {
          date: plan.date,
          production: totalProduction,
          received: totalReceived,
          waste: totalWaste,
          wastePercent,
          boxes: totalBoxes,
          boxDoughnuts: totalBoxDoughnuts
        };
      });
      
      setProductionData(transformedData);
    } catch (err) {
      console.error('Error loading production data:', err);
      setError(err instanceof Error ? err.message : 'Error loading production data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProductionData();
  }, [selectedPeriod, selectedDate, selectedWeek, selectedMonth, selectedYear, selectedStores]);
  
  const getFilteredData = (): ProductionData[] => {
    if (!productionData || productionData.length === 0) return [];
    
    switch (selectedPeriod) {
      case 'day':
        return productionData.filter(item => {
          return item.date === selectedDate;
        });
        
      case 'week':
        return productionData.filter(item => {
          const itemDate = new Date(item.date);
          return getWeek(itemDate) === selectedWeek && 
                 itemDate.getFullYear() === selectedYear;
        });
        
      case 'month':
        return productionData.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate.getMonth() + 1 === selectedMonth && 
                 itemDate.getFullYear() === selectedYear;
        });
        
      case 'year':
        return productionData.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate.getFullYear() === selectedYear;
        });
        
      default:
        return productionData;
    }
  };
  
  const data = getFilteredData();
  
  // Calculate store performance from real data (this respects store filtering)
  const getStorePerformance = (): StorePerformance[] => {
    const storeStats: { [storeId: string]: StorePerformance } = {};
    
    // Get the filtered dates to match our current selection
    const filteredDates = data.map(d => d.date);
    
    // Initialize with active stores (filtered by selection if any)
    const relevantStores = stores.filter(store => {
      if (!store.isActive) return false;
      if (selectedStores.length > 0) {
        return selectedStores.includes(store.id);
      }
      return true;
    });
    
    relevantStores.forEach(store => {
      storeStats[store.id] = {
        id: store.id,
        name: store.name,
        production: 0,
        received: 0,
        waste: 0,
        wastePercent: 0,
        cost: 0,
        wasteCost: 0
      };
    });
    
    // Extract real data from production plans
    rawProductionPlans.forEach(plan => {
      // Only process plans that match our filtered date range
      if (!filteredDates.includes(plan.date)) return;
      
      if (plan.stores && Array.isArray(plan.stores)) {
        plan.stores.forEach((store: any) => {
          // Skip if store not in our filtered list
          if (!storeStats[store.store_id]) return;
          
          let storeProduction = 0;
          let storeReceived = 0;
          let storeWaste = 0;
          let storeCost = 0;
          let storeWasteCost = 0;
          
          // Process individual production items
          if (store.production_items && Array.isArray(store.production_items)) {
            store.production_items.forEach((item: any) => {
              const quantity = item.quantity || 0;
              // CRITICAL: Only use received quantity if delivery was confirmed, otherwise use 0
              const received = (item.received !== null && item.received !== undefined) ? item.received : 0;
              const waste = item.waste || 0;
              
              // Get variety-specific production cost from admin configuration
              const variety = varieties.find(v => v.id === item.variety_id);
              const varietyCost = variety?.productionCost || 0; // Use productionCost from admin config
              
              storeProduction += quantity;
              storeReceived += received;
              storeWaste += waste;
              
              // Calculate cost based on ACTUAL received quantity using admin-configured production cost
              const itemCost = received * varietyCost;
              storeCost += itemCost;
              
              // Calculate waste cost using the same variety cost
              const itemWasteCost = waste * varietyCost;
              storeWasteCost += itemWasteCost;
              
              // Debug logging for cost calculation
              if (received > 0) {
                console.log(`Variety Cost: ${variety?.name || 'Unknown'} - ${received} received × CHF ${varietyCost} = CHF ${itemCost.toFixed(2)}`);
              }
              if (waste > 0) {
                console.log(`Variety Waste Cost: ${variety?.name || 'Unknown'} - ${waste} waste × CHF ${varietyCost} = CHF ${itemWasteCost.toFixed(2)}`);
              }
            });
          }
          
          // Process box productions
          if (store.box_productions && Array.isArray(store.box_productions)) {
            store.box_productions.forEach((boxProd: any) => {
              const box = boxes.find(b => b.name === boxProd.box_name);
              if (box) {
                const boxQuantity = boxProd.quantity || 0;
                // CRITICAL: Only use received boxes if delivery was confirmed, otherwise use 0
                const receivedBoxes = (boxProd.received !== null && boxProd.received !== undefined) ? boxProd.received : 0;
                const wasteBoxes = boxProd.waste || 0;
                
                // Calculate box cost based on varieties configured in the box
                let boxUnitCost = 0;
                if (box.varieties && box.varieties.length > 0) {
                  box.varieties.forEach(boxVariety => {
                    const variety = varieties.find(v => v.id === boxVariety.varietyId);
                    if (variety) {
                      // Cost = variety production cost × quantity of this variety per box
                      const varietyCostPerBox = (variety.productionCost || 0) * boxVariety.quantity;
                      boxUnitCost += varietyCostPerBox;
                    }
                  });
                } else {
                  // Fallback if no varieties configured
                  boxUnitCost = 0.20;
                }
                
                const boxSize = box.size;
                storeProduction += boxQuantity * boxSize;
                storeReceived += receivedBoxes * boxSize;
                storeWaste += wasteBoxes * boxSize;
                
                // Calculate cost based on ACTUAL received boxes using calculated box unit cost
                const totalBoxCost = receivedBoxes * boxUnitCost;
                storeCost += totalBoxCost;
                
                // Calculate waste cost based on wasted boxes using the same box unit cost
                const totalBoxWasteCost = wasteBoxes * boxUnitCost;
                storeWasteCost += totalBoxWasteCost;
                
                // Debug logging for box cost calculation
                if (receivedBoxes > 0) {
                  console.log(`Box Cost: ${box.name} - ${receivedBoxes} boxes received × CHF ${boxUnitCost.toFixed(2)}/box = CHF ${totalBoxCost.toFixed(2)}`);
                  if (box.varieties && box.varieties.length > 0) {
                    console.log(`   Box composition:`);
                    box.varieties.forEach(boxVariety => {
                      const variety = varieties.find(v => v.id === boxVariety.varietyId);
                      if (variety) {
                        const varietyCostPerBox = (variety.productionCost || 0) * boxVariety.quantity;
                        console.log(`     - ${variety.name}: ${boxVariety.quantity} × CHF ${variety.productionCost || 0} = CHF ${varietyCostPerBox.toFixed(2)}`);
                      }
                    });
                  }
                }
                if (wasteBoxes > 0) {
                  console.log(`Box Waste Cost: ${box.name} - ${wasteBoxes} boxes wasted × CHF ${boxUnitCost.toFixed(2)}/box = CHF ${totalBoxWasteCost.toFixed(2)}`);
                }
              }
            });
          }
          
          // Update store stats
          storeStats[store.store_id].production += storeProduction;
          storeStats[store.store_id].received += storeReceived;
          storeStats[store.store_id].waste += storeWaste;
          storeStats[store.store_id].cost += storeCost;
          storeStats[store.store_id].wasteCost += storeWasteCost;
          
          // Debug logging for store totals
          if (storeCost > 0) {
            console.log(`Store ${store.store_name}: Total Production Cost = CHF ${storeCost.toFixed(2)}`);
          }
          if (storeWasteCost > 0) {
            console.log(`Store ${store.store_name}: Total Waste Cost = CHF ${storeWasteCost.toFixed(2)}`);
          }
        });
      }
    });
    
    // Calculate waste percentages
    Object.values(storeStats).forEach(store => {
      store.wastePercent = store.received > 0 ? (store.waste / store.received) * 100 : 0;
    });
    
    return Object.values(storeStats).filter(store => store.production > 0); // Only show stores with production
  };
  
  const storePerformance = getStorePerformance();
  
  // Calculate total waste costs using variety-specific and box-specific costs
  const getTotalWasteCost = (): number => {
    const filteredDates = data.map(d => d.date);
    let totalWasteCost = 0;
    
    rawProductionPlans.forEach(plan => {
      if (!filteredDates.includes(plan.date)) return;
      
      if (plan.stores && Array.isArray(plan.stores)) {
        plan.stores.forEach((store: any) => {
          // Skip if store not in our filtered list (respect store filtering)
          if (selectedStores.length > 0 && !selectedStores.includes(store.store_id)) {
            return;
          }
          
          // Calculate waste cost for individual production items
          if (store.production_items && Array.isArray(store.production_items)) {
            store.production_items.forEach((item: any) => {
              const waste = item.waste || 0;
              const variety = varieties.find(v => v.id === item.variety_id);
              const varietyCost = variety?.productionCost || 0; // Use admin-configured production cost
              
              totalWasteCost += waste * varietyCost;
            });
          }
          
          // Calculate waste cost for box productions
          if (store.box_productions && Array.isArray(store.box_productions)) {
            store.box_productions.forEach((boxProd: any) => {
              const box = boxes.find(b => b.name === boxProd.box_name);
              if (box) {
                const wasteBoxes = boxProd.waste || 0;
                
                // Calculate box cost based on varieties configured in the box (same as main calculation)
                let boxUnitCost = 0;
                if (box.varieties && box.varieties.length > 0) {
                  box.varieties.forEach(boxVariety => {
                    const variety = varieties.find(v => v.id === boxVariety.varietyId);
                    if (variety) {
                      const varietyCostPerBox = (variety.productionCost || 0) * boxVariety.quantity;
                      boxUnitCost += varietyCostPerBox;
                    }
                  });
                } else {
                  boxUnitCost = 0.20; // Fallback
                }
                
                totalWasteCost += wasteBoxes * boxUnitCost;
              }
            });
          }
        });
      }
    });
    
    return totalWasteCost;
  };
  
  // Enhanced statistics calculations - now respect store filtering
  const totalProduction = storePerformance.reduce((sum, store) => sum + store.production, 0);
  const totalReceived = storePerformance.reduce((sum, store) => sum + store.received, 0);
  const totalWaste = storePerformance.reduce((sum, store) => sum + store.waste, 0);
  const totalProductionCost = storePerformance.reduce((sum, store) => sum + store.cost, 0);
  const totalWasteCost = getTotalWasteCost();
  
  // Debug: Log comprehensive cost calculation summary
  console.log('=== PRODUCTION COST CALCULATION SUMMARY ===');
  console.log(`Total Stores with Production: ${storePerformance.length}`);
  console.log(`FORMULA IMPLEMENTATION:`);
  console.log(`   Doughnut cost = variety.productionCost (from Admin/Variétés) × received_quantity (from Delivery)`);
  console.log(`   Box cost = sum(variety.productionCost × variety_qty_per_box) × received_boxes (from Delivery)`);
  console.log(`   Total cost = doughnut cost + box cost`);
  console.log(`Store Performance Breakdown:`);
  storePerformance.forEach((store, index) => {
    console.log(`  ${index + 1}. ${store.name}:`);
    console.log(`     Production: ${store.production} doughnuts`);
    console.log(`     Received: ${store.received} doughnuts`);
    console.log(`     Cost: CHF ${store.cost.toFixed(2)} (based on admin-configured production costs & received quantities)`);
    console.log(`     Waste Cost: CHF ${store.wasteCost.toFixed(2)} (cost of wasted items)`);
  });
  console.log(`TOTAL PRODUCTION COST: CHF ${totalProductionCost.toFixed(2)}`);
  console.log(`Note: Uses exact admin configuration (productionCost) and delivery confirmation data`);
  console.log('=== END COST SUMMARY ===');
  
  // Calculate boxes totals from filtered store data 
  const getBoxTotals = () => {
    const filteredDates = data.map(d => d.date);
    let totalBoxes = 0;
    let totalBoxDoughnuts = 0;
    
    rawProductionPlans.forEach(plan => {
      if (!filteredDates.includes(plan.date)) return;
      
      if (plan.stores && Array.isArray(plan.stores)) {
        plan.stores.forEach((store: any) => {
          // Skip if store not in our filtered list (respect store filtering)
          if (selectedStores.length > 0 && !selectedStores.includes(store.store_id)) {
            return;
          }
          
          if (store.box_productions && Array.isArray(store.box_productions)) {
            store.box_productions.forEach((boxProd: any) => {
              const box = boxes.find(b => b.name === boxProd.box_name);
              if (box) {
                const boxQuantity = boxProd.quantity || 0;
                totalBoxes += boxQuantity;
                totalBoxDoughnuts += boxQuantity * box.size;
              }
            });
          }
        });
      }
    });
    
    return { totalBoxes, totalBoxDoughnuts };
  };
  
  const { totalBoxes, totalBoxDoughnuts } = getBoxTotals();
  const totalIndividualDoughnuts = totalProduction - totalBoxDoughnuts;
  const avgDailyProduction = Math.round(totalProduction / (data.length || 1));
  const avgWastePercent = totalReceived > 0 ? ((totalWaste / totalReceived) * 100).toFixed(2) : '0.00';
  
  // Cost calculations now use variety-specific and box-specific costs
  const avgDailyCost = totalProductionCost / (data.length || 1);
  const avgCostPerDonut = totalProduction > 0 ? totalProductionCost / totalProduction : 0;
  
  // Performance comparison (current period vs same period last week/month/year)
  const getPerformanceComparison = (): { production: PerformanceComparison; waste: PerformanceComparison } => {
    const currentData = data;
    let comparisonData: ProductionData[] = [];
    
    // Get comparison period data
    switch (selectedPeriod) {
      case 'day':
        // Compare with same day last week (7 days ago)
        const lastWeekDate = new Date(selectedDate);
        lastWeekDate.setDate(lastWeekDate.getDate() - 7);
        comparisonData = productionData.filter(item => item.date === lastWeekDate.toISOString().split('T')[0]);
        break;
      case 'week':
        // Compare with same week last year or previous week
        comparisonData = productionData.filter(item => {
          const itemDate = new Date(item.date);
          return getWeek(itemDate) === selectedWeek - 1 && itemDate.getFullYear() === selectedYear;
        });
        break;
      case 'month':
        // Compare with same month last year
        comparisonData = productionData.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate.getMonth() + 1 === selectedMonth && itemDate.getFullYear() === selectedYear - 1;
        });
        break;
      case 'year':
        // Compare with previous year
        comparisonData = productionData.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate.getFullYear() === selectedYear - 1;
        });
        break;
    }
    
    const currentProduction = currentData.reduce((sum, day) => sum + day.production, 0);
    const currentWaste = currentData.reduce((sum, day) => sum + day.waste, 0);
    const previousProduction = comparisonData.reduce((sum, day) => sum + day.production, 0);
    const previousWaste = comparisonData.reduce((sum, day) => sum + day.waste, 0);
    
    const productionChange = currentProduction - previousProduction;
    const wasteChange = currentWaste - previousWaste;
    
    return {
      production: {
        current: currentProduction,
        previous: previousProduction,
        change: productionChange,
        changePercent: previousProduction > 0 ? (productionChange / previousProduction) * 100 : 0,
        isIncrease: productionChange > 0
      },
      waste: {
        current: currentWaste,
        previous: previousWaste,
        change: wasteChange,
        changePercent: previousWaste > 0 ? (wasteChange / previousWaste) * 100 : 0,
        isIncrease: wasteChange > 0
      }
    };
  };
  
  const performanceComparison = getPerformanceComparison();
  
  // Real variety popularity from actual sales data (received - waste)
  const getRealVarietyPopularity = (): VarietyPopularity[] => {
    const varietyStats: { [varietyId: string]: { quantity: number; formName?: string } } = {};
    
    // Get the filtered dates to match our current selection
    const filteredDates = data.map(d => d.date);
    
    // Debug: Log that we're using real sales data
    console.log('Using 100% REAL SALES DATA for variety popularity (received - waste)');
    console.log('Filtered dates:', filteredDates);
    console.log('Raw production plans available:', rawProductionPlans.length);
    
    // Extract real variety sales data from raw production plans
    rawProductionPlans.forEach(plan => {
      // Only process plans that match our filtered date range
      if (!filteredDates.includes(plan.date)) return;
      
      if (plan.stores && Array.isArray(plan.stores)) {
        plan.stores.forEach((store: any) => {
          // Filter by selected stores if any are selected
          if (selectedStores.length > 0 && !selectedStores.includes(store.store_id)) {
            return;
          }
          
          // Process individual production items - use SALES quantities (received - waste)
          if (store.production_items && Array.isArray(store.production_items)) {
            store.production_items.forEach((item: any) => {
              const varietyId = item.variety_id;
              // Calculate sales: received - waste
              const received = (item.received !== null && item.received !== undefined) ? item.received : 0;
              const waste = item.waste || 0;
              const salesQuantity = received - waste;
              
              if (!varietyStats[varietyId]) {
                const variety = varieties.find(v => v.id === varietyId);
                const form = variety?.formId ? forms.find(f => f.id === variety.formId) : null;
                varietyStats[varietyId] = {
                  quantity: 0,
                  formName: form?.name
                };
              }
              
              varietyStats[varietyId].quantity += salesQuantity;
            });
          }
          
          // Process varieties from box productions - use SALES quantities
          if (store.box_productions && Array.isArray(store.box_productions)) {
            store.box_productions.forEach((boxProd: any) => {
              const box = boxes.find(b => b.name === boxProd.box_name);
              if (box && box.varieties && box.varieties.length > 0) {
                // Calculate sales boxes: received - waste
                const receivedBoxes = (boxProd.received !== null && boxProd.received !== undefined) ? boxProd.received : 0;
                const wasteBoxes = boxProd.waste || 0;
                const salesBoxes = receivedBoxes - wasteBoxes;
                
                box.varieties.forEach(boxVariety => {
                  const varietyId = boxVariety.varietyId;
                  const varietyQuantityFromSalesBoxes = boxVariety.quantity * salesBoxes;
                  
                  if (!varietyStats[varietyId]) {
                    const variety = varieties.find(v => v.id === varietyId);
                    const form = variety?.formId ? forms.find(f => f.id === variety.formId) : null;
                    varietyStats[varietyId] = {
                      quantity: 0,
                      formName: form?.name
                    };
                  }
                  
                  varietyStats[varietyId].quantity += varietyQuantityFromSalesBoxes;
                });
              }
            });
          }
        });
      }
    });
    
    // Debug: Log the real variety sales statistics
    console.log('Real variety SALES statistics:', varietyStats);
    
    const totalVarietySales = Object.values(varietyStats).reduce((sum, data) => sum + data.quantity, 0);
    console.log('Total variety SALES from real data:', totalVarietySales);
    
    return varieties
      .filter(v => v.isActive)
      .map(variety => ({
        id: variety.id,
        name: variety.name,
        quantity: varietyStats[variety.id]?.quantity || 0,
        percentage: totalVarietySales > 0 ? 
          Math.round(((varietyStats[variety.id]?.quantity || 0) / totalVarietySales) * 100) : 0,
        formName: varietyStats[variety.id]?.formName
      }))
      .filter(variety => variety.quantity > 0) // Only show varieties that were actually sold
      .sort((a, b) => b.quantity - a.quantity);
  };
  
  // Real box popularity from actual sales data (received - waste)
  const getRealBoxPopularity = (): BoxPopularity[] => {
    const boxStats: { [boxId: string]: { quantity: number; boxName: string } } = {};
    
    // Get the filtered dates to match our current selection
    const filteredDates = data.map(d => d.date);
    
    // Debug: Log that we're using real sales data
    console.log('Using 100% REAL SALES DATA for box popularity (received - waste)');
    console.log('Filtered dates:', filteredDates);
    console.log('Raw production plans available:', rawProductionPlans.length);
    
    // Extract real box sales data from raw production plans
    rawProductionPlans.forEach(plan => {
      // Only process plans that match our filtered date range
      if (!filteredDates.includes(plan.date)) return;
      
      if (plan.stores && Array.isArray(plan.stores)) {
        plan.stores.forEach((store: any) => {
          // Filter by selected stores if any are selected
          if (selectedStores.length > 0 && !selectedStores.includes(store.store_id)) {
            return;
          }
          
          if (store.box_productions && Array.isArray(store.box_productions)) {
            store.box_productions.forEach((boxProd: any) => {
              const boxName = boxProd.box_name;
              // Calculate sales boxes: received - waste
              const receivedBoxes = (boxProd.received !== null && boxProd.received !== undefined) ? boxProd.received : 0;
              const wasteBoxes = boxProd.waste || 0;
              const salesBoxes = receivedBoxes - wasteBoxes;
              
              // Find the box configuration by name
              const box = boxes.find(b => b.name === boxName);
              if (box) {
                if (!boxStats[box.id]) {
                  boxStats[box.id] = {
                    quantity: 0,
                    boxName: boxName
                  };
                }
                
                boxStats[box.id].quantity += salesBoxes;
              }
            });
          }
        });
      }
    });
    
    // Debug: Log the real box sales statistics
    console.log('Real box SALES statistics:', boxStats);
    
    const totalBoxSales = Object.values(boxStats).reduce((sum, data) => sum + data.quantity, 0);
    console.log('Total box SALES from real data:', totalBoxSales);
    
    return boxes
      .filter(box => box.isActive)
      .map(box => {
        const boxQuantity = boxStats[box.id]?.quantity || 0;
        const totalDoughnuts = boxQuantity * box.size;
        
        // Get varieties in this box
        const boxVarieties = box.varieties ? box.varieties.map(boxVariety => {
          const variety = varieties.find(v => v.id === boxVariety.varietyId);
          return {
            name: variety?.name || 'Unknown',
            quantity: boxVariety.quantity
          };
        }) : [];
        
        // Get unique forms from the varieties in this box
        const boxForms = box.varieties ? 
          [...new Set(box.varieties
            .map(boxVariety => {
              const variety = varieties.find(v => v.id === boxVariety.varietyId);
              if (variety && variety.formId) {
                const form = forms.find(f => f.id === variety.formId);
                return form?.name;
              }
              return null;
            })
            .filter(formName => formName !== null)
          )] : [];
        
        return {
          id: box.id,
          name: box.name,
          size: box.size,
          quantity: boxQuantity,
          totalDoughnuts,
          percentage: totalBoxSales > 0 ? 
            Math.round((boxQuantity / totalBoxSales) * 100) : 0,
          varieties: boxVarieties,
          forms: boxForms as string[]
        };
      })
      .filter(box => box.quantity > 0) // Only show boxes that were actually sold
      .sort((a, b) => b.quantity - a.quantity);
  };
  
  // Format data for production trend chart
  const getChartData = () => {
    return data.map(item => {
      const date = new Date(item.date);
      let formattedDate = '';
      
      switch (selectedPeriod) {
        case 'day':
          formattedDate = date.toLocaleDateString('fr-FR', { 
            day: '2-digit', 
            month: '2-digit' 
          });
          break;
        case 'week':
          formattedDate = `S${getWeek(date)}`;
          break;
        case 'month':
          formattedDate = date.toLocaleDateString('fr-FR', { 
            day: '2-digit', 
            month: 'short' 
          });
          break;
        case 'year':
          formattedDate = date.toLocaleDateString('fr-FR', { 
            month: 'short', 
            year: '2-digit' 
          });
          break;
      }
      
      return {
        date: formattedDate,
        fullDate: item.date,
        production: item.production,
        received: item.received,
        waste: item.waste,
        sales: item.received - item.waste
      };
    }).sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());
  };

  const chartData = getChartData();

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{`Date: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {`${entry.name}: ${entry.value?.toLocaleString()} ${entry.name === 'Ventes' ? 'vendus' : 'doughnuts'}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const varietyPopularity = getRealVarietyPopularity();
  const boxPopularity = getRealBoxPopularity();

  // Générer les options pour les semaines
  const getWeekOptions = () => {
    const options = [];
    for (let i = 1; i <= 53; i++) {
      options.push(
        <option key={i} value={i}>Semaine {i}</option>
      );
    }
    return options;
  };

  // Générer les options pour les mois
  const getMonthOptions = () => {
    const months = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    return months.map((month, index) => (
      <option key={index + 1} value={index + 1}>{month}</option>
    ));
  };

  // Générer les options pour les années
  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const options = [];
    for (let year = currentYear - 5; year <= currentYear; year++) {
      options.push(
        <option key={year} value={year}>{year}</option>
      );
    }
    return options;
  };

  // Helper function to validate real data extraction
  const validateRealDataExtraction = () => {
    const filteredDates = data.map(d => d.date);
    let totalVarietiesFromPlans = 0;
    let totalBoxesFromPlans = 0;
    
    rawProductionPlans.forEach(plan => {
      if (!filteredDates.includes(plan.date)) return;
      
      if (plan.stores && Array.isArray(plan.stores)) {
        plan.stores.forEach((store: any) => {
          if (store.production_items && Array.isArray(store.production_items)) {
            totalVarietiesFromPlans += store.production_items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
          }
          if (store.box_productions && Array.isArray(store.box_productions)) {
            totalBoxesFromPlans += store.box_productions.reduce((sum: number, box: any) => sum + (box.quantity || 0), 0);
          }
        });
      }
    });
    
    console.log('✅ Real Data Validation:');
    console.log('📊 Total individual doughnuts from plans:', totalVarietiesFromPlans);
    console.log('📦 Total boxes from plans:', totalBoxesFromPlans);
    console.log('📈 Aggregated individual doughnuts:', totalIndividualDoughnuts);
    console.log('📈 Aggregated boxes:', totalBoxes);
    console.log('🎯 Data consistency check:', {
      varietiesMatch: totalVarietiesFromPlans === totalIndividualDoughnuts,
      boxesMatch: totalBoxesFromPlans === totalBoxes
    });
  };

  // Call validation when data changes
  useEffect(() => {
    if (rawProductionPlans.length > 0 && data.length > 0) {
      validateRealDataExtraction();
    }
  }, [rawProductionPlans, data, totalIndividualDoughnuts, totalBoxes]);

  // Generate PDF Sales Report
  const generateSalesReport = () => {
    const doc = new jsPDF();
    
    // Set up the document
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Rapport de Ventes Détaillé par Magasin', 20, 25);
    
    // Add period information
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    
    let periodText = '';
    switch (selectedPeriod) {
      case 'day':
        periodText = `Jour: ${new Date(selectedDate).toLocaleDateString('fr-FR')}`;
        break;
      case 'week':
        periodText = `Semaine ${selectedWeek}, ${selectedYear}`;
        break;
      case 'month':
        const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
          'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        periodText = `${monthNames[selectedMonth - 1]} ${selectedYear}`;
        break;
      case 'year':
        periodText = `Année ${selectedYear}`;
        break;
    }
    
    doc.text(`Période: ${periodText}`, 20, 35);
    doc.text(`Généré le: ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 20, 45);
    
    // Filter stores if specific stores are selected
    const filteredStoreNames = selectedStores.length > 0 
      ? stores.filter(store => selectedStores.includes(store.id)).map(store => store.name)
      : ['Tous les magasins'];
    
    doc.setFontSize(10);
    doc.text(`Magasins: ${filteredStoreNames.join(', ')}`, 20, 55);
    
    // Get filtered dates to match our current selection
    const filteredDates = data.map(d => d.date);
    
    // Extract detailed sales data from raw production plans
    const detailedSalesData: Array<{
      storeName: string;
      variety: string;
      boxFormat: string;
      received: number;
      waste: number;
      sales: number;
    }> = [];
    
    rawProductionPlans.forEach(plan => {
      // Only process plans that match our filtered date range
      if (!filteredDates.includes(plan.date)) return;
      
      if (plan.stores && Array.isArray(plan.stores)) {
        plan.stores.forEach((store: any) => {
          // Filter by selected stores if any are selected
          if (selectedStores.length > 0 && !selectedStores.includes(store.store_id)) {
            return;
          }
          
          const storeName = store.store_name;
          
          // Process individual production items (varieties)
          if (store.production_items && Array.isArray(store.production_items)) {
            store.production_items.forEach((item: any) => {
              const variety = varieties.find(v => v.id === item.variety_id);
              const form = variety?.formId ? forms.find(f => f.id === variety.formId) : null;
              
              const received = item.received !== null && item.received !== undefined ? item.received : item.quantity;
              const waste = item.waste || 0;
              const sales = received - waste;
              
              detailedSalesData.push({
                storeName: storeName,
                variety: variety?.name || 'Variété inconnue',
                boxFormat: form?.name ? `Individuel (${form.name})` : 'Individuel',
                received: received,
                waste: waste,
                sales: sales
              });
            });
          }
          
          // Process box productions
          if (store.box_productions && Array.isArray(store.box_productions)) {
            store.box_productions.forEach((boxProd: any) => {
              const box = boxes.find(b => b.name === boxProd.box_name);
              const boxQuantity = boxProd.quantity || 0;
              
              if (box) {
                const boxSize = box.size;
                const receivedBoxes = boxProd.received !== null && boxProd.received !== undefined ? boxProd.received : boxQuantity;
                const wasteBoxes = boxProd.waste || 0;
                const salesBoxes = receivedBoxes - wasteBoxes;
                
                // Convert to doughnuts
                const receivedDoughnuts = receivedBoxes * boxSize;
                const wasteDoughnuts = wasteBoxes * boxSize;
                const salesDoughnuts = salesBoxes * boxSize;
                
                // Get varieties in this box for description
                const boxVarieties = box.varieties ? 
                  box.varieties.map(bv => {
                    const v = varieties.find(variety => variety.id === bv.varietyId);
                    return v?.name || 'Inconnue';
                  }).join(', ') : 'Non configurées';
                
                detailedSalesData.push({
                  storeName: storeName,
                  variety: boxVarieties,
                  boxFormat: `Boîte ${box.name} (${boxSize} unités)`,
                  received: receivedDoughnuts,
                  waste: wasteDoughnuts,
                  sales: salesDoughnuts
                });
              }
            });
          }
        });
      }
    });
    
    // Sort by store name, then by variety/box format
    detailedSalesData.sort((a, b) => {
      if (a.storeName !== b.storeName) {
        return a.storeName.localeCompare(b.storeName);
      }
      return a.variety.localeCompare(b.variety);
    });
    
    // Prepare table data
    const tableHeaders = [
      ['Magasin', 'Variété', 'Format', 'Reçu', 'Déchets', 'Ventes', '% Déchets']
    ];
    
    const tableData = detailedSalesData.map(row => [
      row.storeName,
      row.variety,
      row.boxFormat,
      formatNum(row.received),
      formatNum(row.waste),
      formatNum(row.sales),
      row.received > 0 ? ((row.waste / row.received) * 100).toFixed(1) + '%' : '0%'
    ]);
    
    // Add the table
    (doc as any).autoTable({
      startY: 70,
      head: tableHeaders,
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 2
      },
      headStyles: {
        fillColor: [34, 197, 94], // Green color
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 30 }, // Store name
        1: { cellWidth: 40 }, // Variety
        2: { cellWidth: 35 }, // Box format
        3: { cellWidth: 20, halign: 'center' }, // Received
        4: { cellWidth: 20, halign: 'center' }, // Waste
        5: { cellWidth: 20, halign: 'center' }, // Sales
        6: { cellWidth: 20, halign: 'center' } // Waste %
      }
    });
    
    // Add summary section
    const finalY = Math.max((doc as any).lastAutoTable?.finalY + 20, 120); // Ensure minimum Y position
    
    // Calculate totals
    const totals = detailedSalesData.reduce((acc, row) => ({
      received: acc.received + row.received,
      waste: acc.waste + row.waste,
      sales: acc.sales + row.sales
    }), {
      received: 0,
      waste: 0,
      sales: 0
    });
    
    // Calculate overall waste percentage for PDF summary
    const overallWastePercent = totals.received > 0 ? (totals.waste / totals.received) * 100 : 0;
    
    // Prepare summary data
    const summaryData = [
      ['Total Reçu:', formatNum(totals.received) + ' doughnuts'],
      ['Total Ventes:', formatNum(totals.sales) + ' doughnuts'],
      ['Total Déchets:', formatNum(totals.waste) + ' doughnuts (' + overallWastePercent.toFixed(1) + '%)'],
      ['Coût de Production:', 'CHF ' + totalProductionCost.toFixed(2)],
      ['Coût des Déchets:', 'CHF ' + totalWasteCost.toFixed(2)]
    ];
    
    // Check if we need a new page for the summary
    const summaryHeight = 60; // Approximate height needed for summary
    if (finalY + summaryHeight > 280) { // Page height limit
      doc.addPage();
      const newPageY = 30;
      
      // Summary box on new page
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Résumé Global', 20, newPageY);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      summaryData.forEach((row, index) => {
        doc.text(row[0], 20, newPageY + 15 + (index * 8));
        doc.text(row[1], 80, newPageY + 15 + (index * 8));
      });
    } else {
      // Summary box on same page
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Résumé Global', 20, finalY);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      summaryData.forEach((row, index) => {
        doc.text(row[0], 20, finalY + 15 + (index * 8));
        doc.text(row[1], 80, finalY + 15 + (index * 8));
      });
    }
    
    // Save the PDF
    const storeFilter = selectedStores.length > 0 ? `-${selectedStores.length}magasins` : '-tous-magasins';
    const filename = `rapport-ventes-detaille${storeFilter}-${periodText.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

  // Generate Individual Store PDF Report
  const generateStoreReport = (storeId: string) => {
    const store = storePerformance.find(s => s.id === storeId);
    if (!store) return;

    const doc = new jsPDF();
    
    // Set up the document
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`Rapport de Ventes - ${store.name}`, 20, 25);
    
    // Add period information
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    
    let periodText = '';
    switch (selectedPeriod) {
      case 'day':
        periodText = `Jour: ${new Date(selectedDate).toLocaleDateString('fr-FR')}`;
        break;
      case 'week':
        periodText = `Semaine ${selectedWeek}, ${selectedYear}`;
        break;
      case 'month':
        const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
          'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        periodText = `${monthNames[selectedMonth - 1]} ${selectedYear}`;
        break;
      case 'year':
        periodText = `Année ${selectedYear}`;
        break;
    }
    
    doc.text(`Période: ${periodText}`, 20, 35);
    doc.text(`Généré le: ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 20, 45);
    
    // Store overview
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Aperçu du Magasin', 20, 65);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const sales = store.received - store.waste;
    const overviewData = [
      ['Production Totale:', formatNum(store.production) + ' doughnuts'],
      ['Quantité Reçue:', formatNum(store.received) + ' doughnuts'],
      ['Ventes Réalisées:', formatNum(sales) + ' doughnuts'],
      ['Déchets:', formatNum(store.waste) + ' doughnuts (' + store.wastePercent.toFixed(1) + '%)'],
      ['Coût de Production:', 'CHF ' + store.cost.toFixed(2)],
      ['Coût des Déchets:', 'CHF ' + store.wasteCost.toFixed(2)]
    ];
    
    overviewData.forEach((row, index) => {
      doc.text(row[0], 20, 80 + (index * 8));
      doc.text(row[1], 80, 80 + (index * 8));
    });

    // Get detailed store data
    const filteredDates = data.map(d => d.date);
    const storeDetailedData: Array<{
      variety: string;
      boxFormat: string;
      received: number;
      waste: number;
      sales: number;
    }> = [];
    
    rawProductionPlans.forEach(plan => {
      if (!filteredDates.includes(plan.date)) return;
      
      if (plan.stores && Array.isArray(plan.stores)) {
        plan.stores.forEach((planStore: any) => {
          if (planStore.store_id !== storeId) return;
          
          // Process individual production items
          if (planStore.production_items && Array.isArray(planStore.production_items)) {
            planStore.production_items.forEach((item: any) => {
              const variety = varieties.find(v => v.id === item.variety_id);
              const form = variety?.formId ? forms.find(f => f.id === variety.formId) : null;
              
              const received = item.received !== null && item.received !== undefined ? item.received : item.quantity;
              const waste = item.waste || 0;
              const sales = received - waste;
              
              storeDetailedData.push({
                variety: variety?.name || 'Variété inconnue',
                boxFormat: form?.name ? `Individuel (${form.name})` : 'Individuel',
                received: received,
                waste: waste,
                sales: sales
              });
            });
          }
          
          // Process box productions
          if (planStore.box_productions && Array.isArray(planStore.box_productions)) {
            planStore.box_productions.forEach((boxProd: any) => {
              const box = boxes.find(b => b.name === boxProd.box_name);
              if (box) {
                const boxQuantity = boxProd.quantity || 0;
                const boxSize = box.size;
                const receivedBoxes = boxProd.received !== null && boxProd.received !== undefined ? boxProd.received : boxQuantity;
                const wasteBoxes = boxProd.waste || 0;
                const salesBoxes = receivedBoxes - wasteBoxes;
                
                const receivedDoughnuts = receivedBoxes * boxSize;
                const wasteDoughnuts = wasteBoxes * boxSize;
                const salesDoughnuts = salesBoxes * boxSize;
                
                const boxVarieties = box.varieties ? 
                  box.varieties.map(bv => {
                    const v = varieties.find(variety => variety.id === bv.varietyId);
                    return v?.name || 'Inconnue';
                  }).join(', ') : 'Non configurées';
                
                storeDetailedData.push({
                  variety: boxVarieties,
                  boxFormat: `Boîte ${box.name} (${boxSize} unités)`,
                  received: receivedDoughnuts,
                  waste: wasteDoughnuts,
                  sales: salesDoughnuts
                });
              }
            });
          }
        });
      }
    });

    // Add detailed breakdown table
    if (storeDetailedData.length > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Détail par Variété et Format', 20, 130);
      
      const tableHeaders = [
        ['Variété', 'Format', 'Reçu', 'Déchets', 'Ventes', '% Déchets']
      ];
      
      const tableData = storeDetailedData.map(row => [
        row.variety,
        row.boxFormat,
        formatNum(row.received),
        formatNum(row.waste),
        formatNum(row.sales),
        row.received > 0 ? ((row.waste / row.received) * 100).toFixed(1) + '%' : '0%'
      ]);
      
      (doc as any).autoTable({
        startY: 140,
        head: tableHeaders,
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 3
        },
        headStyles: {
          fillColor: [34, 197, 94],
          textColor: 255,
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 50 }, // Variety
          1: { cellWidth: 45 }, // Format
          2: { cellWidth: 25, halign: 'center' }, // Received
          3: { cellWidth: 25, halign: 'center' }, // Waste
          4: { cellWidth: 25, halign: 'center' }, // Sales
          5: { cellWidth: 25, halign: 'center' } // Waste %
        }
      });
    }

    // Save the PDF
    const filename = `rapport-magasin-${store.name.replace(/[^a-zA-Z0-9]/g, '-')}-${periodText.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

  // Format data for variety pie chart
  const getVarietyChartData = () => {
    return varietyPopularity.slice(0, 8).map((variety, _) => ({
      name: variety.name,
      value: variety.quantity,
      percentage: variety.percentage,
      formName: variety.formName
    }));
  };

  const varietyChartData = getVarietyChartData();
  
  // Colors for variety pie chart
  const VARIETY_COLORS = [
    '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', 
    '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6b7280'
  ];

  // Custom tooltip for variety chart
  const VarietyTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{data.name}</p>
          {data.formName && (
            <p className="text-xs text-gray-600">Forme: {data.formName}</p>
          )}
          <p className="text-sm text-krispy-green">
            {data.value.toLocaleString()} unités ({data.percentage}%)
          </p>
        </div>
      );
    }
    return null;
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
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Statistiques</h1>
          <p className="text-gray-600 mt-1">Analyse de la production et des coûts</p>
        </div>
        
        <div className="mt-4 sm:mt-0 space-y-4">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
          <div className="flex space-x-4">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
            >
              <option value="day">Par Jour</option>
              <option value="week">Par Semaine</option>
              <option value="month">Par Mois</option>
              <option value="year">Par Année</option>
            </select>

            {selectedPeriod === 'day' && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
              />
            )}

            {selectedPeriod === 'week' && (
              <div className="flex space-x-2">
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
                  className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                >
                  {getWeekOptions()}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                >
                  {getYearOptions()}
                </select>
              </div>
            )}

            {selectedPeriod === 'month' && (
              <div className="flex space-x-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                >
                  {getMonthOptions()}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                >
                  {getYearOptions()}
                </select>
              </div>
            )}

            {selectedPeriod === 'year' && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
              >
                {getYearOptions()}
              </select>
            )}
          </div>
            
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
              <div className="w-64">
                <label htmlFor="store-select" className="block text-xs font-medium text-gray-700 mb-1">
                  Magasins (laisser vide = tous)
                </label>
                <select
                  id="store-select"
                  multiple
                  value={selectedStores}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, option => option.value);
                    setSelectedStores(values);
                  }}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green text-sm"
                  style={{ minHeight: '38px' }}
                >
                  {stores.filter(store => store.isActive).map(store => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Ctrl+Click pour sélectionner plusieurs
                </p>
              </div>
            
              <button
                onClick={generateSalesReport}
                disabled={storePerformance.length === 0}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green disabled:opacity-50 disabled:cursor-not-allowed"
                title="Télécharger le rapport de ventes par magasin"
              >
                <Printer className="h-4 w-4 mr-2" />
                Rapport Ventes PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Production & Boxes Total */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-krispy-green">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Production Totale</p>
              <p className="text-2xl font-bold text-gray-900">{totalProduction.toLocaleString()}</p>
              <div className="text-sm text-gray-500 space-y-1">
                <p>Individuels: {totalIndividualDoughnuts.toLocaleString()}</p>
                <p>Boîtes: {totalBoxes.toLocaleString()} ({totalBoxDoughnuts.toLocaleString()} doughnuts)</p>
                <p className="text-xs">Moyenne: {avgDailyProduction.toLocaleString()}/jour</p>
              </div>
            </div>
            <div className="bg-krispy-green bg-opacity-10 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-krispy-green" />
            </div>
          </div>
        </div>
        
        {/* Waste Analysis */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-400">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Analyse des Déchets</p>
              <p className="text-2xl font-bold text-red-600">{avgWastePercent}%</p>
              <div className="text-sm text-gray-500 space-y-1">
                <p>Total: {totalWaste.toLocaleString()} doughnuts</p>
                <p className="text-red-600 font-medium">Coût: CHF {totalWasteCost.toFixed(2)}</p>
              </div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <BarChart2 className="h-6 w-6 text-red-500" />
            </div>
          </div>
        </div>
        
        {/* Production Cost */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-400">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Coût de Production</p>
              <p className="text-2xl font-bold text-blue-600">CHF {totalProductionCost.toFixed(2)}</p>
              <div className="text-sm text-gray-500 space-y-1">
                <p>Par doughnut: CHF {avgCostPerDonut.toFixed(2)}</p>
                <p>Moyenne/jour: CHF {avgDailyCost.toFixed(2)}</p>
              </div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-blue-500" />
            </div>
          </div>
        </div>
        
        {/* Performance Indicator */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-400">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Performance Globale</p>
              <div className="space-y-2">
                <div className="flex items-center">
                  <span className="text-sm text-gray-600 w-20">Production:</span>
                  <div className="flex items-center">
                    {performanceComparison.production.isIncrease ? (
                      <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                    ) : (
                      <TrendingUp className="h-4 w-4 text-red-500 mr-1 transform rotate-180" />
                    )}
                    <span className={`text-sm font-medium ${performanceComparison.production.isIncrease ? 'text-green-600' : 'text-red-600'}`}>
                      {performanceComparison.production.isIncrease ? '+' : ''}{performanceComparison.production.changePercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-gray-600 w-20">Déchets:</span>
                  <div className="flex items-center">
                    {performanceComparison.waste.isIncrease ? (
                      <TrendingUp className="h-4 w-4 text-red-500 mr-1" />
                    ) : (
                      <TrendingUp className="h-4 w-4 text-green-500 mr-1 transform rotate-180" />
                    )}
                    <span className={`text-sm font-medium ${performanceComparison.waste.isIncrease ? 'text-red-600' : 'text-green-600'}`}>
                      {performanceComparison.waste.isIncrease ? '+' : ''}{performanceComparison.waste.changePercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Comparé à la {selectedPeriod === 'day' ? 'semaine' : 'période'} précédente
              </p>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <BarChart2 className="h-6 w-6 text-purple-500" />
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-krispy-green" />
              Tendance de Production
            </h2>
          </div>
          <div className="p-6">
            {chartData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="production"
                      name="Production"
                      stackId="1"
                      stroke="#22c55e"
                      fill="#22c55e"
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey="received"
                      name="Reçu"
                      stackId="2"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey="sales"
                      name="Ventes"
                      stackId="3"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.8}
                    />
                    <Area
                      type="monotone"
                      dataKey="waste"
                      name="Déchets"
                      stackId="4"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center text-gray-500">
                  <BarChart2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-sm">Aucune donnée disponible pour la période sélectionnée</p>
                </div>
              </div>
            )}
            <div className="text-center text-sm text-gray-600 mt-4">
              Production journalière sur la période sélectionnée
              {data.length > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  {data.length} jour{data.length > 1 ? 's' : ''} de données disponibles
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <PieChart className="h-5 w-5 mr-2 text-krispy-green" />
              Popularité des Variétés
            </h2>
          </div>
          <div className="p-6">
            {varietyChartData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={varietyChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {varietyChartData.map((_, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={VARIETY_COLORS[index % VARIETY_COLORS.length]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<VarietyTooltip />} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center text-gray-500">
                  <PieChart className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-sm">Aucune donnée de variétés disponible pour la période sélectionnée</p>
                </div>
              </div>
            )}
            <div className="space-y-2 mt-4">
              {varietyPopularity.slice(0, 5).map((variety, index) => (
                <div key={variety.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className={`w-3 h-3 inline-block rounded-full mr-2 ${
                      index === 0 ? 'bg-krispy-green' :
                      index === 1 ? 'bg-krispy-green-light' :
                      index === 2 ? 'bg-krispy-green-dark' :
                      index === 3 ? 'bg-krispy-red' :
                      'bg-krispy-red-light'
                    }`}></span>
                    <div>
                    <span className="text-sm text-gray-600">{variety.name}</span>
                      {variety.formName && (
                        <div className="text-xs text-gray-400">Forme: {variety.formName}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                  <span className="text-sm text-gray-800 font-medium">{variety.percentage}%</span>
                    <div className="text-xs text-gray-500">{variety.quantity.toLocaleString()} unités</div>
                  </div>
                </div>
              ))}
              {varietyPopularity.length > 5 && (
                <div className="text-center pt-2">
                  <span className="text-xs text-gray-400">
                    +{varietyPopularity.length - 5} autres variétés
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Doughnut and Box Popularity Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Data Source Information */}
        {rawProductionPlans.length > 0 && (
          <div className="lg:col-span-2 mb-4">
            <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-lg">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">
                    <span className="font-medium">Données de ventes réelles:</span> Les statistiques de popularité ci-dessous utilisent les quantités réellement vendues (reçu - déchets) basées sur les données de livraison confirmées ({rawProductionPlans.length} plan{rawProductionPlans.length > 1 ? 's' : ''} chargé{rawProductionPlans.length > 1 ? 's' : ''}) pour la période sélectionnée.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Enhanced Doughnut Popularity */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                <Target className="h-5 w-5 mr-2 text-krispy-green" />
                Popularité des Doughnuts Individuels
                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Basé sur les ventes (quantités vendues)
                </span>
              </h2>
              <div className="text-sm text-gray-500">
                {varietyPopularity.length} variétés actives
              </div>
            </div>
          </div>
          <div className="p-6">
            {varietyPopularity.length > 0 ? (
              <div className="space-y-4">
                {varietyPopularity.map((variety, index) => {
                  const isTopPerformer = index < 3;
                  const dozens = Math.floor(variety.quantity / 12);
                  const units = variety.quantity % 12;
                  
                  return (
                    <div 
                      key={variety.id} 
                      className={`p-4 rounded-lg border-l-4 ${
                        index === 0 ? 'border-yellow-400 bg-yellow-50' :
                        index === 1 ? 'border-gray-400 bg-gray-50' :
                        index === 2 ? 'border-orange-400 bg-orange-50' :
                        'border-gray-200 bg-gray-25'
                      } ${isTopPerformer ? 'shadow-sm' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <span className={`text-lg font-bold ${
                              index === 0 ? 'text-yellow-600' :
                              index === 1 ? 'text-gray-600' :
                              index === 2 ? 'text-orange-600' :
                              'text-gray-500'
                            }`}>
                              #{index + 1}
                            </span>
                            {index === 0 && <span className="text-yellow-500">🥇</span>}
                            {index === 1 && <span className="text-gray-500">🥈</span>}
                            {index === 2 && <span className="text-orange-500">🥉</span>}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{variety.name}</h3>
                            {variety.formName && (
                              <p className="text-sm text-gray-600">Forme: {variety.formName}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center space-x-2">
                            <span className={`text-2xl font-bold ${
                              index === 0 ? 'text-yellow-600' :
                              index === 1 ? 'text-gray-600' :
                              index === 2 ? 'text-orange-600' :
                              'text-gray-700'
                            }`}>
                              {variety.percentage}%
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p className="font-medium">{variety.quantity.toLocaleString()} unités</p>
                            <div className="text-xs text-gray-500">
                              {dozens > 0 && `${dozens} douzaine${dozens > 1 ? 's' : ''}`}
                              {dozens > 0 && units > 0 && ' + '}
                              {units > 0 && `${units} unité${units > 1 ? 's' : ''}`}
                              {dozens === 0 && units === 0 && '0 unité'}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              index === 0 ? 'bg-yellow-400' :
                              index === 1 ? 'bg-gray-400' :
                              index === 2 ? 'bg-orange-400' :
                              'bg-gray-300'
                            }`}
                            style={{ width: `${variety.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Target className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-sm">Aucune donnée de variétés disponible pour la période sélectionnée</p>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Box Popularity */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                <Package className="h-5 w-5 mr-2 text-krispy-green" />
                Popularité des Boîtes
                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Basé sur les ventes (quantités vendues)
                </span>
              </h2>
              <div className="text-sm text-gray-500">
                {boxPopularity.length} types de boîtes
              </div>
            </div>
          </div>
          <div className="p-6">
            {boxPopularity.length > 0 ? (
              <div className="space-y-4">
                {boxPopularity.map((box, index) => {
                  const isTopPerformer = index < 3;
                  
                  return (
                    <div 
                      key={box.id} 
                      className={`p-4 rounded-lg border-l-4 ${
                        index === 0 ? 'border-purple-400 bg-purple-50' :
                        index === 1 ? 'border-blue-400 bg-blue-50' :
                        index === 2 ? 'border-green-400 bg-green-50' :
                        'border-gray-200 bg-gray-25'
                      } ${isTopPerformer ? 'shadow-sm' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <span className={`text-lg font-bold ${
                              index === 0 ? 'text-purple-600' :
                              index === 1 ? 'text-blue-600' :
                              index === 2 ? 'text-green-600' :
                              'text-gray-500'
                            }`}>
                              #{index + 1}
                            </span>
                            {index === 0 && <span className="text-purple-500">📦</span>}
                            {index === 1 && <span className="text-blue-500">📦</span>}
                            {index === 2 && <span className="text-green-500">📦</span>}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{box.name}</h3>
                            <p className="text-sm text-gray-600">{box.size} doughnuts par boîte</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center space-x-2">
                            <span className={`text-2xl font-bold ${
                              index === 0 ? 'text-purple-600' :
                              index === 1 ? 'text-blue-600' :
                              index === 2 ? 'text-green-600' :
                              'text-gray-700'
                            }`}>
                              {box.percentage}%
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p className="font-medium">{box.quantity.toLocaleString()} boîtes</p>
                            <p className="text-xs text-gray-500">{box.totalDoughnuts.toLocaleString()} doughnuts total</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              index === 0 ? 'bg-purple-400' :
                              index === 1 ? 'bg-blue-400' :
                              index === 2 ? 'bg-green-400' :
                              'bg-gray-300'
                            }`}
                            style={{ width: `${box.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      {/* Box Details */}
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          {/* Varieties in this box */}
                          <div>
                            <p className="font-medium text-gray-700 mb-1">Variétés configurées:</p>
                            {box.varieties.length > 0 ? (
                              <div className="space-y-1">
                                {box.varieties.map((variety, vIndex) => (
                                  <div key={vIndex} className="flex justify-between text-gray-600">
                                    <span>{variety.name}</span>
                                    <span>{variety.quantity}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">Aucune variété configurée</span>
                            )}
                          </div>
                          
                          {/* Forms used */}
                          <div>
                            <p className="font-medium text-gray-700 mb-1">Formes de doughnuts:</p>
                            {box.forms.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {box.forms.map((form, fIndex) => (
                                  <span 
                                    key={fIndex}
                                    className="inline-block px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                                  >
                                    {form}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">Aucune forme définie</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-sm">Aucune donnée de boîtes disponible pour la période sélectionnée</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <Store className="h-5 w-5 mr-2 text-krispy-green" />
            Performance des Magasins
          </h2>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Magasin</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Production Totale</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Reçu</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ventes (Reçu - Déchets)</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">% Déchets</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Coût Production</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Coût des Déchets</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {storePerformance.map(store => {
                  const productionPercent = totalProduction > 0 ? Math.round((store.production / totalProduction) * 100) : 0;
                  const sales = store.received - store.waste;
                  
                  return (
                    <tr key={store.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {store.name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                        {formatNum(store.production)}
                        <div className="text-xs text-gray-400">({productionPercent}%)</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                        {formatNum(store.received)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        <span className="font-medium text-krispy-green">{formatNum(sales)}</span>
                        <div className="text-xs text-gray-400">doughnuts vendus</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                        <span className={`${store.wastePercent > 10 ? 'text-red-600 font-medium' : store.wastePercent > 5 ? 'text-orange-600' : 'text-green-600'}`}>
                        {store.wastePercent.toFixed(1)}%
                        </span>
                        <div className="text-xs text-gray-400">{formatNum(store.waste)} déchets</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                        CHF {store.cost.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                        CHF {store.wasteCost.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        <button
                          onClick={() => generateStoreReport(store.id)}
                          className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green"
                          title={`Télécharger le rapport pour ${store.name}`}
                        >
                          <Printer className="h-3 w-3 mr-1" />
                          PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {storePerformance.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <div className="text-sm">Aucune donnée de production disponible pour la période sélectionnée</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatsPage;



