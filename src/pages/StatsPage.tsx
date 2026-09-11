import React, { useState, useEffect, useRef, useMemo } from 'react';
import KrispyKremeLoader from '../components/KrispyKremeLoader';
import { BarChart2, PieChart, TrendingUp, DollarSign, Store, Target, Package, Printer, Sparkles, SlidersHorizontal } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { apiService } from '../services/apiService';
import { productionService } from '../services/productionService';
import { buildDecisionPdf, buildSalesPdf } from '../pdf/reports';
import { loadPdfImage, type PdfImage } from '../pdf/pdfKit';
import kkOpsLogo from '../assets/digital_72_png-KK_logo_Red_Green_FNL.png';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import { MetricStrip } from '../components/PageExperience';
import StoreAnalyticsView from '../components/StoreAnalyticsView';
import { calculateProductMetrics, normalizeProductionPlans } from '../analytics/engine';
import { getComparisonWindows } from '../analytics/salesDate';
import { canExportStatistics, friendlyStatisticsError, loadStatisticsWindows, type BatchFailure } from '../services/statisticsLoader';

// Helper: consistent number format for PDF (comma as thousands separator)
const formatNum = (n: number) => n.toLocaleString('en-US');

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
  const { stores, varieties, boxes, forms, loading: adminLoading } = useAdmin();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'range' | 'month' | 'year'>('range');
  const [selectedStartDate, setSelectedStartDate] = useState<string>(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 55);
    return start.toISOString().split('T')[0];
  });
  const [selectedEndDate, setSelectedEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [productionData, setProductionData] = useState<ProductionData[]>([]);
  const [rawProductionPlans, setRawProductionPlans] = useState<any[]>([]); // Store raw plans data
  const [previousProductionPlans, setPreviousProductionPlans] = useState<any[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]); // Add store filter
  const [loading, setLoading] = useState(true);
  const [hasLoadedCriticalData, setHasLoadedCriticalData] = useState(false);
  const [kpiLoading, setKpiLoading] = useState(true);
  const requestIdRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [comparisonWarning, setComparisonWarning] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'success' | 'partial' | 'error'>('idle');
  const [loadProgress, setLoadProgress] = useState({ completed: 0, total: 0, label: '' });
  const [failedBatches, setFailedBatches] = useState<BatchFailure[]>([]);
  const [loadDiagnostics, setLoadDiagnostics] = useState<{ requests: number; rows: number; bytes: number; durationMs: number } | null>(null);
  const [kpiSnapshot, setKpiSnapshot] = useState<{
    snapshot_date: string;
    range_start: string;
    range_end: string;
    wape: number | null;
    bias: number | null;
    waste_rate: number | null;
    stockout_rate: number | null;
    observed_count: number | null;
  } | null>(null);

  const comparisonWindows = useMemo(() => getComparisonWindows({
    period: selectedPeriod,
    date: selectedDate,
    start: selectedStartDate,
    end: selectedEndDate,
    month: selectedMonth,
    year: selectedYear,
  }), [selectedPeriod, selectedDate, selectedStartDate, selectedEndDate, selectedMonth, selectedYear]);

  const getPlanEntries = (plan: any): any[] => {
    if (Array.isArray(plan?.delivery_entries) && plan.delivery_entries.length > 0) {
      return plan.delivery_entries;
    }

    if (Array.isArray(plan?.stores)) {
      return plan.stores;
    }

    return [];
  };

       // Single source of truth for production data fetching/transformations
  // (previous duplicate block removed to prevent double renders & undefined refs)
  const loadProductionData = async () => {
    const requestId = ++requestIdRef.current;
    try {
      setLoading(true);
      setLoadState('loading');
      setError(null);
      setComparisonWarning(null);
      setFailedBatches([]);
      setLoadProgress({ completed: 0, total: 0, label: '' });

      let startDateStr = comparisonWindows.current.start;
      let endDateStr = comparisonWindows.current.end;

      if (selectedPeriod === 'day') {
        startDateStr = selectedDate;
        endDateStr = selectedDate;
      } else if (selectedPeriod === 'range') {
        startDateStr = selectedStartDate;
        endDateStr = selectedEndDate;
      } else if (selectedPeriod === 'month') {
        const firstDayOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
        const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0);
        startDateStr = firstDayOfMonth.toISOString().split('T')[0];
        endDateStr = lastDayOfMonth.toISOString().split('T')[0];
      } else if (selectedPeriod === 'year') {
        const firstDayOfYear = new Date(selectedYear, 0, 1);
        const lastDayOfYear = new Date(selectedYear, 11, 31);
        startDateStr = firstDayOfYear.toISOString().split('T')[0];
        endDateStr = lastDayOfYear.toISOString().split('T')[0];
      }

      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        setError('Veuillez sélectionner une période valide.');
        setLoadState('error');
        setProductionData([]);
        setRawProductionPlans([]);
        return;
      }

      if (startDate > endDate) {
        setError('La date de début doit être antérieure ou égale à la date de fin.');
        setLoadState('error');
        setProductionData([]);
        setRawProductionPlans([]);
        return;
       }

      console.log(
        '📊 Stats – period:',
        selectedPeriod,
        'start:',
        startDateStr,
        'end:',
        endDateStr
      );

      const result = await loadStatisticsWindows({
        current: { start: startDateStr, end: endDateStr },
        previous: comparisonWindows.previous,
        fetchBatch: (start, end) => productionService.getProductionPlans(start, end),
        concurrency: 2,
        retries: 1,
        isStale: () => requestId !== requestIdRef.current,
        onProgress: progress => {
          if (requestId !== requestIdRef.current) return;
          setLoadProgress({ completed: progress.completed, total: progress.total, label: `${progress.batch.start} → ${progress.batch.end}` });
        },
      });

      const plans = result.current;
      const previousPlans = result.previous;
      setFailedBatches(result.failures);
      setLoadDiagnostics({ requests: result.requestCount, rows: result.rowCount, bytes: result.responseBytes, durationMs: result.durationMs });

      const currentFailures = result.failures.filter(failure => failure.scopes.includes('current'));
      const previousFailures = result.failures.filter(failure => failure.scopes.includes('previous'));
      if (currentFailures.length === result.batches.filter(batch => batch.scopes.includes('current')).length) {
        const first = currentFailures[0];
        throw Object.assign(new Error(`Impossible de charger les statistiques : ${friendlyStatisticsError(first)}`), { failures: currentFailures });
      }
      if (result.failures.length) {
        setLoadState('partial');
        const missing = result.failures.map(failure => `${failure.start} → ${failure.end}`).join(', ');
        setComparisonWarning(`Chargement partiel : périodes indisponibles ${missing}. Les recommandations sont suspendues.`);
      } else {
        setLoadState('success');
      }
      if (previousFailures.length && !currentFailures.length) {
        setComparisonWarning(`La période actuelle est complète, mais ${previousFailures.length} lot(s) de comparaison sont indisponibles. Les tendances sont suspendues.`);
      }

      if (requestId !== requestIdRef.current) return;

      if (plans.length === 0) {
        setProductionData([]);
        setRawProductionPlans([]);
        setPreviousProductionPlans([]);
        return;
      }

      const currentPlans = plans.filter((plan: any) => plan.date >= startDateStr && plan.date <= endDateStr);
      setRawProductionPlans(currentPlans);
      setPreviousProductionPlans(previousPlans);

      // 4) Transformer les données
      const transformedData: ProductionData[] = currentPlans.map((plan: any) => {
        let totalProduction = 0;
        let totalReceived = 0;
        let totalWaste = 0;
        let totalBoxes = 0;
        let totalBoxDoughnuts = 0;

        const planEntries = getPlanEntries(plan);
        if (planEntries.length > 0) {
          planEntries.forEach((store: any) => {
            totalProduction += store.total_quantity || 0;

            // Items individuels
            if (store.delivery_confirmed && store.waste_reported && store.production_items && Array.isArray(store.production_items)) {
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
            if (store.delivery_confirmed && store.waste_reported && store.box_productions && Array.isArray(store.box_productions)) {
              store.box_productions.forEach((box: any) => {
                const boxQuantity = box.quantity || 0;
                totalBoxes += boxQuantity;

                const boxConfig = boxes.find(b => b.id === box.box_id);
                if (!boxConfig) return;
                const boxSize = boxConfig.size;
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

      if (requestId === requestIdRef.current) {
        setProductionData(transformedData);
      }
    } catch (err) {
      console.error('Error loading production data:', err);
      if (requestId !== requestIdRef.current) return;
      if ((err as any)?.code === 'STALE_REQUEST') return;
      setLoadState('error');
      setError(
        err instanceof Error
          ? err.message
          : 'Error loading production data'
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setHasLoadedCriticalData(true);
      }
    }
  };
  useEffect(() => {
    if (adminLoading) return;
    loadProductionData();
  }, [
    selectedPeriod,
    selectedDate,
    selectedMonth,
    selectedYear,
    selectedStartDate,
    selectedEndDate,
    adminLoading,
    comparisonWindows.current.start,
    comparisonWindows.current.end,
    comparisonWindows.previous.start,
    comparisonWindows.previous.end,
  ]);

  useEffect(() => {
    const loadKpiSnapshot = async () => {
      try {
        const { data } = await apiService.production.getLatestForecastKpiSnapshot();
        setKpiSnapshot(data || null);
      } catch (err) {
        console.error('Error loading forecast KPI snapshot:', err);
        setKpiSnapshot(null);
      } finally {
        setKpiLoading(false);
      }
    };

    loadKpiSnapshot();
  }, []);

  const getFilteredData = (): ProductionData[] => {
    if (!productionData || productionData.length === 0) return [];

    switch (selectedPeriod) {
      case 'day':
        return productionData.filter(item => {
          return item.date === selectedDate;
        });

      case 'range':
        return productionData.filter(item => {
          const itemDate = new Date(item.date);
          const startDate = new Date(selectedStartDate);
          const endDate = new Date(selectedEndDate);
          return itemDate >= startDate && itemDate <= endDate;
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
  const productMetrics = useMemo(() => calculateProductMetrics(
    normalizeProductionPlans(rawProductionPlans, new Set(boxes.map(box => box.id))),
    normalizeProductionPlans(previousProductionPlans, new Set(boxes.map(box => box.id)))
  ), [rawProductionPlans, previousProductionPlans, boxes]);
  const safeProductMetrics = loadState === 'success' ? productMetrics : [];

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

      const planEntries = getPlanEntries(plan);
        if (planEntries.length > 0) {
          planEntries.forEach((store: any) => {
          // Skip if store not in our filtered list
          if (!storeStats[store.store_id]) return;

          let storeProduction = 0;
          let storeReceived = 0;
          let storeWaste = 0;
          let storeCost = 0;
          let storeWasteCost = 0;

          // Process individual production items
          if (store.delivery_confirmed && store.waste_reported && store.production_items && Array.isArray(store.production_items)) {
            store.production_items.forEach((item: any) => {
              const quantity = item.quantity || 0;
              // CRITICAL: Only use received quantity if delivery was confirmed, otherwise use 0
              const received = (item.received !== null && item.received !== undefined) ? item.received : 0;
              if (received === 0 || item.waste == null || item.waste < 0 || item.waste > received) return;
              const waste = item.waste;

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
          if (store.delivery_confirmed && store.waste_reported && store.box_productions && Array.isArray(store.box_productions)) {
            store.box_productions.forEach((boxProd: any) => {
              const box = boxes.find(b => b.name === boxProd.box_name);
              if (box) {
                const boxQuantity = boxProd.quantity || 0;
                // CRITICAL: Only use received boxes if delivery was confirmed, otherwise use 0
                const receivedBoxes = (boxProd.received !== null && boxProd.received !== undefined) ? boxProd.received : 0;
                if (receivedBoxes === 0 || boxProd.waste == null || boxProd.waste < 0 || boxProd.waste > receivedBoxes) return;
                const wasteBoxes = boxProd.waste;

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

      const planEntries = getPlanEntries(plan);
      if (planEntries.length > 0) {
        planEntries.forEach((store: any) => {
          // Skip if store not in our filtered list (respect store filtering)
          if (selectedStores.length > 0 && !selectedStores.includes(store.store_id)) {
            return;
          }

          // Calculate waste cost for individual production items
          if (store.delivery_confirmed && store.waste_reported && store.production_items && Array.isArray(store.production_items)) {
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

      const planEntries = getPlanEntries(plan);
      if (planEntries.length > 0) {
        planEntries.forEach((store: any) => {
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

    const currentProduction = currentData.reduce((sum, day) => sum + day.production, 0);
    const currentWaste = normalizeProductionPlans(rawProductionPlans).filter(row => row.quality === 'valid').reduce((sum, row) => sum + (row.waste || 0), 0);
    const previousProduction = previousProductionPlans.reduce((total, plan) => total + getPlanEntries(plan).reduce((sum, store) => sum + Number(store.total_quantity || 0), 0), 0);
    const previousWaste = normalizeProductionPlans(previousProductionPlans).filter(row => row.quality === 'valid').reduce((sum, row) => sum + (row.waste || 0), 0);

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

      const planEntries = getPlanEntries(plan);
      if (planEntries.length > 0) {
        planEntries.forEach((store: any) => {
          // Filter by selected stores if any are selected
          if (selectedStores.length > 0 && !selectedStores.includes(store.store_id)) {
            return;
          }

          // Process individual production items - use SALES quantities (received - waste)
          if (store.production_items && Array.isArray(store.production_items)) {
            store.production_items.forEach((item: any) => {
              const varietyId = item.variety_id;
              // Calculate sales: received - waste
              if (item.received == null || item.received <= 0 || item.waste == null || item.waste < 0 || item.waste > item.received) return;
              const received = item.received;
              const waste = item.waste;
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

          // Box contents are deliberately not counted as individual variety sales.
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

      const planEntries = getPlanEntries(plan);
      if (planEntries.length > 0) {
        planEntries.forEach((store: any) => {
          // Filter by selected stores if any are selected
          if (selectedStores.length > 0 && !selectedStores.includes(store.store_id)) {
            return;
          }

          if (store.delivery_confirmed && store.waste_reported && store.box_productions && Array.isArray(store.box_productions)) {
            store.box_productions.forEach((boxProd: any) => {
              const boxName = boxProd.box_name;
              // Calculate sales boxes: received - waste
              if (boxProd.received == null || boxProd.received <= 0 || boxProd.waste == null || boxProd.waste < 0 || boxProd.waste > boxProd.received) return;
              const receivedBoxes = boxProd.received;
              const wasteBoxes = boxProd.waste;
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
         case 'range':
          formattedDate = date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit'
           });
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

      const planEntries = getPlanEntries(plan);
      if (planEntries.length > 0) {
        planEntries.forEach((store: any) => {
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

  const [pdfProgress, setPdfProgress] = useState<string | null>(null);
  const [pdfMessage, setPdfMessage] = useState<string | null>(null);
  const reportContext = () => ({
    periodStart: comparisonWindows.current.start,
    periodEnd: comparisonWindows.current.end,
    scope: selectedStores.length ? stores.filter(store => selectedStores.includes(store.id)).map(store => store.name).join(', ') : 'Tous-magasins',
  });
  const eligibleObservations = () => normalizeProductionPlans(rawProductionPlans, new Set(boxes.map(box => box.id))).filter(observation => selectedStores.length === 0 || selectedStores.includes(observation.storeId));
  const runPdfGeneration = async (builder: (logo: PdfImage | null) => { doc: any; filename: string }) => {
    if (loadState !== 'success' || pdfProgress) { setPdfMessage('Impossible de générer le rapport : les statistiques sont incomplètes.'); return; }
    try {
      setPdfMessage(null); setPdfProgress('Préparation du rapport…');
      await new Promise(resolve => window.setTimeout(resolve, 0));
      const logo = await loadPdfImage(kkOpsLogo);
      setPdfProgress('Génération des tableaux…'); await new Promise(resolve => window.setTimeout(resolve, 0));
      const report = builder(logo);
      setPdfProgress('Finalisation du PDF…'); await new Promise(resolve => window.setTimeout(resolve, 0));
      report.doc.save(report.filename); setPdfMessage('Rapport téléchargé avec succès.');
    } catch (error) { console.error('PDF generation failed', error); setPdfMessage('Impossible de générer le rapport. Réessayez dans quelques instants.'); }
    finally { setPdfProgress(null); }
  };
  const generateSalesReport = () => runPdfGeneration(logo => buildSalesPdf(eligibleObservations(), { ...reportContext(), logo }));
  const generateStoreReport = (storeId: string) => {
    const store = stores.find(item => item.id === storeId); if (!store) return;
    return runPdfGeneration(logo => buildSalesPdf(eligibleObservations(), { ...reportContext(), scope: store.name, logo }, store.name));
  };
  const generateDecisionReport = (includeAnnex = false) => runPdfGeneration(logo => buildDecisionPdf(safeProductMetrics.filter(metric => selectedStores.length === 0 || selectedStores.includes(metric.storeId)), { ...reportContext(), logo }, includeAnnex));

  // Format data for variety pie chart
  const getVarietyChartData = () => {
    const primary = varietyPopularity.slice(0, 5).map((variety) => ({
      name: variety.name,
      value: variety.quantity,
      percentage: variety.percentage,
      formName: variety.formName
    }));
    const secondary = varietyPopularity.slice(5);
    if (secondary.length) {
      primary.push({
        name: `Autres (${secondary.length})`,
        value: secondary.reduce((total, variety) => total + variety.quantity, 0),
        percentage: secondary.reduce((total, variety) => total + variety.percentage, 0),
        formName: ''
      });
    }
    return primary;
  };

  const varietyChartData = getVarietyChartData();

  // Colors for variety pie chart
  const VARIETY_COLORS = [
    '#168151', '#3679b8', '#c47a10', '#9bafaa', '#bdc9c4', '#e1e7e4'
  ];

  const leadingVariety = varietyChartData[0];

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

  const isInitialCriticalLoading = adminLoading || (loading && !hasLoadedCriticalData);
  const beginFilterRefresh = () => setLoading(true);

  const retryFailedStatisticsBatches = async () => {
    if (!failedBatches.length) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadState('loading');
    const results = await Promise.allSettled(failedBatches.map(batch =>
      productionService.getProductionPlans(batch.start, batch.end)
    ));
    if (requestId !== requestIdRef.current) return;
    const remaining: BatchFailure[] = [];
    const currentRecovered: any[] = [];
    const previousRecovered: any[] = [];
    results.forEach((result, index) => {
      const batch = failedBatches[index];
      if (result.status === 'rejected') {
        remaining.push({ ...batch, message: result.reason?.message || batch.message });
        return;
      }
      if (batch.scopes.includes('current')) currentRecovered.push(...result.value);
      if (batch.scopes.includes('previous')) previousRecovered.push(...result.value);
    });
    const merge = (existing: any[], recovered: any[]) => [...new Map([...existing, ...recovered].map(plan => [plan.id || plan.date, plan])).values()];
    setRawProductionPlans(existing => merge(existing, currentRecovered));
    setPreviousProductionPlans(existing => merge(existing, previousRecovered));
    setFailedBatches(remaining);
    setComparisonWarning(remaining.length ? `Chargement encore partiel : ${remaining.map(batch => `${batch.start} → ${batch.end}`).join(', ')}.` : null);
    setLoadState(remaining.length ? 'partial' : 'success');
    setLoading(false);
  };

  if (isInitialCriticalLoading) {
    return <KrispyKremeLoader size="lg" label="Calcul des performances…" fullscreen />;
  }

  return (
    <div className="stats-page max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="stats-hero">
        <div className="stats-hero__copy">
          <p className="stats-hero__eyebrow"><Sparkles aria-hidden="true" /> Centre analytique</p>
          <h1>La performance du réseau, en un regard.</h1>
          <p>Ventes, déchets et tendances comparées pour détecter immédiatement les réussites et les points d’attention.</p>
        </div>

        <div className="stats-filters space-y-4"><div className="stats-filters__label"><SlidersHorizontal aria-hidden="true" /> Période & périmètre</div>
          <div className="stats-filters__controls">
          <div className="stats-filters__period">
            <select
              value={selectedPeriod}
              onChange={(e) => { beginFilterRefresh(); setSelectedPeriod(e.target.value as any); }}
              className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
            >
              <option value="day">Par Jour</option>
              <option value="range">Période personnalisée</option>
              <option value="month">Par Mois</option>
              <option value="year">Par Année</option>
            </select>

            {selectedPeriod === 'day' && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => { beginFilterRefresh(); setSelectedDate(e.target.value); }}
                className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
              />
            )}

            {selectedPeriod === 'range' && (
              <div className="flex space-x-2">
                <input
                  type="date"
                  value={selectedStartDate}
                  onChange={(e) => { beginFilterRefresh(); setSelectedStartDate(e.target.value); }}
                  className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
               />
                <input
                  type="date"
                  value={selectedEndDate}
                  onChange={(e) => { beginFilterRefresh(); setSelectedEndDate(e.target.value); }}
                  className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                />
              </div>
            )}

            {selectedPeriod === 'month' && (
              <div className="flex space-x-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => { beginFilterRefresh(); setSelectedMonth(parseInt(e.target.value)); }}
                  className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                >
                  {getMonthOptions()}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => { beginFilterRefresh(); setSelectedYear(parseInt(e.target.value)); }}
                  className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
                >
                  {getYearOptions()}
                </select>
              </div>
            )}

            {selectedPeriod === 'year' && (
              <select
                value={selectedYear}
                onChange={(e) => { beginFilterRefresh(); setSelectedYear(parseInt(e.target.value)); }}
                className="rounded-md border-gray-300 shadow-sm focus:border-krispy-green focus:ring-krispy-green"
              >
                {getYearOptions()}
              </select>
            )}
          </div>

            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
              <div className="stats-filters__stores">
                <label htmlFor="store-select" className="block text-xs font-medium text-gray-700 mb-1">
                  Magasins (laisser vide = tous)
                </label>
                <select
                  id="store-select"
                  multiple
                  value={selectedStores}
                  onChange={(e) => {
                    beginFilterRefresh();
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
                disabled={!canExportStatistics(loadState, storePerformance.length)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green disabled:opacity-50 disabled:cursor-not-allowed"
                title="Télécharger le rapport de ventes par magasin"
              >
                <Printer className="h-4 w-4 mr-2" />
                Rapport Ventes PDF
              </button>
            </div>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="stats-refresh" role="status" aria-live="polite">
          <KrispyKremeLoader size="md" label={loadProgress.total > 0 ? `Chargement des statistiques : ${loadProgress.completed} période${loadProgress.completed > 1 ? 's' : ''} sur ${loadProgress.total} (${loadProgress.label})` : 'Préparation du chargement des statistiques…'} />
        </div>
      ) : (
      <div className="stats-content-ready">

      {loadState === 'error' ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6" role="alert">
          <h2 className="text-lg font-bold text-red-900">Statistiques indisponibles</h2>
          <p className="mt-2 text-sm text-red-800">{error || 'Impossible de charger les statistiques.'}</p>
          <p className="mt-2 text-sm text-red-700">Aucune valeur à zéro ni aucun export ne sont présentés comme réels.</p>
          <button onClick={loadProductionData} className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">Réessayer</button>
        </div>
      ) : (<>

      <MetricStrip items={[
        { label: 'Ventes potentielles', value: totalProduction.toLocaleString('fr-FR'), detail: 'doughnuts sur la période', tone: 'green' },
        { label: 'Réception', value: totalReceived.toLocaleString('fr-FR'), detail: 'unités confirmées', tone: 'blue' },
        { label: 'Déchets', value: `${avgWastePercent}%`, detail: `${totalWaste.toLocaleString('fr-FR')} unités`, tone: Number(avgWastePercent) > 10 ? 'red' : Number(avgWastePercent) > 6 ? 'amber' : 'green' },
        { label: 'Coût production', value: `CHF ${totalProductionCost.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}`, detail: `CHF ${avgCostPerDonut.toFixed(2)} / unité`, tone: 'violet' }
      ]} />

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

      {comparisonWarning && !error && (
        <div className="mb-6 border-l-4 border-amber-400 bg-amber-50 p-4 text-sm text-amber-900" role="status">
          <p>{comparisonWarning}</p>
          {failedBatches.length > 0 && <button onClick={retryFailedStatisticsBatches} className="mt-2 rounded-md border border-amber-500 px-3 py-1.5 font-semibold hover:bg-amber-100">Relancer uniquement les lots échoués</button>}
        </div>
      )}

      {loadDiagnostics && <p className="mb-4 text-right text-xs text-gray-500">{loadDiagnostics.requests} requête(s) · {loadDiagnostics.rows} plan(s) · {(loadDiagnostics.bytes / 1024).toFixed(1)} Ko · {(loadDiagnostics.durationMs / 1000).toFixed(1)} s</p>}

      {(pdfProgress || pdfMessage) && <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${pdfProgress ? 'border-green-200 bg-green-50 text-green-900' : 'border-gray-200 bg-white text-gray-700'}`} role="status" aria-live="polite">{pdfProgress || pdfMessage}</div>}

       {kpiLoading ? (
        <div className="forecast-panel mb-6 rounded-lg p-4" role="status" aria-label="Chargement des indicateurs prévisionnels">
          <div className="skeleton-bone h-5 w-64 max-w-full" />
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map(item => <div className="skeleton-bone h-16 rounded" key={item} />)}
          </div>
        </div>
       ) : kpiSnapshot && (
        <div className="forecast-panel mb-6 rounded-lg p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-violet-900">KPI Forecast (dernier snapshot)</h2>
            <span className="text-xs text-violet-700">
              {kpiSnapshot.snapshot_date} • {kpiSnapshot.range_start} → {kpiSnapshot.range_end}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded bg-white p-3 text-sm"><span className="text-gray-500">WAPE</span><div className="font-semibold">{(kpiSnapshot.wape ?? 0).toFixed(2)}%</div></div>
            <div className="rounded bg-white p-3 text-sm"><span className="text-gray-500">Biais</span><div className="font-semibold">{(kpiSnapshot.bias ?? 0).toFixed(2)}%</div></div>
            <div className="rounded bg-white p-3 text-sm"><span className="text-gray-500">Déchet</span><div className="font-semibold">{(kpiSnapshot.waste_rate ?? 0).toFixed(2)}%</div></div>
            <div className="rounded bg-white p-3 text-sm"><span className="text-gray-500">Rupture</span><div className="font-semibold">{(kpiSnapshot.stockout_rate ?? 0).toFixed(2)}%</div></div>
          </div>
        </div>
      )}

      <div className="stats-kpis grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Production & Boxes Total */}
        <div className="analytics-kpi analytics-kpi--sales">
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
        <div className={`analytics-kpi ${Number(avgWastePercent) > 10 ? 'analytics-kpi--danger' : Number(avgWastePercent) > 6 ? 'analytics-kpi--warning' : 'analytics-kpi--success'}`}>
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
        <div className="analytics-kpi analytics-kpi--volume">
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
        <div className="analytics-kpi analytics-kpi--insight">
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
        <div className="analytics-panel">
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
                      stroke="#168151"
                      fill="#168151"
                      fillOpacity={0.10}
                    />
                    <Area
                      type="monotone"
                      dataKey="received"
                      name="Reçu"
                      stackId="2"
                      stroke="#3679b8"
                      fill="#3679b8"
                      fillOpacity={0.08}
                    />
                    <Area
                      type="monotone"
                      dataKey="sales"
                      name="Ventes"
                      stackId="3"
                      stroke="#046a38"
                      fill="#046a38"
                      fillOpacity={0.18}
                    />
                    <Area
                      type="monotone"
                      dataKey="waste"
                      name="Déchets"
                      stackId="4"
                      stroke="#d33d56"
                      fill="#d33d56"
                      fillOpacity={0.12}
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

        <div className="analytics-panel">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <PieChart className="h-5 w-5 mr-2 text-krispy-green" />
              Popularité des Variétés
            </h2>
          </div>
          <div className="p-6">
            {varietyChartData.length > 0 ? (
              <div className="relative h-64 w-full">
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
                {leadingVariety && <div className="donut-center" aria-hidden="true"><strong>{leadingVariety.percentage}%</strong><span>n° 1</span></div>}
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
                    <span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: VARIETY_COLORS[index] }}></span>
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
                        index === 0 ? 'border-emerald-500 bg-emerald-50' :
                        index === 1 ? 'border-blue-400 bg-blue-50' :
                        index === 2 ? 'border-violet-400 bg-violet-50' :
                        'border-gray-200 bg-gray-25'
                      } ${isTopPerformer ? 'shadow-sm' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <span className={`text-lg font-bold ${
                              index === 0 ? 'text-emerald-700' :
                              index === 1 ? 'text-blue-700' :
                              index === 2 ? 'text-violet-700' :
                              'text-gray-500'
                            }`}>
                              #{index + 1}
                            </span>

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
                              index === 0 ? 'text-emerald-700' :
                              index === 1 ? 'text-blue-700' :
                              index === 2 ? 'text-violet-700' :
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
                              index === 0 ? 'bg-emerald-500' :
                              index === 1 ? 'bg-blue-400' :
                              index === 2 ? 'bg-violet-400' :
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
             <table className="responsive-table min-w-full divide-y divide-gray-200">
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
                      <td data-label="Magasin" className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {store.name}
                      </td>
                      <td data-label="Production Totale" className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                        {formatNum(store.production)}
                        <div className="text-xs text-gray-400">({productionPercent}%)</div>
                      </td>
                      <td data-label="Reçu" className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                        {formatNum(store.received)}
                      </td>
                      <td data-label="Ventes (Reçu - Déchets)" className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        <span className="font-medium text-krispy-green">{formatNum(sales)}</span>
                        <div className="text-xs text-gray-400">doughnuts vendus</div>
                      </td>
                      <td data-label="% Déchets" className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                        <span className={`${store.wastePercent > 10 ? 'text-red-600 font-medium' : store.wastePercent > 5 ? 'text-orange-600' : 'text-green-600'}`}>
                        {store.wastePercent.toFixed(1)}%
                        </span>
                        <div className="text-xs text-gray-400">{formatNum(store.waste)} déchets</div>
                      </td>
                      <td data-label="Coût Production" className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                        CHF {store.cost.toFixed(2)}
                      </td>
                      <td data-label="Coût des Déchets" className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                        CHF {store.wasteCost.toFixed(2)}
                      </td>
                      <td data-label="Actions" className="px-4 py-3 whitespace-nowrap text-sm text-center">
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

      <div className="mt-8 flex flex-wrap justify-end gap-3">
        <button onClick={() => generateDecisionReport(false)} disabled={loadState !== 'success' || safeProductMetrics.length === 0 || !!pdfProgress} className="inline-flex min-h-11 items-center rounded-lg bg-krispy-green px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50">
          <Printer className="mr-2 h-4 w-4" />{pdfProgress ? pdfProgress : 'Rapport synthétique'}
        </button>
        <button onClick={() => generateDecisionReport(true)} disabled={loadState !== 'success' || safeProductMetrics.length === 0 || !!pdfProgress} className="inline-flex min-h-11 items-center rounded-lg border border-krispy-green bg-white px-4 py-2.5 text-sm font-semibold text-krispy-green hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50">
          <Printer className="mr-2 h-4 w-4" />Rapport détaillé avec annexes
        </button>
      </div>
      <StoreAnalyticsView
        metrics={safeProductMetrics}
        stores={stores.filter(store => store.isActive && (selectedStores.length === 0 || selectedStores.includes(store.id)))}
      />
      </>)}
      </div>
      )}
    </div>
  );
};

export default StatsPage;
