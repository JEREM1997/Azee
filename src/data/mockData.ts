import { Store, DonutVariety, DonutForm, BoxConfiguration } from '../types';

// Mock data for development
export const STORES: Store[] = [];
export const DONUT_FORMS: DonutForm[] = [];
export const DONUT_VARIETIES: DonutVariety[] = [];
export const BOX_CONFIGURATIONS: BoxConfiguration[] = [];

// Generate historical production data
export const getHistoricalData = (days: number) => {
  const data = [];
  const today = new Date();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    const production = Math.floor(Math.random() * (400 - 250) + 250);
    const wastePercent = Math.random() * (8 - 2) + 2;
    const waste = Math.floor(production * (wastePercent / 100));
    
    data.push({
      date: date.toISOString().split('T')[0],
      production,
      waste,
      wastePercent,
    });
  }
  
  return data;
};

export const HISTORICAL_DATA = getHistoricalData(30);