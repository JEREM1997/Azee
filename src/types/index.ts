// Define types for the application

export type UserRole = 'admin' | 'production' | 'store';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  storeIds?: string[];
}

export interface Store {
  id: string;
  name: string;
  location: string;
  isActive: boolean;
  availableVarieties: string[]; // IDs of available varieties
  availableBoxes: string[]; // IDs of available box configurations
  createdAt?: string;
  updatedAt?: string;
}

export interface DonutVariety {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  formId: string; // Associate each variety with a specific form
  productionCost: number; // Production cost per unit in CHF
  createdAt?: string;
  updatedAt?: string;
}

export interface DonutForm {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BoxConfiguration {
  id: string;
  name: string;
  size: number; // Number of donuts in the box
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductionPlanData {
  date: string;
  totalProduction: number;
  stores: {
    storeId: string;
    storeName: string;
    totalQuantity: number;
    items: {
      varietyId: string;
      varietyName: string;
      formId: string;
      formName: string;
      quantity: number;
    }[];
    boxes?: {
      boxId: string;
      boxName: string;
      quantity: number;
    }[];
  }[];
}

export interface ProductionPlan {
  id: string;
  date: string;
  createdBy: string;
  totalProduction: number;
  stores: StoreProductionPlan[];
  status: 'draft' | 'confirmed' | 'completed';
}

export interface StoreProductionPlan {
  storeId: string;
  storeName: string;
  items: ProductionItem[];
  totalQuantity: number;
  confirmed: boolean;
  deliveryConfirmed?: boolean;
  wasteReported?: boolean;
}

export interface ProductionItem {
  varietyId: string;
  varietyName: string;
  formId: string;
  formName: string;
  quantity: number;
  received?: number;
  waste?: number;
}

export interface ProductionStats {
  totalProduction: number;
  wastagePercentage: number;
  productionByStore: {
    storeId: string;
    storeName: string;
    quantity: number;
    wastage: number;
  }[];
  productionByVariety: {
    varietyId: string;
    varietyName: string;
    quantity: number;
  }[];
}

export interface CostAnalysis {
  totalCost: number;
  costPerDonut: number;
  costByStore: {
    storeId: string;
    storeName: string;
    cost: number;
  }[];
}