import { productionService } from './productionService';
import { apiService } from './apiService';

export interface AIForecastResult {
  storeId: string;
  storeName: string;
  predictions: {
    varietyId: string;
    varietyName: string;
    predictedSales: number;
    recommendedProduction: number;
    confidence: number;
    reasoning: string;
  }[];
  boxPredictions: {
    boxId: string;
    boxName: string;
    predictedSales: number;
    recommendedProduction: number;
    confidence: number;
    reasoning: string;
  }[];
  totalPredictedSales: number;
  totalRecommendedProduction: number;
  estimatedWastePercent: number;
  safetyStockPercent: number;
}

export interface HistoricalPattern {
  varietyId: string;
  storeId: string;
  dayOfWeek: number;
  avgSales: number;
  maxSales: number;
  minSales: number;
  volatility: number;
  trend: number;
  seasonalFactor: number;
}

export class AIForecastService {
  // Minimum production safeguards
  private readonly MIN_VAR_PRODUCTION = 4; // At least 4 doughnuts per variety
  private readonly MIN_BOX_PRODUCTION = 2; // At least 2 boxes per configuration
  // === Tunable parameters (see requirements table) ===
  private readonly BUFFER_INITIAL = 0.25;       // Starting buffer
  private readonly BUFFER_MIN = 0.10;           // Minimum buffer after reductions
  private readonly BUFFER_STEP = 0.05;          // Step size for buffer reduction
  private readonly MAX_WASTE_RATIO = 0.30;      // Maximum acceptable waste ratio
  // private readonly SAFETY_STOCK_MIN = 0.10;     // Align with BUFFER_MIN
  private readonly SAFETY_STOCK_MAX = 0.35; // Maximum 35% safety stock
  private readonly MIN_DATA_POINTS = 1; // At least 1 same-weekday record required

  // Stability controls
  private readonly MAX_WEEKLY_INCREASE = 0.30; // cap +30% vs last same-weekday
  private readonly MAX_WEEKLY_DECREASE = 0.25; // cap -25% vs last same-weekday
  private readonly ZERO_SALES_UPPER_BOUND = 8; // when last observed sales were 0

  /**
   * Map production day to sales day
   * Friday production (5) → Saturday sales (6)
   * Other days: production day = sales day
   */
  private getCorrespondingSalesDay(productionDayOfWeek: number): number {
    switch (productionDayOfWeek) {
      case 5: // Friday production
        return 6; // Saturday sales
      default:
        return productionDayOfWeek; // Same day for other days
    }
  }

  /**
   * Get production-to-sales day mapping info for logging and reasoning
   */
  private getProductionSalesMapping(productionDayOfWeek: number): { salesDay: number; isWeekend: boolean; mappingInfo: string } {
    const salesDay = this.getCorrespondingSalesDay(productionDayOfWeek);
    
    // Weekend production covers Friday and Saturday production days
    // Friday production → Saturday sales (weekend production)
    // Saturday production → Saturday sales (weekend production)
    const isWeekend = productionDayOfWeek === 5 || productionDayOfWeek === 6; // Friday or Saturday production
    
    const productionDayName = this.getDayName(productionDayOfWeek);
    const salesDayName = this.getDayName(salesDay);
    
    let mappingInfo = '';
    if (productionDayOfWeek === 5) { // Friday production
      mappingInfo = `${productionDayName} production → ${salesDayName} sales (weekend production)`;
    } else if (productionDayOfWeek === 6) { // Saturday production
      mappingInfo = `${productionDayName} production = ${salesDayName} sales (weekend production)`;
    } else {
      mappingInfo = `${productionDayName} production = ${salesDayName} sales (weekday production)`;
    }
    
    return { salesDay, isWeekend, mappingInfo };
  }

