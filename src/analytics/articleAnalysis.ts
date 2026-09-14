import { parseIsoDate, toIsoDate } from './salesDate.ts';
import type { AnalyticsObservation, ProductType } from './types.ts';

export type ArticleStatus = 'Complet' | 'Réception manquante' | 'Déchets non renseignés' | 'Anomalie';
export interface ArticleRow extends AnalyticsObservation { status: ArticleStatus }
export interface ArticleTotals { planned:number|null; received:number|null; waste:number|null; sold:number|null; wasteRate:number|null; receptionGap:number|null }
export interface ArticleSeries { label:string; planned:number|null; received:number|null; waste:number|null; sold:number|null }

export const articleRows = (observations: AnalyticsObservation[], type: ProductType, id: string, storeIds: string[] = []): ArticleRow[] =>
  observations.filter(o => o.productType === type && o.productId === id && (!storeIds.length || storeIds.includes(o.storeId))).map(o => ({
    ...o,
    status: o.received === null ? 'Réception manquante' : o.waste === null ? 'Déchets non renseignés' : o.waste > o.received ? 'Anomalie' : 'Complet',
  }));

const nullableSum = (rows: ArticleRow[], field: 'received'|'waste'|'sold'): number|null =>
  rows.some(row => row[field] === null) ? null : rows.reduce((sum,row)=>sum+(row[field] as number),0);

export const articleTotals = (rows: ArticleRow[]): ArticleTotals => {
  if (!rows.length) return {planned:null,received:null,waste:null,sold:null,wasteRate:null,receptionGap:null};
  const planned=rows.reduce((sum,row)=>sum+row.planned,0),received=nullableSum(rows,'received'),waste=nullableSum(rows,'waste'),sold=nullableSum(rows,'sold');
  return { planned,received,waste,sold,wasteRate:received !== null && received > 0 && waste !== null ? waste/received : null,receptionGap:received === null ? null : planned-received };
};

const bucket = (date:string, granularity:'day'|'week'|'month') => {
  if(granularity==='day') return date;
  if(granularity==='month') return date.slice(0,7);
  const d=parseIsoDate(date), day=(d.getUTCDay()+6)%7;
  return toIsoDate(new Date(d.getTime()-day*86_400_000));
};

export const articleSeries = (rows:ArticleRow[], granularity:'day'|'week'|'month'):ArticleSeries[] => {
  const groups=new Map<string,ArticleRow[]>();
  rows.forEach(row=>{const key=bucket(row.salesDate,granularity);groups.set(key,[...(groups.get(key)||[]),row]);});
  return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([label,items])=>({label,...articleTotals(items)}));
};

export const comparisonChange = (current:number|null, previous:number|null) => current===null||previous===null ? null : ({quantity:current-previous,percent:previous===0?null:(current-previous)/previous});
