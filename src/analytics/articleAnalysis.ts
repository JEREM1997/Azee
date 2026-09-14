import { parseIsoDate, toIsoDate } from './salesDate.ts';
import type { AnalyticsObservation, ProductType } from './types.ts';

export type ArticleStatus = 'Complet' | 'Réception manquante' | 'Déchets non renseignés' | 'Réception et déchets manquants' | 'Donnée incohérente';
export interface ArticleRow extends AnalyticsObservation { status: ArticleStatus; receivedKnown:boolean; wasteKnown:boolean }
export interface ArticleCoverage { totalLines:number; completeLines:number; receivedKnownLines:number; wasteKnownLines:number; soldKnownLines:number; incompleteDays:number; totalDays:number; missingReceptionStores:string[]; missingWasteStores:string[]; partial:boolean }
export interface ArticleTotals { planned:number|null; received:number|null; waste:number|null; sold:number|null; wasteRate:number|null; receptionGap:number|null; coverage:ArticleCoverage }
export interface ArticleSeries extends ArticleTotals { label:string }

const hasIssue=(observation:AnalyticsObservation,text:string)=>observation.issues.some(issue=>issue.includes(text));
export const articleRows = (observations: AnalyticsObservation[], type: ProductType, id: string, storeIds: string[] = []): ArticleRow[] =>
  observations.filter(o => o.productType === type && o.productId === id && (!storeIds.length || storeIds.includes(o.storeId))).map(o => {
    const receivedKnown=o.received!==null&&!hasIssue(o,'Livraison non confirmée');
    const wasteKnown=o.waste!==null&&!hasIssue(o,'Déchets non déclarés');
    const inconsistent=receivedKnown&&wasteKnown&&(o.received!<0||o.waste!<0||o.waste!>o.received!);
    const status:ArticleStatus=inconsistent?'Donnée incohérente':!receivedKnown&&!wasteKnown?'Réception et déchets manquants':!receivedKnown?'Réception manquante':!wasteKnown?'Déchets non renseignés':'Complet';
    return {...o,receivedKnown,wasteKnown,status,sold:receivedKnown&&wasteKnown&&!inconsistent?o.received!-o.waste!:null};
  });

const knownSum=(rows:ArticleRow[],known:(row:ArticleRow)=>boolean,value:(row:ArticleRow)=>number):number|null=>{const valid=rows.filter(known);return valid.length?valid.reduce((sum,row)=>sum+value(row),0):null};
export const articleTotals = (rows: ArticleRow[]): ArticleTotals => {
  const empty:ArticleCoverage={totalLines:0,completeLines:0,receivedKnownLines:0,wasteKnownLines:0,soldKnownLines:0,incompleteDays:0,totalDays:0,missingReceptionStores:[],missingWasteStores:[],partial:false};
  if(!rows.length)return{planned:null,received:null,waste:null,sold:null,wasteRate:null,receptionGap:null,coverage:empty};
  const comparable=rows.filter(row=>row.receivedKnown&&row.wasteKnown&&row.status==='Complet'),receivedComparable=comparable.reduce((sum,row)=>sum+row.received!,0),wasteComparable=comparable.reduce((sum,row)=>sum+row.waste!,0);
  const dates=new Set(rows.map(row=>row.salesDate)),completeDates=new Set(comparable.map(row=>row.salesDate));
  const coverage:ArticleCoverage={totalLines:rows.length,completeLines:comparable.length,receivedKnownLines:rows.filter(row=>row.receivedKnown).length,wasteKnownLines:rows.filter(row=>row.wasteKnown).length,soldKnownLines:comparable.length,incompleteDays:[...dates].filter(date=>!completeDates.has(date)||rows.some(row=>row.salesDate===date&&row.status!=='Complet')).length,totalDays:dates.size,missingReceptionStores:[...new Set(rows.filter(row=>!row.receivedKnown).map(row=>row.storeName))],missingWasteStores:[...new Set(rows.filter(row=>!row.wasteKnown).map(row=>row.storeName))],partial:comparable.length<rows.length};
  return{planned:rows.reduce((sum,row)=>sum+row.planned,0),received:knownSum(rows,row=>row.receivedKnown,row=>row.received!),waste:knownSum(rows,row=>row.wasteKnown,row=>row.waste!),sold:knownSum(rows,row=>row.status==='Complet',row=>row.sold!),wasteRate:comparable.length&&receivedComparable>0?wasteComparable/receivedComparable:null,receptionGap:knownSum(rows,row=>row.receivedKnown,row=>row.planned-row.received!),coverage};
};

const bucket=(date:string,granularity:'day'|'week'|'month')=>{if(granularity==='day')return date;if(granularity==='month')return date.slice(0,7);const d=parseIsoDate(date),day=(d.getUTCDay()+6)%7;return toIsoDate(new Date(d.getTime()-day*86_400_000))};
export const articleSeries=(rows:ArticleRow[],granularity:'day'|'week'|'month'):ArticleSeries[]=>{const groups=new Map<string,ArticleRow[]>();rows.forEach(row=>{const key=bucket(row.salesDate,granularity);groups.set(key,[...(groups.get(key)||[]),row])});return[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([label,items])=>({label,...articleTotals(items)}))};
export const comparisonChange=(current:number|null,previous:number|null)=>current===null||previous===null?null:({quantity:current-previous,percent:previous===0?null:(current-previous)/previous});

/** Reduces full-plan fallback responses to the requested article and stores before normalization. */
export const filterPlansForArticle=(plans:any[],args:{productType:ProductType;productId:string;storeIds:string[]})=>{const entries=(input:any[])=>(input||[]).filter((store:any)=>!args.storeIds.length||args.storeIds.includes(store.store_id)).map((store:any)=>({...store,production_items:args.productType==='variety'?(store.production_items||[]).filter((row:any)=>row.variety_id===args.productId):[],box_productions:args.productType==='box'?(store.box_productions||[]).filter((row:any)=>row.box_id===args.productId):[]})).filter((store:any)=>store.production_items.length||store.box_productions.length);return plans.map(plan=>({...plan,stores:entries(plan.stores),delivery_entries:entries(plan.delivery_entries)})).filter(plan=>plan.stores.length||plan.delivery_entries.length)};
