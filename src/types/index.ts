// Define types for the application

export type UserRole = 'admin' | 'production' | 'store';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  storeIds?: string[];
  metadata?: Record<string, unknown>;
  fullName?: string; // Made optional since it's not always available
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
  orderOnly?: boolean; // True when only available through pre-order, not retail shelves
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
  varieties?: Array<{
    varietyId: string;
    quantity: number;
  }>;
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
    deliveryDate?: string;
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
  stores: StorePlan[];
  total_production: number;
  status: 'draft' | 'confirmed' | 'completed';
}

export interface StorePlan {
  store_id: string;
  store_name: string;
  production_items: ProductionItem[];
  box_productions: BoxProduction[];
  total_quantity: number;
  delivery_date?: string;
  confirmed: boolean;
  delivery_confirmed: boolean;
  waste_reported: boolean;
}

export interface ProductionItem {
  variety_id: string;
  variety_name: string;
  form_id: string;
  form_name: string;
  quantity: number;
  received?: number;
  waste?: number;
}

export interface BoxProduction {
  box_id: string;
  box_name: string;
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

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: unknown;
}

// Authentication Types
export interface AuthState {
  user: User | null;
  loading: boolean;
  error: AppError | null;
}

// Validation Types
export interface ValidationResult {
  valid: boolean;
  errors: AppError[];
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: AppError;
}

// Orders
export type OrderPaymentStatus = 'deja_paye' | 'a_facturer' | 'a_la_livraison';
export type OrderType = 'retail' | 'b2b';

export interface OrderLineItem {
  varietyId: string;
  quantity: number;
  conditioning: string;
}

export interface Order {
  id: string;
  storeId: string;
  storeName?: string;
  customerName: string;
  customerPhone: string;
  companyName?: string;
  deliveryAddress?: string;
  billingAddress?: string;
  deliveryDate: string;
  productionDate: string;
  productionApproved: boolean;
  orderType: OrderType;
  paymentStatus: OrderPaymentStatus;
  handledBy: string;
  deliveredBy?: string;
  conditioning: string;
  comments?: string;
  items: OrderLineItem[];
  createdAt: string;
}