  /**
   * Generate AI-powered production forecasts for a specific date
   */
  async generateForecast(targetDate: string, stores: any[], varieties: any[], boxes: any[]): Promise<AIForecastResult[]> {
    // Simplified logic per request: only use last week's same weekday
    console.log('🤖 AI Forecast (simple): Starting last-week analysis for', targetDate);

    const targetDateObj = new Date(targetDate);
    const lastWeekDateObj = new Date(targetDateObj);
    lastWeekDateObj.setDate(targetDateObj.getDate() - 7);
    const lastWeekDate = lastWeekDateObj.toISOString().slice(0, 10);

    // Check if there's an existing plan for the target date (to use as baseline)
    const currentPlan = await productionService.getProductionPlan(targetDate);
    console.log('📋 Current plan for target date:', currentPlan ? 'Found' : 'Not found');

    // Fetch exactly the plan from last week's same weekday (for waste data)
    const lastWeekPlan = await productionService.getProductionPlan(lastWeekDate);
    console.log('📊 Last week plan for', lastWeekDate, ':', lastWeekPlan ? 'Found' : 'Not found');

    // Build store data from that single plan (if available)
    const weekdayFilteredPlans = lastWeekPlan ? [lastWeekPlan] : [];

    const results: AIForecastResult[] = [];
    let storesWithData = 0;

    for (const store of stores.filter((s: any) => s.isActive !== false)) {
      const storeHistoricalData = this.extractStoreHistoricalData(weekdayFilteredPlans as any, store.id);

      // Defensive defaults to prevent crashes if legacy data lacks availability arrays
      const storeVarieties = Array.isArray(store.availableVarieties) ? store.availableVarieties : [];
      const storeBoxes = Array.isArray(store.availableBoxes) ? store.availableBoxes : [];

      if (!Array.isArray(store.availableVarieties) || !Array.isArray(store.availableBoxes)) {
        console.warn(`⚠️ AI forecast: missing availability lists for store ${store.name || store.id}; using empty arrays`);
      }
      
      // Get current plan data for this store (if exists)
      const currentStoreData = currentPlan?.stores?.find((s: any) => s.store_id === store.id);

      const varietyPredictions: any[] = [];
      for (const varietyId of storeVarieties) {
        const variety = varieties.find(v => v.id === varietyId && v.isActive);
        if (!variety) continue;

        let lastWeekSales = 0;
        let isStockout = false;
        let hasHistoricalData = false;
        let historicalReceived = 0;
        let historicalWaste = 0;

        // Try to get historical data if available
        if (storeHistoricalData.length > 0) {
          const dayData = storeHistoricalData[0];
          const vItem = dayData.varieties.find((v: any) => v.varietyId === varietyId);
          
          if (vItem && vItem.received != null && vItem.waste != null) {
            hasHistoricalData = true;
            historicalReceived = vItem.received;
            historicalWaste = vItem.waste;
            // Calculate sales from last week: received - waste = sales
            lastWeekSales = Math.max(0, vItem.received - vItem.waste);
            // Handle stockout detection: if waste = 0, it indicates stockout (everything sold)
            isStockout = vItem.received > 0 && vItem.waste === 0;
          }
        }

        // Get current plan quantity for this variety (if exists)
        const currentQuantity = currentStoreData?.production_items?.find((item: any) => item.variety_id === varietyId)?.quantity || null;

        // Determine baseline for prediction
        let baselineSales: number;
        let reasoning: string;
        
        if (hasHistoricalData) {
          // Use historical data as primary source
          baselineSales = isStockout ? Math.max(lastWeekSales, historicalReceived) : lastWeekSales;
          
          // Apply higher security multiplier for stockout scenarios (when waste = 0)
          const securityMultiplier = isStockout ? 1.50 : 1.30; // 50% buffer for stockouts, 30% for normal sales
          const recommended = Math.max(this.MIN_VAR_PRODUCTION, Math.round(baselineSales * securityMultiplier));

          reasoning = isStockout
            ? `Rupture détectée (reçu=${historicalReceived}, déchet=0, vendu=${lastWeekSales}) → +50% sécurité`
            : `Ventes semaine dernière: ${lastWeekSales} → +30% sécurité`;

          varietyPredictions.push({
            varietyId,
            varietyName: variety.name,
            predictedSales: Math.round(baselineSales),
            recommendedProduction: recommended,
            confidence: 0.30,
            reasoning: reasoning
          });
        } else if (currentQuantity !== null && currentQuantity > 0) {
          // No historical data but current plan exists - use it as baseline with conservative approach
          baselineSales = Math.round(currentQuantity * 0.8); // Assume 80% sales rate
          const recommended = Math.max(this.MIN_VAR_PRODUCTION, Math.round(currentQuantity * 1.10)); // 10% increase
          
          reasoning = `Pas de données historiques. Basé sur plan actuel (${currentQuantity}) → +10% sécurité`;

          varietyPredictions.push({
            varietyId,
            varietyName: variety.name,
            predictedSales: baselineSales,
            recommendedProduction: recommended,
            confidence: 0.15, // Lower confidence without historical data
            reasoning: reasoning
          });
        } else {
          // No historical data and no current plan - use minimum production as fallback
          const recommended = this.MIN_VAR_PRODUCTION;
          baselineSales = Math.round(recommended * 0.7); // Assume 70% will be sold
          
          reasoning = `Pas de données disponibles → Production minimale (${recommended})`;

          varietyPredictions.push({
            varietyId,
            varietyName: variety.name,
            predictedSales: baselineSales,
            recommendedProduction: recommended,
            confidence: 0.10, // Very low confidence
            reasoning: reasoning
          });
        }
      }

      const boxPredictions: any[] = [];
      for (const boxId of storeBoxes) {
        const box = boxes.find(b => b.id === boxId && b.isActive);
        if (!box) continue;

        let lastWeekBoxSales = 0;
        let isBoxStockout = false;
        let hasBoxHistoricalData = false;
        let boxHistoricalReceived = 0;

        // Try to get historical data if available
        if (storeHistoricalData.length > 0) {
          const dayData = storeHistoricalData[0];
          const bItem = dayData.boxes.find((b: any) => b.boxId === boxId || b.boxName === box.name);
          
          if (bItem && bItem.received != null && bItem.waste != null) {
            hasBoxHistoricalData = true;
            boxHistoricalReceived = bItem.received;
            // Calculate box sales from last week: received - waste = sales
            lastWeekBoxSales = Math.max(0, bItem.received - bItem.waste);
            // Handle stockout detection: if waste = 0, it indicates stockout (everything sold)
            isBoxStockout = bItem.received > 0 && bItem.waste === 0;
          }
        }

        // Get current plan quantity for this box (if exists)
        const currentBoxQuantity = currentStoreData?.box_productions?.find((bp: any) => bp.box_id === boxId)?.quantity || null;

        // Determine baseline for box prediction
        let baselineBoxSales: number;
        let boxReasoning: string;
        
        if (hasBoxHistoricalData) {
          // Use historical data as primary source
          baselineBoxSales = isBoxStockout ? Math.max(lastWeekBoxSales, boxHistoricalReceived) : lastWeekBoxSales;
          
          // Apply higher security multiplier for stockout scenarios (when waste = 0)
          const securityMultiplier = isBoxStockout ? 1.50 : 1.30; // 50% buffer for stockouts, 30% for normal sales
          const recommendedBoxes = Math.max(this.MIN_BOX_PRODUCTION, Math.round(baselineBoxSales * securityMultiplier));

          boxReasoning = isBoxStockout
            ? `Rupture détectée (reçu=${boxHistoricalReceived}, déchet=0, vendu=${lastWeekBoxSales}) → +50% sécurité`
            : `Ventes semaine dernière: ${lastWeekBoxSales} → +30% sécurité`;

          boxPredictions.push({
            boxId,
            boxName: box.name,
            predictedSales: Math.round(baselineBoxSales),
            recommendedProduction: recommendedBoxes,
            confidence: 0.30,
            reasoning: boxReasoning
          });
        } else if (currentBoxQuantity !== null && currentBoxQuantity > 0) {
          // No historical data but current plan exists - use it as baseline with conservative approach
          baselineBoxSales = Math.round(currentBoxQuantity * 0.8); // Assume 80% sales rate
          const recommendedBoxes = Math.max(this.MIN_BOX_PRODUCTION, Math.round(currentBoxQuantity * 1.10)); // 10% increase
          
          boxReasoning = `Pas de données historiques. Basé sur plan actuel (${currentBoxQuantity}) → +10% sécurité`;

          boxPredictions.push({
            boxId,
            boxName: box.name,
            predictedSales: baselineBoxSales,
            recommendedProduction: recommendedBoxes,
            confidence: 0.15, // Lower confidence without historical data
            reasoning: boxReasoning
          });
        } else {
          // No historical data and no current plan - use minimum production as fallback
          const recommendedBoxes = this.MIN_BOX_PRODUCTION;
          baselineBoxSales = Math.round(recommendedBoxes * 0.7); // Assume 70% will be sold
          
          boxReasoning = `Pas de données disponibles → Production minimale (${recommendedBoxes})`;

          boxPredictions.push({
            boxId,
            boxName: box.name,
            predictedSales: baselineBoxSales,
            recommendedProduction: recommendedBoxes,
            confidence: 0.10, // Very low confidence
            reasoning: boxReasoning
          });
        }
      }

      // Always include stores in results, even if they have no predictions
      // This ensures the UI shows something for all active stores
      storesWithData++;
      
      const totalPredictedSales = varietyPredictions.reduce((sum, v) => sum + v.predictedSales, 0) +
                                 boxPredictions.reduce((sum, b) => sum + b.predictedSales * this.getBoxSize(b.boxId, boxes), 0);

      const totalRecommendedProduction = varietyPredictions.reduce((sum, v) => sum + v.recommendedProduction, 0) +
                                        boxPredictions.reduce((sum, b) => sum + b.recommendedProduction * this.getBoxSize(b.boxId, boxes), 0);

      const estimatedWastePercent = totalRecommendedProduction > 0 ? 
        ((totalRecommendedProduction - totalPredictedSales) / totalRecommendedProduction) * 100 : 0;

      results.push({
        storeId: store.id,
        storeName: store.name,
        predictions: varietyPredictions,
        boxPredictions,
        totalPredictedSales,
        totalRecommendedProduction,
        estimatedWastePercent,
        safetyStockPercent: 30 // Fixed 30% safety stock
      });
    }

    // Sort for determinism
    results.forEach(r => {
      r.predictions.sort((a, b) => a.varietyName.localeCompare(b.varietyName));
      r.boxPredictions.sort((a, b) => a.boxName.localeCompare(b.boxName));
    });
    results.sort((a, b) => a.storeName.localeCompare(b.storeName));

    // Always return results, even if empty - let the UI handle the display
    console.log(`✅ AI forecast completed for ${results.length} stores (${storesWithData} with data)`);
    return results;
  }

