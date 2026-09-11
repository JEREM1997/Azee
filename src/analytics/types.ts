export type ProductType = 'variety' | 'box';
export type ObservationSource = 'shelf' | 'external_order' | 'preorder' | 'b2b' | 'other';
export type ObservationQuality = 'valid' | 'incomplete' | 'excluded' | 'invalid';
export type RecommendationStatus = 'À tester' | 'À surveiller' | 'À augmenter' | 'À maintenir' | 'À réduire' | 'Candidat au retrait' | 'Retrait recommandé';
export type ConfidenceLevel = 'Faible' | 'Moyen' | 'Élevé';

export interface AnalyticsObservation {
  id: string; storeId: string; storeName: string; productType: ProductType; productId: string; productName: string;
  productionDate: string; salesDate: string; source: ObservationSource; planned: number; received: number | null; waste: number | null;
  sold: number | null; quality: ObservationQuality; issues: string[]; probableStockout: boolean;
}

export interface ProductMetrics {
  key: string; storeId: string; storeName: string; productType: ProductType; productId: string; productName: string;
  received: number; sold: number; waste: number; averageReceived: number; averageSold: number; averageWaste: number;
  salesRate: number; wasteRate: number; offeredDays: number; validCount: number; incompleteCount: number; excludedCount: number;
  invalidCount: number; probableStockouts: number; probableStockoutRate: number; trend: number | null; regularity: number | null;
  referenceQuantity: number | null; recommendedQuantity: number | null; recommendationLabel: string; status: RecommendationStatus;
  confidenceScore: number; confidenceLevel: ConfidenceLevel; confidenceReasons: string[]; reasons: string[];
  observations: AnalyticsObservation[]; comparableDay: number | null; historyWeeks: number;
}
