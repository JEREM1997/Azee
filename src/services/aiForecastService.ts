import { getProductionPlans } from './productionService';

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
  private readonly WASTE_TARGET = 0.25; // Target 25% waste (well below 30% limit)
  private readonly SAFETY_STOCK_MIN = 0.15; // Minimum 15% safety stock
  private readonly SAFETY_STOCK_MAX = 0.35; // Maximum 35% safety stock
  private readonly MIN_DATA_POINTS = 3; // Minimum historical data points needed

  /**
   * Generate AI-powered production forecasts for a specific date
   */
  async generateForecast(targetDate: string, stores: any[], varieties: any[], boxes: any[]): Promise<AIForecastResult[]> {
    console.log('🤖 AI Forecast: Starting prediction analysis for', targetDate);
    
    // Progressive data loading: try different timeframes if larger ones fail
    const dataLoadingStrategies = [
      { days: 30, description: "30 days (optimal)" },
      { days: 14, description: "14 days (reduced)" },
      { days: 7, description: "7 days (minimal)" }
    ];
    
    let historicalPlans = null;
    let usedStrategy = null;

    for (const strategy of dataLoadingStrategies) {
      try {
        console.log(`🤖 AI Forecast: Attempting to load ${strategy.days} days of historical data...`);
        historicalPlans = await getProductionPlans(strategy.days);
        usedStrategy = strategy;
        console.log(`✅ AI Forecast: Successfully loaded ${historicalPlans?.length || 0} plans using ${strategy.description}`);
        break;
      } catch (error) {
        console.warn(`⚠️ AI Forecast: Failed to load ${strategy.days} days of data:`, error instanceof Error ? error.message : String(error));
        if (strategy === dataLoadingStrategies[dataLoadingStrategies.length - 1]) {
          // Last strategy failed, throw error
          throw new Error(
            `Unable to load historical data. Tried ${dataLoadingStrategies.map(s => s.days).join(', ')} days. ` +
            `Please ensure you have saved production plans in the system or try again later.`
          );
        }
        continue;
      }
    }
    
    if (!historicalPlans || historicalPlans.length < this.MIN_DATA_POINTS) {
      throw new Error(
        `Insufficient historical data for AI forecasting. Found ${historicalPlans?.length || 0} plans, ` +
        `need at least ${this.MIN_DATA_POINTS}. Please save more production plans before using AI predictions.`
      );
    }

    const targetDayOfWeek = new Date(targetDate).getDay();
    const isWeekend = targetDayOfWeek === 0 || targetDayOfWeek === 6;
    
    console.log(`🤖 AI Forecast: Analyzing ${historicalPlans.length} days of historical data (${usedStrategy?.description})`);
    console.log(`🤖 AI Forecast: Target date is ${this.getDayName(targetDayOfWeek)} (weekend: ${isWeekend})`);

    const results: AIForecastResult[] = [];
    let storesWithData = 0;

    for (const store of stores.filter(s => s.isActive)) {
      console.log(`🤖 AI Forecast: Processing store ${store.name}`);
      
      const storeHistoricalData = this.extractStoreHistoricalData(historicalPlans, store.id);
      
      if (storeHistoricalData.length === 0) {
        console.log(`⚠️ AI Forecast: No historical data for store ${store.name}, using conservative estimates`);
        
        // Provide conservative estimates even without historical data
        const conservativeResult = this.generateConservativeEstimate(store, varieties, boxes, targetDayOfWeek, isWeekend);
        if (conservativeResult) {
          results.push(conservativeResult);
        }
        continue;
      }

      storesWithData++;
      
      // Analyze patterns for varieties
      const varietyPredictions = await this.predictVarieties(
        store, 
        varieties, 
        storeHistoricalData, 
        targetDayOfWeek, 
        isWeekend
      );

      // Analyze patterns for boxes  
      const boxPredictions = await this.predictBoxes(
        store, 
        boxes, 
        storeHistoricalData, 
        targetDayOfWeek, 
        isWeekend
      );

      const totalPredictedSales = varietyPredictions.reduce((sum, v) => sum + v.predictedSales, 0) +
                                 boxPredictions.reduce((sum, b) => sum + b.predictedSales * this.getBoxSize(b.boxId, boxes), 0);
      
      const totalRecommendedProduction = varietyPredictions.reduce((sum, v) => sum + v.recommendedProduction, 0) +
                                        boxPredictions.reduce((sum, b) => sum + b.recommendedProduction * this.getBoxSize(b.boxId, boxes), 0);

      const estimatedWastePercent = totalRecommendedProduction > 0 ? 
        ((totalRecommendedProduction - totalPredictedSales) / totalRecommendedProduction) * 100 : 0;

      const avgSafetyStock = varietyPredictions.length > 0 ? 
        varietyPredictions.reduce((sum, v) => sum + v.confidence, 0) / varietyPredictions.length : 0.20;

      results.push({
        storeId: store.id,
        storeName: store.name,
        predictions: varietyPredictions,
        boxPredictions: boxPredictions,
        totalPredictedSales,
        totalRecommendedProduction,
        estimatedWastePercent,
        safetyStockPercent: avgSafetyStock * 100
      });

      console.log(`✅ AI Forecast: ${store.name} - Predicted sales: ${totalPredictedSales}, Recommended production: ${totalRecommendedProduction}, Estimated waste: ${estimatedWastePercent.toFixed(1)}%`);
    }

    console.log(`🤖 AI Forecast: Completed analysis for ${results.length} stores (${storesWithData} with historical data, ${results.length - storesWithData} with conservative estimates)`);
    
    if (results.length === 0) {
      throw new Error("No production forecasts could be generated. Please ensure stores are properly configured with available varieties and boxes.");
    }

    return results;
  }

  /**
   * Predict variety quantities for a store
   */
  private async predictVarieties(
    store: any, 
    varieties: any[], 
    historicalData: any[], 
    targetDayOfWeek: number, 
    isWeekend: boolean
  ) {
    const predictions = [];

    for (const varietyId of store.availableVarieties) {
      const variety = varieties.find(v => v.id === varietyId && v.isActive);
      if (!variety) continue;

      const pattern = this.analyzeVarietyPattern(historicalData, varietyId, targetDayOfWeek);
      
      if (pattern.dataPoints === 0) {
        // No historical data, use conservative estimate
        predictions.push({
          varietyId,
          varietyName: variety.name,
          predictedSales: 12, // Conservative 1 dozen
          recommendedProduction: 15, // 25% safety stock
          confidence: 0.20, // Low confidence
          reasoning: "No historical data - conservative estimate of 1 dozen"
        });
        continue;
      }

      // Calculate base prediction using various factors
      let basePrediction = pattern.avgSales;

      // Apply day of week factor
      basePrediction *= this.getDayOfWeekFactor(targetDayOfWeek, pattern);

      // Apply trend if significant
      if (Math.abs(pattern.trend) > 0.1) {
        basePrediction *= (1 + pattern.trend);
      }

      // Apply seasonal adjustment (simplified)
      basePrediction *= pattern.seasonalFactor;

      // Ensure minimum viable quantity
      basePrediction = Math.max(basePrediction, 6); // At least half dozen

      // Calculate safety stock based on volatility and day type
      let safetyStockPercent = this.SAFETY_STOCK_MIN;
      
      // Higher safety stock for volatile products
      if (pattern.volatility > 0.3) {
        safetyStockPercent += 0.10;
      }
      
      // Higher safety stock for weekends (less predictable)
      if (isWeekend) {
        safetyStockPercent += 0.05;
      }

      // Cap safety stock
      safetyStockPercent = Math.min(safetyStockPercent, this.SAFETY_STOCK_MAX);

      const recommendedProduction = Math.ceil(basePrediction * (1 + safetyStockPercent));

      // Ensure we don't exceed waste target
      const impliedWaste = (recommendedProduction - basePrediction) / recommendedProduction;
      const adjustedProduction = impliedWaste > this.WASTE_TARGET ? 
        Math.ceil(basePrediction / (1 - this.WASTE_TARGET)) : recommendedProduction;

      predictions.push({
        varietyId,
        varietyName: variety.name,
        predictedSales: Math.round(basePrediction),
        recommendedProduction: adjustedProduction,
        confidence: safetyStockPercent,
        reasoning: this.generateReasoningText(pattern, targetDayOfWeek, safetyStockPercent, isWeekend)
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
    isWeekend: boolean
  ) {
    const predictions = [];

    for (const boxId of store.availableBoxes) {
      const box = boxes.find(b => b.id === boxId && b.isActive);
      if (!box) continue;

      const pattern = this.analyzeBoxPattern(historicalData, box.name, targetDayOfWeek);
      
      if (pattern.dataPoints === 0) {
        // No historical data for boxes, use conservative estimate
        predictions.push({
          boxId,
          boxName: box.name,
          predictedSales: 2, // Conservative 2 boxes
          recommendedProduction: 3, // 50% safety stock
          confidence: 0.25,
          reasoning: "No historical data - conservative estimate"
        });
        continue;
      }

      // Similar logic to varieties but for boxes
      let basePrediction = pattern.avgSales;
      basePrediction *= this.getDayOfWeekFactor(targetDayOfWeek, pattern);
      
      if (Math.abs(pattern.trend) > 0.1) {
        basePrediction *= (1 + pattern.trend);
      }

      basePrediction = Math.max(basePrediction, 1); // At least 1 box

      let safetyStockPercent = this.SAFETY_STOCK_MIN;
      if (pattern.volatility > 0.3) safetyStockPercent += 0.10;
      if (isWeekend) safetyStockPercent += 0.05;
      safetyStockPercent = Math.min(safetyStockPercent, this.SAFETY_STOCK_MAX);

      const recommendedProduction = Math.ceil(basePrediction * (1 + safetyStockPercent));

      predictions.push({
        boxId,
        boxName: box.name,
        predictedSales: Math.round(basePrediction),
        recommendedProduction: recommendedProduction,
        confidence: safetyStockPercent,
        reasoning: this.generateBoxReasoningText(pattern, targetDayOfWeek, safetyStockPercent, isWeekend)
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
          boxName: string;
          planned: number;
          received: number;
          waste: number;
          sales: number;
        }>
      };

      // Extract variety sales data (received - waste)
      if (store.production_items) {
        for (const item of store.production_items) {
          const received = item.received !== null ? item.received : item.quantity;
          const waste = item.waste || 0;
          const sales = received - waste;

          dayData.varieties.push({
            varietyId: item.variety_id,
            planned: item.quantity,
            received: received,
            waste: waste,
            sales: sales
          });
        }
      }

      // Extract box sales data
      if (store.box_productions) {
        for (const boxProd of store.box_productions) {
          const received = boxProd.received !== null ? boxProd.received : boxProd.quantity;
          const waste = boxProd.waste || 0;
          const sales = received - waste;

          dayData.boxes.push({
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
  private analyzeVarietyPattern(historicalData: any[], varietyId: string, targetDayOfWeek: number) {
    const varietyData = [];

    for (const day of historicalData) {
      const varietyItem = day.varieties.find((v: any) => v.varietyId === varietyId);
      if (varietyItem && varietyItem.sales >= 0) {
        varietyData.push({
          date: day.date,
          dayOfWeek: day.dayOfWeek,
          sales: varietyItem.sales,
          planned: varietyItem.planned,
          wastePercent: varietyItem.received > 0 ? (varietyItem.waste / varietyItem.received) * 100 : 0
        });
      }
    }

    if (varietyData.length === 0) {
      return { dataPoints: 0, avgSales: 0, volatility: 0, trend: 0, seasonalFactor: 1.0 };
    }

    // Calculate basic statistics
    const sales = varietyData.map(d => d.sales);
    const avgSales = sales.reduce((sum, s) => sum + s, 0) / sales.length;
    const variance = sales.reduce((sum, s) => sum + Math.pow(s - avgSales, 2), 0) / sales.length;
    const volatility = avgSales > 0 ? Math.sqrt(variance) / avgSales : 0;

    // Calculate trend (simple linear regression)
    const trend = this.calculateTrend(varietyData);

    // Calculate day-of-week factors
    const dayOfWeekData = varietyData.filter(d => d.dayOfWeek === targetDayOfWeek);
    const sameDayAvg = dayOfWeekData.length > 0 ? 
      dayOfWeekData.reduce((sum, d) => sum + d.sales, 0) / dayOfWeekData.length : avgSales;

    const seasonalFactor = avgSales > 0 ? sameDayAvg / avgSales : 1.0;

    return {
      dataPoints: varietyData.length,
      avgSales: avgSales,
      volatility: volatility,
      trend: trend,
      seasonalFactor: Math.max(0.5, Math.min(2.0, seasonalFactor)) // Cap seasonal factor
    };
  }

  /**
   * Analyze historical pattern for boxes
   */
  private analyzeBoxPattern(historicalData: any[], boxName: string, targetDayOfWeek: number) {
    const boxData = [];

    for (const day of historicalData) {
      const boxItem = day.boxes.find((b: any) => b.boxName === boxName);
      if (boxItem && boxItem.sales >= 0) {
        boxData.push({
          date: day.date,
          dayOfWeek: day.dayOfWeek,
          sales: boxItem.sales,
          planned: boxItem.planned
        });
      }
    }

    if (boxData.length === 0) {
      return { dataPoints: 0, avgSales: 0, volatility: 0, trend: 0, seasonalFactor: 1.0 };
    }

    const sales = boxData.map(d => d.sales);
    const avgSales = sales.reduce((sum, s) => sum + s, 0) / sales.length;
    const variance = sales.reduce((sum, s) => sum + Math.pow(s - avgSales, 2), 0) / sales.length;
    const volatility = avgSales > 0 ? Math.sqrt(variance) / avgSales : 0;

    const trend = this.calculateTrend(boxData);

    const dayOfWeekData = boxData.filter(d => d.dayOfWeek === targetDayOfWeek);
    const sameDayAvg = dayOfWeekData.length > 0 ? 
      dayOfWeekData.reduce((sum, d) => sum + d.sales, 0) / dayOfWeekData.length : avgSales;

    const seasonalFactor = avgSales > 0 ? sameDayAvg / avgSales : 1.0;

    return {
      dataPoints: boxData.length,
      avgSales: avgSales,
      volatility: volatility,
      trend: trend,
      seasonalFactor: Math.max(0.5, Math.min(2.0, seasonalFactor))
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
   * Get day of week adjustment factor
   */
  private getDayOfWeekFactor(dayOfWeek: number, pattern: any): number {
    // Weekend typically has different patterns
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 0.8; // 20% lower on weekends typically
    }
    
    // Friday might be higher
    if (dayOfWeek === 5) {
      return 1.1;
    }
    
    return 1.0; // Normal weekday
  }

  /**
   * Generate human-readable reasoning for the prediction
   */
  private generateReasoningText(pattern: any, dayOfWeek: number, safetyStock: number, isWeekend: boolean): string {
    const dayName = this.getDayName(dayOfWeek);
    const reasons = [];

    if (pattern.dataPoints >= 10) {
      reasons.push(`Based on ${pattern.dataPoints} days of historical data`);
    } else if (pattern.dataPoints >= 3) {
      reasons.push(`Based on limited data (${pattern.dataPoints} days)`);
    }

    if (pattern.seasonalFactor > 1.1) {
      reasons.push(`${dayName}s typically see +${((pattern.seasonalFactor - 1) * 100).toFixed(0)}% higher sales`);
    } else if (pattern.seasonalFactor < 0.9) {
      reasons.push(`${dayName}s typically see ${((1 - pattern.seasonalFactor) * 100).toFixed(0)}% lower sales`);
    }

    if (pattern.trend > 0.05) {
      reasons.push(`Positive trend detected (+${(pattern.trend * 100).toFixed(1)}%/day)`);
    } else if (pattern.trend < -0.05) {
      reasons.push(`Declining trend detected (${(pattern.trend * 100).toFixed(1)}%/day)`);
    }

    if (pattern.volatility > 0.3) {
      reasons.push(`High variability in sales - increased safety stock`);
    }

    if (isWeekend) {
      reasons.push(`Weekend adjustment applied`);
    }

    reasons.push(`${(safetyStock * 100).toFixed(0)}% safety stock to prevent stockouts`);

    return reasons.join('. ') + '.';
  }

  /**
   * Generate reasoning text for box predictions
   */
  private generateBoxReasoningText(pattern: any, dayOfWeek: number, safetyStock: number, isWeekend: boolean): string {
    const dayName = this.getDayName(dayOfWeek);
    const reasons = [];

    if (pattern.dataPoints >= 5) {
      reasons.push(`${pattern.dataPoints} days of box sales history`);
    } else {
      reasons.push(`Limited box data (${pattern.dataPoints} days)`);
    }

    if (pattern.seasonalFactor > 1.1) {
      reasons.push(`${dayName}s show higher box demand`);
    } else if (pattern.seasonalFactor < 0.9) {
      reasons.push(`${dayName}s show lower box demand`);
    }

    reasons.push(`${(safetyStock * 100).toFixed(0)}% safety margin`);

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
   * Generate conservative estimates for stores without historical data
   */
  private generateConservativeEstimate(
    store: any, 
    varieties: any[], 
    boxes: any[], 
    targetDayOfWeek: number, 
    isWeekend: boolean
  ): AIForecastResult | null {
    const predictions = [];
    const boxPredictions = [];

    // Conservative variety estimates
    for (const varietyId of store.availableVarieties) {
      const variety = varieties.find(v => v.id === varietyId && v.isActive);
      if (!variety) continue;

      // Base conservative estimate with day-of-week adjustment
      let baseEstimate = 12; // 1 dozen base
      if (isWeekend) baseEstimate *= 0.8; // 20% less on weekends
      if (targetDayOfWeek === 5) baseEstimate *= 1.2; // 20% more on Fridays

      predictions.push({
        varietyId,
        varietyName: variety.name,
        predictedSales: Math.round(baseEstimate),
        recommendedProduction: Math.round(baseEstimate * 1.25), // 25% safety stock
        confidence: 0.15, // Low confidence
        reasoning: `Conservative estimate - no historical data. Base: ${Math.round(baseEstimate)} + 25% safety stock. ${isWeekend ? 'Weekend reduction applied. ' : ''}${targetDayOfWeek === 5 ? 'Friday boost applied. ' : ''}Adjust manually based on local knowledge.`
      });
    }

    // Conservative box estimates
    for (const boxId of store.availableBoxes) {
      const box = boxes.find(b => b.id === boxId && b.isActive);
      if (!box) continue;

      let baseEstimate = 2; // 2 boxes base
      if (isWeekend) baseEstimate *= 0.7; // 30% less on weekends
      if (targetDayOfWeek === 5) baseEstimate *= 1.3; // 30% more on Fridays

      boxPredictions.push({
        boxId,
        boxName: box.name,
        predictedSales: Math.round(baseEstimate),
        recommendedProduction: Math.round(baseEstimate * 1.3), // 30% safety stock
        confidence: 0.20, // Low confidence
        reasoning: `Conservative box estimate - no historical data. Base: ${Math.round(baseEstimate)} + 30% safety stock. ${isWeekend ? 'Weekend reduction applied. ' : ''}${targetDayOfWeek === 5 ? 'Friday boost applied. ' : ''}Review and adjust as needed.`
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