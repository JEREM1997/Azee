import test from 'node:test';
import assert from 'node:assert/strict';
import { ANALYTICS_RULES, normalizeBuffer } from '../businessRules.ts';
import { calculateProductMetrics, normalizeProductionPlans, restrictMetricsToStores } from '../engine.ts';
import { getComparisonWindows, resolveSalesDate, salesDay } from '../salesDate.ts';
import { makeEntry, makePlans } from './fixtures.ts';

const one = (entry:any, date='2026-07-04') => normalizeProductionPlans([{date,stores:[entry]}]);

test('quality rules distinguish null, zero, invalid and confirmations',()=>{
  const cases:[any,string][]=[
    [makeEntry({production_items:[{id:'a',variety_id:'v',variety_name:'V',quantity:8,received:null,waste:0}]}),'incomplete'],
    [makeEntry({production_items:[{id:'a',variety_id:'v',variety_name:'V',quantity:8,received:0,waste:0}]}),'excluded'],
    [makeEntry({production_items:[{id:'a',variety_id:'v',variety_name:'V',quantity:8,received:8,waste:null}]}),'incomplete'],
    [makeEntry({production_items:[{id:'a',variety_id:'v',variety_name:'V',quantity:8,received:8,waste:9}]}),'invalid'],
    [makeEntry({delivery_confirmed:false}),'excluded'], [makeEntry({waste_reported:false}),'incomplete']];
  for(const [entry,quality] of cases) assert.equal(one(entry)[0].quality,quality);
});

test('external, preorder and B2B orders are excluded',()=>{
  for(const order_type of [undefined,'retail','b2b']) assert.equal(one(makeEntry({source_type:'order',order_type}))[0].quality,'excluded');
});

test('sold is exactly received minus waste and full sale is only a probable stockout',()=>{
  const observation=one(makeEntry())[0]; assert.equal(observation.sold,8); assert.equal(observation.probableStockout,true);
});

test('one full sale never triggers increase',()=>assert.equal(calculateProductMetrics(one(makeEntry()))[0].status,'À tester'));

test('sales dates map Friday and Saturday without double shifting delivery date',()=>{
  assert.equal(resolveSalesDate('2026-07-03'), '2026-07-04');
  assert.equal(resolveSalesDate('2026-07-04'), '2026-07-04');
  assert.equal(resolveSalesDate('2026-07-03','2026-07-04'), '2026-07-04');
  assert.equal(salesDay(resolveSalesDate('2026-07-03')),6);
});

test('comparison windows load real comparable periods',()=>{
  assert.deepEqual(getComparisonWindows({period:'day',date:'2026-07-11',start:'',end:'',month:7,year:2026}).previous,{start:'2026-07-04',end:'2026-07-04'});
  assert.deepEqual(getComparisonWindows({period:'range',date:'',start:'2026-07-06',end:'2026-07-12',month:7,year:2026}).previous,{start:'2026-06-29',end:'2026-07-05'});
  assert.deepEqual(getComparisonWindows({period:'month',date:'',start:'',end:'',month:7,year:2026}).previous,{start:'2025-07-01',end:'2025-07-31'});
  assert.deepEqual(getComparisonWindows({period:'year',date:'',start:'',end:'',month:7,year:2026}).previous,{start:'2025-01-01',end:'2025-12-31'});
});

test('same weekday observations produce trend against previous data',()=>{
  const current=normalizeProductionPlans(makePlans(4)); const previous=normalizeProductionPlans(makePlans(4,i=>makeEntry({production_items:[{id:`p${i}`,variety_id:'classic',variety_name:'Original',quantity:4,received:4,waste:0}]})));
  assert.equal(calculateProductMetrics(current,previous)[0].trend,1);
});

test('history gates confidence and removals',()=>{
  assert.equal(calculateProductMetrics(normalizeProductionPlans(makePlans(3)))[0].confidenceLevel,'Faible');
  assert.equal(calculateProductMetrics(normalizeProductionPlans(makePlans(3)))[0].status,'À tester');
  const low=(count:number)=>normalizeProductionPlans(makePlans(count,i=>makeEntry({production_items:[{id:`x${i}`,variety_id:'low',variety_name:'Low',quantity:10,received:10,waste:6}]})));
  assert.notEqual(calculateProductMetrics(low(4))[0].status,'Retrait recommandé');
  assert.equal(calculateProductMetrics(low(8))[0].status,'Retrait recommandé');
});

test('four repeated probable stockouts can trigger a cautious increase',()=>{
  const metric=calculateProductMetrics(normalizeProductionPlans(makePlans(4)))[0];
  assert.equal(metric.status,'À augmenter'); assert.equal(metric.probableStockouts,4);
  assert.ok(metric.recommendedQuantity! <= metric.referenceQuantity! * 1.3);
});

test('varieties and boxes stay separate and zero sales remain visible',()=>{
  const entry=makeEntry({production_items:[{id:'v',variety_id:'v',variety_name:'V',quantity:4,received:4,waste:4}],box_productions:[{id:'b',box_id:'b',box_name:'Box',quantity:2,received:2,waste:0}]});
  const metrics=calculateProductMetrics(one(entry)); assert.equal(metrics.length,2); assert.equal(metrics.find(m=>m.productType==='variety')?.sold,0); assert.equal(metrics.find(m=>m.productType==='box')?.sold,2);
});

test('performance remains scoped by store',()=>{
  const plans=[{date:'2026-07-04',stores:[makeEntry(),makeEntry({id:'other',store_id:'store-b',store_name:'Geneva',production_items:[{id:'z',variety_id:'classic',variety_name:'Original',quantity:8,received:8,waste:6}]})]}];
  const metrics=calculateProductMetrics(normalizeProductionPlans(plans)); assert.equal(metrics.length,2); assert.notEqual(metrics[0].wasteRate,metrics[1].wasteRate);
});

test('recommendations enforce minima, buffer steps and change caps',()=>{
  const variety=calculateProductMetrics(normalizeProductionPlans(makePlans(4,i=>makeEntry({production_items:[{id:`v${i}`,variety_id:'v',variety_name:'V',quantity:4,received:4,waste:1}]}))))[0];
  const boxPlans=makePlans(4,i=>makeEntry({production_items:[],box_productions:[{id:`b${i}`,box_id:'b',box_name:'B',quantity:2,received:2,waste:0}]}));
  const box=calculateProductMetrics(normalizeProductionPlans(boxPlans))[0];
  assert.ok((variety.recommendedQuantity??4)>=4 || variety.status==='À surveiller'); assert.ok((box.recommendedQuantity??2)>=2 || box.status==='À surveiller');
  assert.equal(ANALYTICS_RULES.initialBuffer,.25); assert.equal(normalizeBuffer(.17),.15); assert.equal(normalizeBuffer(0),.1);
  assert.equal(ANALYTICS_RULES.maxIncrease,.3); assert.equal(ANALYTICS_RULES.maxDecrease,.25);
});

test('unknown box configuration is invalid',()=>{
  const plans=[{date:'2026-07-04',stores:[makeEntry({production_items:[],box_productions:[{id:'b',box_id:'missing',box_name:'Missing',quantity:2,received:2,waste:0}]})]}];
  assert.equal(normalizeProductionPlans(plans,new Set())[0].quality,'invalid');
});

test('store role is restricted to assigned stores',()=>{
  const metrics=calculateProductMetrics(normalizeProductionPlans([{date:'2026-07-04',stores:[makeEntry(),makeEntry({id:'b',store_id:'store-b'})]}]));
  assert.deepEqual(restrictMetricsToStores(metrics,'store',['store-a']).map(m=>m.storeId),['store-a']);
});