  /**
   * Convert the response from the `generate-production` Edge Function
   * to the local `AIForecastResult[]` structure so the rest of the UI
   * continues to work without major changes.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private convertBackendResponseToForecast(
    backendData: any,
    stores: any[],
    varieties: any[],
    boxes: any[],
    _targetDate: string
  ): AIForecastResult[] {
    type PredictionMap = {
      storeName: string;
      predictions: any[];
      boxPredictions: any[];
    };

    const storeIndexById = new Map(stores.map((s: any) => [s.id, s]));
    const resMap: Record<string, PredictionMap> = {};

    const finalBuffer = backendData.final_buffer ?? 0.25;

    // Iterate over production_items (they keep IDs for store/product)
    (backendData.production_items || []).forEach((item: any) => {
      const storeId = item.store;
      const kind = item.kind as 'var' | 'box';

      if (!resMap[storeId]) {
        const storeName = storeIndexById.get(storeId)?.name || storeId;
        resMap[storeId] = { storeName, predictions: [], boxPredictions: [] };
      }

      if (kind === 'var') {
        const variety = varieties.find(v => v.id === item.product);
        const baseSales = Math.round(item.quantity / (1 + finalBuffer));
        resMap[storeId].predictions.push({
          varietyId: item.product,
          varietyName: variety?.name || 'Inconnu',
          predictedSales: baseSales,
          recommendedProduction: Math.max(item.quantity, this.MIN_VAR_PRODUCTION),
          confidence: finalBuffer,
          reasoning: 'Prévision générée par le backend'
        });
      } else {
        const box = boxes.find(b => b.id === item.product);
        const boxSize = box?.size || 1;
        const baseSales = Math.round((item.quantity * boxSize) / (1 + finalBuffer));
        resMap[storeId].boxPredictions.push({
          boxId: item.product,
          boxName: box?.name || 'Boîte inconnue',
          predictedSales: baseSales,
          recommendedProduction: Math.max(item.quantity, this.MIN_BOX_PRODUCTION),
          confidence: finalBuffer,
          reasoning: 'Prévision générée par le backend'
        });
      }
    });

    // Build final array
    const results: AIForecastResult[] = [];
    for (const [storeId, data] of Object.entries(resMap)) {
      const totalPred = [...data.predictions, ...data.boxPredictions].reduce((sum, p: any) => sum + p.predictedSales, 0);

      const totalRec = data.predictions.reduce((sum, p: any) => sum + p.recommendedProduction, 0) +
        data.boxPredictions.reduce((sum, p: any) => {
          const box = boxes.find(b => b.id === p.boxId);
          const size = box?.size || 1;
          return sum + p.recommendedProduction * size;
        }, 0);

      const wastePct = totalRec > 0 ? ((totalRec - totalPred) / totalRec) * 100 : 0;

      const entry: AIForecastResult = {
        storeId,
        storeName: data.storeName,
        predictions: data.predictions.sort((a, b) => a.varietyName.localeCompare(b.varietyName)),
        boxPredictions: data.boxPredictions.sort((a, b) => a.boxName.localeCompare(b.boxName)),
        totalPredictedSales: totalPred,
        totalRecommendedProduction: totalRec,
        estimatedWastePercent: wastePct,
        safetyStockPercent: finalBuffer * 100
      };
      results.push(entry);
    }

    // Sort stores for determinism
    return results.sort((a, b) => a.storeName.localeCompare(b.storeName));
  }

  /**
   * Predict variety quantities for a store
   */
  private async predictVarieties(
    store: any,
    varieties: any[],
    historicalData: any[],
    targetDayOfWeek: number,
    productionDayOfWeek: number
  ) {
    const predictions = [];

    const storeVarieties = Array.isArray(store.availableVarieties) ? store.availableVarieties : [];
    
    // Weekend production covers Friday and Saturday production days
    const isWeekendProduction = productionDayOfWeek === 5 || productionDayOfWeek === 6;

    for (const varietyId of storeVarieties) {
      const variety = varieties.find(v => v.id === varietyId && v.isActive);
      if (!variety) continue;

      const pattern = this.analyzeVarietyPattern(historicalData, varietyId, targetDayOfWeek);
      
      if (pattern.dataPoints === 0) {
        // Skip varieties with no matching data in the last 5 corresponding weekdays
        continue;
      }

      // Calculate base prediction using various factors
      let basePrediction = pattern.avgSales;

      // Apply day of week factor
      basePrediction *= this.getDayOfWeekFactor(productionDayOfWeek, pattern);

      // Apply trend if significant
      if (Math.abs(pattern.trend) > 0.1) {
        basePrediction *= (1 + pattern.trend);
      }

      // Apply seasonal adjustment (simplified)
      basePrediction *= pattern.seasonalFactor;

      // Clamp change vs last observed sales to limit volatility
      if (pattern.dataPoints > 0) {
        const last = (pattern as any).lastSales ?? 0;
        if (last > 0) {
          const capLow = Math.max(0, last * (1 - this.MAX_WEEKLY_DECREASE));
          const capHigh = last * (1 + this.MAX_WEEKLY_INCREASE);
          basePrediction = Math.min(Math.max(basePrediction, capLow), capHigh);
        } else {
          // Previously zero sales: keep a conservative ceiling
          basePrediction = Math.min(basePrediction, this.ZERO_SALES_UPPER_BOUND);
        }
      }

      // Dynamic buffer logic
      let bufferPct = this.BUFFER_INITIAL;
      if ((pattern as any).avgWastePercent > 25) {
        bufferPct = Math.max(this.BUFFER_MIN, bufferPct - 0.10);
      } else if ((pattern as any).avgWastePercent < 5 && basePrediction > 0) {
        bufferPct = Math.min(this.SAFETY_STOCK_MAX, bufferPct + 0.05);
      }
      let recommendedProductionRaw = Math.ceil(basePrediction * (1 + bufferPct));
      let impliedWaste = (recommendedProductionRaw - basePrediction) / recommendedProductionRaw;

      while (impliedWaste > this.MAX_WASTE_RATIO && bufferPct > this.BUFFER_MIN) {
        bufferPct = Math.max(bufferPct - this.BUFFER_STEP, this.BUFFER_MIN);
        recommendedProductionRaw = Math.ceil(basePrediction * (1 + bufferPct));
        impliedWaste = (recommendedProductionRaw - basePrediction) / recommendedProductionRaw;
      }

      const finalRecommended = Math.max(recommendedProductionRaw, this.MIN_VAR_PRODUCTION);

      predictions.push({
        varietyId,
        varietyName: variety.name,
        predictedSales: Math.round(basePrediction),
        recommendedProduction: finalRecommended,
        confidence: bufferPct,
        reasoning: this.generateReasoningText(pattern, targetDayOfWeek, bufferPct, isWeekendProduction, productionDayOfWeek)
      });
    }

    return predictions;
  }

