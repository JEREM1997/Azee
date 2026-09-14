import { supabase } from '../lib/supabase';
import { productionService } from './productionService';
import { splitIntoMonthlyBatches } from './statisticsLoader';
import type { ProductType } from '../analytics/types';
import { filterPlansForArticle } from '../analytics/articleAnalysis';
import { ArticleAnalysisError, classifyArticleError, isArticleFunctionUnavailable } from '../analytics/articleErrors';
export { ArticleAnalysisError } from '../analytics/articleErrors';

export interface ArticleOption { id:string; name:string; type:ProductType; historical?:boolean }
export interface ArticleAnalysisPayload { plans:any[]; total:number; source?:'article-function'|'production-fallback' }
const errorPayload=async(error:any)=>{const response=error?.context as Response|undefined;let payload:any={};if(response)try{payload=await response.clone().json()}catch{payload={}}return{status:response?.status,code:payload?.code,message:payload?.message||payload?.error||error?.message,correlationId:payload?.correlationId}};
const invoke = async <T>(body:Record<string,unknown>):Promise<T> => {const {data,error}=await supabase.functions.invoke('get-article-analysis',{body});if(error)throw Object.assign(error,{articleDetails:await errorPayload(error)});return data as T};
const fallbackLoad=async(args:{productType:ProductType;productId:string;startDate:string;endDate:string;storeIds:string[]}):Promise<ArticleAnalysisPayload>=>{const batches=splitIntoMonthlyBatches({start:args.startDate,end:args.endDate});const plans=(await Promise.all(batches.map(batch=>productionService.getProductionPlans(batch.start,batch.end)))).flat(),filtered=filterPlansForArticle(plans,args);return{plans:filtered,total:filtered.reduce((sum,plan)=>sum+(plan.delivery_entries.length?plan.delivery_entries:plan.stores).reduce((n:number,s:any)=>n+s.production_items.length+s.box_productions.length,0),0),source:'production-fallback'}};

export const articleAnalysisService={
  search:async(query:string)=>{try{return await invoke<ArticleOption[]>({action:'search',query})}catch(error:any){const details=error.articleDetails||await errorPayload(error);if(isArticleFunctionUnavailable(details))return[];throw classifyArticleError(details)}},
  load:async(args:{productType:ProductType;productId:string;startDate:string;endDate:string;storeIds:string[]})=>{try{return{...await invoke<ArticleAnalysisPayload>({action:'load',...args}),source:'article-function' as const}}catch(error:any){const details=error.articleDetails||await errorPayload(error);if(isArticleFunctionUnavailable(details))return fallbackLoad(args);throw classifyArticleError(details)}},
};
