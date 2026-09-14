// @ts-ignore - Deno runtime
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  try{
    const auth=req.headers.get('Authorization'); if(!auth)return json({error:'Session requise'},401);
    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}});
    const body=await req.json();
    if(body.action==='search'){
      const q=String(body.query||'').trim(); if(q.length<2)return json([]);
      const pattern=`%${q.replace(/[%_]/g,'')}%`;
      const [activeV,activeB,histV,histB]=await Promise.all([
        db.from('donut_varieties').select('id,name').ilike('name',pattern).limit(15),
        db.from('box_configurations').select('id,name').ilike('name',pattern).limit(15),
        db.from('production_items').select('variety_id,variety_name').ilike('variety_name',pattern).limit(50),
        db.from('box_productions').select('box_id,box_name').ilike('box_name',pattern).limit(50),
      ]);
      const map=new Map<string,any>();
      for(const row of activeV.data||[])map.set(`variety:${row.id}`,{id:row.id,name:row.name,type:'variety'});
      for(const row of activeB.data||[])map.set(`box:${row.id}`,{id:row.id,name:row.name,type:'box'});
      for(const row of histV.data||[])if(!map.has(`variety:${row.variety_id}`))map.set(`variety:${row.variety_id}`,{id:row.variety_id,name:row.variety_name,type:'variety',historical:true});
      for(const row of histB.data||[])if(!map.has(`box:${row.box_id}`))map.set(`box:${row.box_id}`,{id:row.box_id,name:row.box_name,type:'box',historical:true});
      return json([...map.values()].slice(0,30));
    }
    const {productType,productId,startDate,endDate}=body; const storeIds=Array.isArray(body.storeIds)?body.storeIds:[];
    if(!['variety','box'].includes(productType)||!productId||!startDate||!endDate)return json({error:'Filtres invalides'},400);
    let plansQuery=db.from('production_plans').select('id,date').gte('date',startDate).lte('date',endDate).order('date');
    const {data:plans,error:pe}=await plansQuery; if(pe)throw pe; if(!plans?.length)return json({plans:[],total:0});
    const stores:any[]=[];for(let offset=0;offset<plans.length;offset+=100){let storesQuery=db.from('store_productions').select('id,plan_id,store_id,store_name,delivery_confirmed,waste_reported,deliverydate,delivery_date').in('plan_id',plans.slice(offset,offset+100).map(p=>p.id));if(storeIds.length)storesQuery=storesQuery.in('store_id',storeIds);const {data,error}=await storesQuery;if(error)throw error;stores.push(...(data||[]));}
    if(!stores.length)return json({plans:[],total:0});
    const table=productType==='variety'?'production_items':'box_productions', idCol=productType==='variety'?'variety_id':'box_id';
    const items:any[]=[];for(let offset=0;offset<stores.length;offset+=100){for(let page=0;;page++){const {data,error}=await db.from(table).select('*').in('store_production_id',stores.slice(offset,offset+100).map(s=>s.id)).eq(idCol,productId).order('id').range(page*500,page*500+499);if(error)throw error;items.push(...(data||[]));if(!data||data.length<500)break;}}
    const byStore=new Map<string,any[]>();for(const item of items||[])byStore.set(item.store_production_id,[...(byStore.get(item.store_production_id)||[]),item]);
    const storesByPlan=new Map<string,any[]>();for(const store of stores){const rows=byStore.get(store.id);if(!rows?.length)continue;const entry={...store,production_items:productType==='variety'?rows:[],box_productions:productType==='box'?rows:[]};storesByPlan.set(store.plan_id,[...(storesByPlan.get(store.plan_id)||[]),entry]);}
    const result=plans.map(p=>({...p,stores:storesByPlan.get(p.id)||[]})).filter(p=>p.stores.length);
    return json({plans:result,total:(items||[]).length});
  }catch(error){console.error(error);return json({error:error?.message||'Erreur serveur'},500);}
});