  /**
   * Predict box quantities for a store
   */
  private async predictBoxes(
    store: any,
    boxes: any[],
    historicalData: any[],
    targetDayOfWeek: number,
    productionDayOfWeek: number
  ) {
    const predictions = [];

    const storeBoxes = Array.isArray(store.availableBoxes) ? store.availableBoxes : [];
    
    // Weekend production covers Friday and Saturday production days
    const isWeekendProduction = productionDayOfWeek === 5 || productionDayOfWeek === 6;

    for (const boxId of storeBoxes) {
      const box = boxes.find(b => b.id === boxId && b.isActive);
      if (!box) continue;

      const pattern = this.analyzeBoxPattern(historicalData, box.name, targetDayOfWeek, boxId);
      
      if (pattern.dataPoints === 0) {
        // Skip boxes without weekday-matched history
        continue;
      }

      // Similar logic to varieties but for boxes
      let basePrediction = pattern.avgSales;
      basePrediction *= this.getDayOfWeekFactor(productionDayOfWeek, pattern);
      
      if (Math.abs(pattern.trend) > 0.1) {
        basePrediction *= (1 + pattern.trend);
      }

      basePrediction = Math.max(basePrediction, 1); // At least 1 box

      // Clamp change vs last observed sales to limit volatility
      if (pattern.dataPoints > 0) {
        const last = (pattern as any).lastSales ?? 0;
        if (last > 0) {
          const capLow = Math.max(0, last * (1 - this.MAX_WEEKLY_DECREASE));
          const capHigh = last * (1 + this.MAX_WEEKLY_INCREASE);
          basePrediction = Math.min(Math.max(basePrediction, capLow), capHigh);
        } else {
          basePrediction = Math.min(basePrediction, Math.ceil(this.ZERO_SALES_UPPER_BOUND / 12));
        }
      }

      // Dynamic buffer logic for boxes
      let bufferPct = this.BUFFER_INITIAL;
      if ((pattern as any).avgWastePercent > 25) {
        bufferPct = Math.max(this.BUFFER_MIN, bufferPct - 0.10);
      } else if ((pattern as any).avgWastePercent < 5 && basePrediction > 0) {
        bufferPct = Math.min(this.SAFETY_STOCK_MAX, bufferPct + 0.05);
      }
      let recommendedProductionCalc = Math.ceil(basePrediction * (1 + bufferPct));
      let impliedWaste = (recommendedProductionCalc - basePrediction) / recommendedProductionCalc;

      while (impliedWaste > this.MAX_WASTE_RATIO && bufferPct > this.BUFFER_MIN) {
        bufferPct = Math.max(bufferPct - this.BUFFER_STEP, this.BUFFER_MIN);
        recommendedProductionCalc = Math.ceil(basePrediction * (1 + bufferPct));
        impliedWaste = (recommendedProductionCalc - basePrediction) / recommendedProductionCalc;
      }

      // Enforce minimum threshold for boxes
      const recommendedProduction = Math.max(recommendedProductionCalc, this.MIN_BOX_PRODUCTION);

      predictions.push({
        boxId,
        boxName: box.name,
        predictedSales: Math.round(basePrediction),
        recommendedProduction: recommendedProduction,
        confidence: bufferPct,
        reasoning: this.generateBoxReasoningText(pattern, targetDayOfWeek, bufferPct, isWeekendProduction, productionDayOfWeek)
      });
    }

    return predictions;
  }

