import { format, parse, isValid, addDays, startOfDay, endOfDay, Locale } from 'date-fns';
import { fr } from 'date-fns/locale';

export const DATE_FORMAT = 'yyyy-MM-dd';
export const DISPLAY_DATE_FORMAT = 'dd/MM/yyyy';
export const TIME_FORMAT = 'HH:mm';
export const DATETIME_FORMAT = `${DATE_FORMAT} ${TIME_FORMAT}`;

export const dateUtils = {
  /**
   * Parse a date string into a Date object
   */
  parseDate(dateString: string, formatString: string = DATE_FORMAT): Date | null {
    if (!dateString) return null;
    const parsedDate = parse(dateString, formatString, new Date());
    return isValid(parsedDate) ? parsedDate : null;
  },

  /**
   * Format a date object or string into a standardized string
   */
  formatDate(
    date: Date | string | null,
    formatString: string = DATE_FORMAT,
    options: { locale?: Locale } = { locale: fr }
  ): string {
    if (!date) return '';
    
    const dateObj = typeof date === 'string' ? this.parseDate(date) : date;
    if (!dateObj || !isValid(dateObj)) return '';
    
    return format(dateObj, formatString, options);
  },

  /**
   * Format a date for display to users
   */
  formatDisplayDate(date: Date | string | null): string {
    return this.formatDate(date, DISPLAY_DATE_FORMAT);
  },

  /**
   * Format a date for API requests
   */
  formatApiDate(date: Date | string | null): string {
    return this.formatDate(date, DATE_FORMAT);
  },

  /**
   * Get start of day for a given date
   */
  getStartOfDay(date: Date | string): Date {
    const dateObj = typeof date === 'string' ? this.parseDate(date)! : date;
    return startOfDay(dateObj);
  },

  /**
   * Get end of day for a given date
   */
  getEndOfDay(date: Date | string): Date {
    const dateObj = typeof date === 'string' ? this.parseDate(date)! : date;
    return endOfDay(dateObj);
  },

  /**
   * Add days to a date
   */
  addDays(date: Date | string, days: number): Date {
    const dateObj = typeof date === 'string' ? this.parseDate(date)! : date;
    return addDays(dateObj, days);
  },

  /**
   * Check if a date string is valid
   */
  isValidDateString(dateString: string, formatString: string = DATE_FORMAT): boolean {
    const parsedDate = this.parseDate(dateString, formatString);
    return parsedDate !== null && isValid(parsedDate);
  },

  /**
   * Convert a date string from one format to another
   */
  convertDateFormat(
    dateString: string,
    fromFormat: string,
    toFormat: string
  ): string {
    const parsedDate = this.parseDate(dateString, fromFormat);
    if (!parsedDate) return '';
    return this.formatDate(parsedDate, toFormat);
  },

  /**
   * Get today's date as a string in the specified format
   */
  getTodayString(formatString: string = DATE_FORMAT): string {
    return this.formatDate(new Date(), formatString);
  },

  /**
   * Compare two dates (ignoring time)
   * Returns:
   * -1 if date1 is before date2
   * 0 if dates are the same
   * 1 if date1 is after date2
   */
  compareDates(date1: Date | string, date2: Date | string): number {
    const d1 = this.getStartOfDay(typeof date1 === 'string' ? this.parseDate(date1)! : date1);
    const d2 = this.getStartOfDay(typeof date2 === 'string' ? this.parseDate(date2)! : date2);
    
    if (d1 < d2) return -1;
    if (d1 > d2) return 1;
    return 0;
  },

  /**
   * Check if a date is today
   */
  isToday(date: Date | string): boolean {
    const today = this.getStartOfDay(new Date());
    const compareDate = this.getStartOfDay(typeof date === 'string' ? this.parseDate(date)! : date);
    return this.compareDates(today, compareDate) === 0;
  },

  /**
   * Check if a date is in the past
   */
  isPast(date: Date | string): boolean {
    const today = this.getStartOfDay(new Date());
    const compareDate = this.getStartOfDay(typeof date === 'string' ? this.parseDate(date)! : date);
    return this.compareDates(compareDate, today) === -1;
  },

  /**
   * Check if a date is in the future
   */
  isFuture(date: Date | string): boolean {
    const today = this.getStartOfDay(new Date());
    const compareDate = this.getStartOfDay(typeof date === 'string' ? this.parseDate(date)! : date);
    return this.compareDates(compareDate, today) === 1;
  }
}; 