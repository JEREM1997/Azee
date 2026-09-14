import { supabase } from '../lib/supabase';
import type { ProductType } from '../analytics/types';

export interface ArticleOption { id:string; name:string; type:ProductType; historical?:boolean }
export interface ArticleAnalysisPayload { plans:any[]; total:number }

const invoke = async <T>(body:Record<string,unknown>):Promise<T> => {
  const {data,error}=await supabase.functions.invoke('get-article-analysis',{body});
  if(error) throw new Error(error.message || 'Impossible de charger l’analyse article');
  return data as T;
};

export const articleAnalysisService={
  search:(query:string)=>invoke<ArticleOption[]>({action:'search',query}),
  load:(args:{productType:ProductType;productId:string;startDate:string;endDate:string;storeIds:string[]})=>invoke<ArticleAnalysisPayload>({action:'load',...args}),
};