  /**
   * Extract historical sales data for a specific store
   */
  private extractStoreHistoricalData(plans: any[], storeId: string) {
    const storeData: Array<{
      date: string;
      dayOfWeek: number;
      varieties: Array<{
        varietyId: string;
        planned: number;
        received: number;
        waste: number;
        sales: number;
      }>;
      boxes: Array<{
        boxId: string;
        boxName: string;
        planned: number;
        received: number;
        waste: number;
        sales: number;
      }>;
    }> = [];

    for (const plan of plans) {
      if (!plan.stores) continue;

      const store = plan.stores.find((s: any) => s.store_id === storeId);
      if (!store) continue;

      const dayData = {
        date: plan.date,
        dayOfWeek: new Date(plan.date).getDay(),
        varieties: [] as Array<{
          varietyId: string;
          planned: number;
          received: number;
          waste: number;
          sales: number;
        }>,
        boxes: [] as Array<{
          boxId: string;
          boxName: string;
          planned: number;
          received: number;
          waste: number;
          sales: number;
        }>
      };

      // Extract variety sales data (received - waste) — only when confirmed
      if (store.production_items) {
        for (const item of store.production_items) {
         let received = item.received; 
         let waste = item.waste; 

          // If everything was sold (waste = 0) but the team forgot to log "received",
          // fall back to the planned quantity so we don't under-produce next time.
          if (received == null && waste === 0 && item.quantity != null) {
            received = item.quantity;
          }

          // If waste wasn't filled in, assume 0 when we have a received or planned quantity.
          if (waste == null && (received != null || item.quantity != null)) {
            waste = 0;
          } 

          if (received == null || waste == null) continue;
          
          // Sales = received - waste (standard calculation)
          const sales = Math.max(0, received - waste);

          dayData.varieties.push({
            varietyId: item.variety_id,
            planned: item.quantity,
            received: received,
            waste: waste,
            sales: sales
          });
        }
      }

      // Extract box sales data — only when confirmed
      if (store.box_productions) {
        for (const boxProd of store.box_productions) {
          let received = boxProd.received;
          let waste = boxProd.waste;

          // Same safeguard as varieties: when everything was sold and "received" is missing,
          // use the planned quantity to avoid falling back to the minimum production.
          if (received == null && waste === 0 && boxProd.quantity != null) {
            received = boxProd.quantity;
          }

          // Assume 0 waste when it's missing but we know how many were produced/received.
          if (waste == null && (received != null || boxProd.quantity != null)) {
            waste = 0;
          }

          if (received == null || waste == null) continue;
          
          // Sales = received - waste (standard calculation)
          const sales = Math.max(0, received - waste);

          dayData.boxes.push({
            boxId: boxProd.box_id,
            boxName: boxProd.box_name,
            planned: boxProd.quantity,
            received: received,
            waste: waste,
            sales: sales
          });
        }
      }

      storeData.push(dayData);
    }

    return storeData;
  }

