import { dateUtils } from './dateUtils';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export const validationUtils = {
  /**
   * Validate required fields
   */
  required(value: any, fieldName: string): ValidationError | null {
    if (value === undefined || value === null || value === '') {
      return {
        field: fieldName,
        message: `${fieldName} is required`
      };
    }
    return null;
  },

  /**
   * Validate email format
   */
  email(value: string, fieldName: string = 'Email'): ValidationError | null {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return {
        field: fieldName,
        message: 'Invalid email format'
      };
    }
    return null;
  },

  /**
   * Validate minimum length
   */
  minLength(value: string, min: number, fieldName: string): ValidationError | null {
    if (value.length < min) {
      return {
        field: fieldName,
        message: `${fieldName} must be at least ${min} characters long`
      };
    }
    return null;
  },

  /**
   * Validate maximum length
   */
  maxLength(value: string, max: number, fieldName: string): ValidationError | null {
    if (value.length > max) {
      return {
        field: fieldName,
        message: `${fieldName} must not exceed ${max} characters`
      };
    }
    return null;
  },

  /**
   * Validate numeric value
   */
  numeric(value: any, fieldName: string): ValidationError | null {
    if (isNaN(value) || typeof value !== 'number') {
      return {
        field: fieldName,
        message: `${fieldName} must be a number`
      };
    }
    return null;
  },

  /**
   * Validate minimum value
   */
  min(value: number, min: number, fieldName: string): ValidationError | null {
    if (value < min) {
      return {
        field: fieldName,
        message: `${fieldName} must be at least ${min}`
      };
    }
    return null;
  },

  /**
   * Validate maximum value
   */
  max(value: number, max: number, fieldName: string): ValidationError | null {
    if (value > max) {
      return {
        field: fieldName,
        message: `${fieldName} must not exceed ${max}`
      };
    }
    return null;
  },

  /**
   * Validate date format
   */
  date(value: string, fieldName: string): ValidationError | null {
    if (!dateUtils.isValidDateString(value)) {
      return {
        field: fieldName,
        message: `${fieldName} must be a valid date in the format YYYY-MM-DD`
      };
    }
    return null;
  },

  /**
   * Validate future date
   */
  futureDate(value: string, fieldName: string): ValidationError | null {
    if (!dateUtils.isFuture(value)) {
      return {
        field: fieldName,
        message: `${fieldName} must be a future date`
      };
    }
    return null;
  },

  /**
   * Validate past date
   */
  pastDate(value: string, fieldName: string): ValidationError | null {
    if (!dateUtils.isPast(value)) {
      return {
        field: fieldName,
        message: `${fieldName} must be a past date`
      };
    }
    return null;
  },

  /**
   * Run multiple validations and return all errors
   */
  validate(validations: (ValidationError | null)[]): ValidationResult {
    const errors = validations.filter((error): error is ValidationError => error !== null);
    return {
      isValid: errors.length === 0,
      errors
    };
  },

  /**
   * Validate production plan
   */
  validateProductionPlan(plan: any): ValidationResult {
    const validations = [
      this.required(plan.date, 'Date'),
      plan.date ? this.date(plan.date, 'Date') : null,
      this.required(plan.stores, 'Stores'),
      this.required(plan.total_production, 'Total Production'),
      plan.total_production ? this.numeric(plan.total_production, 'Total Production') : null,
      plan.total_production ? this.min(plan.total_production, 0, 'Total Production') : null
    ];

    return this.validate(validations);
  },

  /**
   * Validate user data
   */
  validateUser(user: any): ValidationResult {
    const validations = [
      this.required(user.email, 'Email'),
      user.email ? this.email(user.email) : null,
      this.required(user.role, 'Role'),
      this.required(user.fullName, 'Full Name'),
      user.fullName ? this.minLength(user.fullName, 2, 'Full Name') : null,
      user.fullName ? this.maxLength(user.fullName, 100, 'Full Name') : null
    ];

    return this.validate(validations);
  },

  /**
   * Validate store data
   */
  validateStore(store: any): ValidationResult {
    const validations = [
      this.required(store.name, 'Store Name'),
      store.name ? this.minLength(store.name, 2, 'Store Name') : null,
      store.name ? this.maxLength(store.name, 100, 'Store Name') : null,
      this.required(store.location, 'Location'),
      this.required(store.manager_id, 'Manager')
    ];

    return this.validate(validations);
  }
}; 