  /**
   * Analyze historical pattern for a specific variety
   */
  private analyzeVarietyPattern(historicalData: any[], varietyId: string, targetSalesDayOfWeek: number) {
    const varietyData: any[] = [];

    for (const day of historicalData) {
      // Map this historical production day to its sales day
      const historicalSalesDay = this.getCorrespondingSalesDay(day.dayOfWeek);
      
      // Only include data if this historical production was sold on the same day of week as our target
      if (historicalSalesDay === targetSalesDayOfWeek) {
        const varietyItem = day.varieties.find((v: any) => v.varietyId === varietyId);
        if (varietyItem && varietyItem.sales >= 0) {
          varietyData.push({
            date: day.date,
            productionDayOfWeek: day.dayOfWeek,
            salesDayOfWeek: historicalSalesDay,
            sales: varietyItem.sales,
            planned: varietyItem.planned,
            wastePercent: varietyItem.received > 0 ? (varietyItem.waste / varietyItem.received) * 100 : 0
          });
        }
      }
    }

    if (varietyData.length === 0) {
      return { dataPoints: 0, avgSales: 0, volatility: 0, trend: 0, seasonalFactor: 1.0, lastSales: 0, avgWastePercent: 0 };
    }

    // Sort most recent first to identify last observed sales
    varietyData.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate robust statistics
    const sales = varietyData.map(d => d.sales);
    let avgSales: number;
    if (sales.length >= 3) {
      const sorted = [...sales].sort((a, b) => a - b);
      const trimmed = sorted.slice(1, sorted.length - 1);
      avgSales = trimmed.reduce((sum, s) => sum + s, 0) / trimmed.length;
    } else if (sales.length === 2) {
      const sorted = [...sales].sort((a, b) => a - b);
      avgSales = (sorted[0] + sorted[1]) / 2;
    } else {
      avgSales = sales[0];
    }
    const variance = sales.reduce((sum, s) => sum + Math.pow(s - avgSales, 2), 0) / sales.length;
    const volatility = avgSales > 0 ? Math.sqrt(variance) / avgSales : 0;

    // Calculate trend (simple linear regression)
    const trend = this.calculateTrend(varietyData);

    // All the data points are already for the target sales day, so seasonal factor is based on that
    const seasonalFactor = 1.0; // Since we've already filtered for the target sales day

    const lastSales = varietyData[0]?.sales ?? 0;
    const wastePercents = varietyData
      .filter((d: any) => (d.planned ?? 0) >= 0)
      .map((d: any) => d.sales >= 0 && d.planned >= 0 ? ((d.planned > 0) ? ((d.planned - d.sales) / d.planned) * 100 : 0) : 0);
    const avgWastePercent = wastePercents.length > 0
      ? wastePercents.reduce((s: number, v: number) => s + v, 0) / wastePercents.length
      : 0;

    return {
      dataPoints: varietyData.length,
      avgSales: avgSales,
      volatility: volatility,
      trend: trend,
      seasonalFactor: seasonalFactor,
      lastSales,
      avgWastePercent
    };
  }

  /**
   * Analyze historical pattern for boxes
   */
  private analyzeBoxPattern(historicalData: any[], boxName: string, targetSalesDayOfWeek: number, boxId?: string) {
    const boxData: any[] = [];

    for (const day of historicalData) {
      // Map this historical production day to its sales day
      const historicalSalesDay = this.getCorrespondingSalesDay(day.dayOfWeek);
      
      // Only include data if this historical production was sold on the same day of week as our target
      if (historicalSalesDay === targetSalesDayOfWeek) {
        const boxItem = day.boxes.find((b: any) => (boxId && b.boxId === boxId) || b.boxName === boxName);
        if (boxItem && boxItem.sales >= 0) {
          boxData.push({
            date: day.date,
            productionDayOfWeek: day.dayOfWeek,
            salesDayOfWeek: historicalSalesDay,
            sales: boxItem.sales,
            planned: boxItem.planned
          });
        }
      }
    }

    if (boxData.length === 0) {
      return { dataPoints: 0, avgSales: 0, volatility: 0, trend: 0, seasonalFactor: 1.0, lastSales: 0, avgWastePercent: 0 };
    }

    // Sort most recent first
    boxData.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Robust average for boxes
    const sales = boxData.map(d => d.sales);
    let avgSales: number;
    if (sales.length >= 3) {
      const sorted = [...sales].sort((a, b) => a - b);
      const trimmed = sorted.slice(1, sorted.length - 1);
      avgSales = trimmed.reduce((s, v) => s + v, 0) / trimmed.length;
    } else if (sales.length === 2) {
      const sorted = [...sales].sort((a, b) => a - b);
      avgSales = (sorted[0] + sorted[1]) / 2;
    } else {
      avgSales = sales[0];
    }
    const variance = sales.reduce((sum, s) => sum + Math.pow(s - avgSales, 2), 0) / sales.length;
    const volatility = avgSales > 0 ? Math.sqrt(variance) / avgSales : 0;

    const trend = this.calculateTrend(boxData);

    // All the data points are already for the target sales day, so seasonal factor is based on that
    const seasonalFactor = 1.0; // Since we've already filtered for the target sales day

    const lastSales = boxData[0]?.sales ?? 0;
    const wastePercents = boxData
      .filter((d: any) => (d.planned ?? 0) >= 0)
      .map((d: any) => d.sales >= 0 && d.planned >= 0 ? ((d.planned > 0) ? ((d.planned - d.sales) / d.planned) * 100 : 0) : 0);
    const avgWastePercent = wastePercents.length > 0
      ? wastePercents.reduce((s: number, v: number) => s + v, 0) / wastePercents.length
      : 0;

    return {
      dataPoints: boxData.length,
      avgSales: avgSales,
      volatility: volatility,
      trend: trend,
      seasonalFactor: seasonalFactor,
      lastSales,
      avgWastePercent
    };
  }

  /**
   * Calculate simple trend using linear regression
   */
  private calculateTrend(data: any[]): number {
    if (data.length < 2) return 0;

    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    data.forEach((point, index) => {
      const x = index;
      const y = point.sales;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const avgY = sumY / n;
    
    // Return trend as percentage change per day
    return avgY > 0 ? slope / avgY : 0;
  }

  /**
   * Get day of week adjustment factor based on production day
   */
  private getDayOfWeekFactor(productionDayOfWeek: number, _pattern: any): number {
    // Weekend production covers Friday and Saturday production days
    const isWeekendProduction = productionDayOfWeek === 5 || productionDayOfWeek === 6;
    
    if (isWeekendProduction) {
      if (productionDayOfWeek === 5) { // Friday production for Saturday sales
        return 1.1; // 10% higher for Saturday sales
      } else { // Saturday production for Saturday sales
        return 1.05; // 5% higher for Saturday production
      }
    }
    
    // Sunday production typically lower
    if (productionDayOfWeek === 0) {
      return 0.8; // 20% lower on Sunday
    }
    
    return 1.0; // Normal weekday
  }

  /**
   * Generate human-readable reasoning for the prediction
   */
  private generateReasoningText(pattern: any, dayOfWeek: number, safetyStock: number, isWeekendProduction: boolean, productionDayOfWeek: number): string {
    // const dayName = this.getDayName(dayOfWeek);
    const productionDayName = this.getDayName(productionDayOfWeek);
    const reasons = [];

    if (pattern.dataPoints >= 10) {
      reasons.push(`Based on ${pattern.dataPoints} days of historical data`);
    } else if (pattern.dataPoints >= 3) {
      reasons.push(`Based on limited data (${pattern.dataPoints} days)`);
    }

    if (pattern.trend > 0.05) {
      reasons.push(`Positive trend detected (+${(pattern.trend * 100).toFixed(1)}%/day)`);
    } else if (pattern.trend < -0.05) {
      reasons.push(`Declining trend detected (${(pattern.trend * 100).toFixed(1)}%/day)`);
    }

    if (pattern.volatility > 0.3) {
      reasons.push(`High variability in sales - increased safety stock`);
    }

    if (isWeekendProduction) {
      reasons.push(`Weekend production (${productionDayName}) pattern analyzed`);
    }

    reasons.push(`${(safetyStock * 100).toFixed(0)}% safety stock to prevent stockouts`);

    if (productionDayOfWeek === 5 && dayOfWeek === 6) {
      reasons.push(`Friday production → Saturday sales mapping applied`);
    }

    return reasons.join('. ') + '.';
  }

  /**
   * Generate reasoning text for box predictions
   */
  private generateBoxReasoningText(pattern: any, dayOfWeek: number, safetyStock: number, isWeekendProduction: boolean, productionDayOfWeek: number): string {
    // const dayName = this.getDayName(dayOfWeek);
    const productionDayName = this.getDayName(productionDayOfWeek);
    const reasons = [];

    if (pattern.dataPoints >= 5) {
      reasons.push(`${pattern.dataPoints} days of box sales history`);
    } else {
      reasons.push(`Limited box data (${pattern.dataPoints} days)`);
    }

    // Note: seasonal messaging suppressed to reduce verbosity

    if (isWeekendProduction) {
      reasons.push(`Weekend production (${productionDayName}) applied`);
    }

    reasons.push(`${(safetyStock * 100).toFixed(0)}% safety margin`);

    if (productionDayOfWeek === 5 && dayOfWeek === 6) {
      reasons.push(`Friday production → Saturday sales mapping applied`);
    }

    return reasons.join('. ') + '.';
  }

  /**
   * Get box size by ID
   */
  private getBoxSize(boxId: string, boxes: any[]): number {
    const box = boxes.find(b => b.id === boxId);
    return box ? box.size : 12; // Default to 12 if not found
  }

  /**
   * Get day name
   */
  private getDayName(dayOfWeek: number): string {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return days[dayOfWeek];
  }

  /**
   * Compute adjustment factor from waste percent
   * - Low waste → mild up-adjustment
   * - Moderate waste → neutral
   * - High waste → down-adjustment
   */
  private getAdjustmentFactorFromWaste(wastePercent: number): number {
    if (!isFinite(wastePercent) || wastePercent < 0) {
      return 1.0;
    }

    // Piecewise mapping for clarity and stability
    // 0-5%: +10% buffer (likely under-produced)
    // 5-10%: +5%
    // 10-20%: 0%
    // 20-30%: -10%
    // >30%: -20%
    let factor: number;
    if (wastePercent < 5) {
      factor = 1.10;
    } else if (wastePercent < 10) {
      factor = 1.05;
    } else if (wastePercent < 20) {
      factor = 1.00;
    } else if (wastePercent < 30) {
      factor = 0.90;
    } else {
      factor = 0.80;
    }

    // Clamp to guard against accidental extremes
    factor = Math.max(0.7, Math.min(1.25, factor));
    return factor;
  }

  /**
   * Generate conservative estimates for stores without historical data
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private generateConservativeEstimate(
    store: any,
    varieties: any[],
    boxes: any[],
    targetDayOfWeek: number,
    _salesDayOfWeek: number
  ): AIForecastResult | null {
    const predictions = [];
    const boxPredictions = [];
    
    // Weekend production covers Friday and Saturday production days
    const isWeekendProduction = targetDayOfWeek === 5 || targetDayOfWeek === 6;

   const storeVarieties = Array.isArray(store.availableVarieties) ? store.availableVarieties : [];
  const storeBoxes = Array.isArray(store.availableBoxes) ? store.availableBoxes : [];
    
    // Conservative variety estimates
    for (const varietyId of storeVarieties) {
      const variety = varieties.find(v => v.id === varietyId && v.isActive);
      if (!variety) continue;

      // Base conservative estimate with weekend production adjustment
      let baseEstimate = 12; // 1 dozen base
      
      // Weekend production (Friday/Saturday) typically has different patterns
      if (isWeekendProduction) {
        if (targetDayOfWeek === 5) { // Friday production for Saturday sales
          baseEstimate *= 1.2; // 20% more for Saturday sales
        } else { // Saturday production for Saturday sales
          baseEstimate *= 1.1; // 10% more for Saturday production
        }
      }

      predictions.push({
        varietyId,
        varietyName: variety.name,
        predictedSales: Math.round(baseEstimate),
        recommendedProduction: Math.round(baseEstimate * 1.25), // 25% safety stock
        confidence: 0.15, // Low confidence
        reasoning: `Conservative estimate - no historical data. Base: ${Math.round(baseEstimate)} + 25% safety stock. ${isWeekendProduction ? `Weekend production (${this.getDayName(targetDayOfWeek)}) pattern applied. ` : ''}Adjust manually based on local knowledge.`
      });
    }

    // Conservative box estimates
    for (const boxId of storeBoxes) {
      const box = boxes.find(b => b.id === boxId && b.isActive);
      if (!box) continue;

      let baseEstimate = 2; // 2 boxes base
      
      // Weekend production adjustments
      if (isWeekendProduction) {
        if (targetDayOfWeek === 5) { // Friday production for Saturday sales
          baseEstimate *= 1.3; // 30% more for Saturday sales
        } else { // Saturday production for Saturday sales
          baseEstimate *= 1.1; // 10% more for Saturday production
        }
      }

      boxPredictions.push({
        boxId,
        boxName: box.name,
        predictedSales: Math.round(baseEstimate),
        recommendedProduction: Math.round(baseEstimate * 1.3), // 30% safety stock
        confidence: 0.20, // Low confidence
        reasoning: `Conservative box estimate - no historical data. Base: ${Math.round(baseEstimate)} + 30% safety stock. ${isWeekendProduction ? `Weekend production (${this.getDayName(targetDayOfWeek)}) pattern applied. ` : ''}Review and adjust as needed.`
      });
    }

    if (predictions.length === 0 && boxPredictions.length === 0) {
      return null;
    }

    const totalPredictedSales = predictions.reduce((sum, v) => sum + v.predictedSales, 0) +
                               boxPredictions.reduce((sum, b) => sum + b.predictedSales * this.getBoxSize(b.boxId, boxes), 0);
    
    const totalRecommendedProduction = predictions.reduce((sum, v) => sum + v.recommendedProduction, 0) +
                                      boxPredictions.reduce((sum, b) => sum + b.recommendedProduction * this.getBoxSize(b.boxId, boxes), 0);

    const estimatedWastePercent = totalRecommendedProduction > 0 ? 
      ((totalRecommendedProduction - totalPredictedSales) / totalRecommendedProduction) * 100 : 0;

    return {
      storeId: store.id,
      storeName: store.name,
      predictions,
      boxPredictions,
      totalPredictedSales,
      totalRecommendedProduction,
      estimatedWastePercent,
      safetyStockPercent: 25 // Conservative 25% safety stock
    };
  }
}

export const aiForecastService = new AIForecastService();
