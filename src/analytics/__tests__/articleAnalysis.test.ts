import test from 'node:test';
import assert from 'node:assert/strict';
import {articleRows,articleSeries,articleTotals,comparisonChange} from '../articleAnalysis.ts';
import {normalizeProductionPlans} from '../engine.ts';
import {makeEntry} from './fixtures.ts';

test('article analysis isolates product IDs and product types',()=>{
  const plans=[{date:'2026-07-04',stores:[makeEntry({production_items:[
    {id:'a',variety_id:'same',variety_name:'Article',quantity:10,received:8,waste:2},
    {id:'b',variety_id:'other',variety_name:'Article proche',quantity:99,received:99,waste:0}],
    box_productions:[{id:'box',box_id:'same',box_name:'Article',quantity:5,received:5,waste:1}]})]}];
  const observations=normalizeProductionPlans(plans);
  const variety=articleRows(observations,'variety','same');
  assert.equal(variety.length,1);assert.equal(articleTotals(variety).sold,6);assert.equal(articleTotals(variety).wasteRate,.25);
  assert.equal(articleRows(observations,'box','same').length,1);
});

test('missing reception or waste never becomes a zero or a definitive sale',()=>{
  const plans=[{date:'2026-07-04',stores:[makeEntry({production_items:[
    {id:'a',variety_id:'v',variety_name:'V',quantity:8,received:null,waste:null},
    {id:'b',variety_id:'v',variety_name:'V',quantity:8,received:8,waste:null}]})]}];
  const rows=articleRows(normalizeProductionPlans(plans),'variety','v');
  assert.deepEqual(rows.map(r=>r.status),['Réception et déchets manquants','Déchets non renseignés']);
  const totals=articleTotals(rows);assert.equal(totals.received,8);assert.equal(totals.waste,null);assert.equal(totals.sold,null);assert.equal(totals.wasteRate,null);assert.equal(totals.coverage.receivedKnownLines,1);
});

test('anomalies and Friday sales mapping are retained in table and chart totals',()=>{
  const plans=[{date:'2026-07-03',stores:[makeEntry({production_items:[{id:'a',variety_id:'v',variety_name:'V',quantity:8,received:7,waste:9}]})]}];
  const rows=articleRows(normalizeProductionPlans(plans),'variety','v');
  assert.equal(rows[0].salesDate,'2026-07-04');assert.equal(rows[0].status,'Donnée incohérente');assert.equal(rows[0].sold,null);
  const point=articleSeries(rows,'day')[0];assert.equal(point.planned,8);assert.equal(point.received,7);assert.equal(point.waste,9);assert.equal(point.sold,null);assert.equal(point.wasteRate,null);assert.equal(point.coverage.partial,true);
});


test('partial lines preserve every calculable total and use only comparable rows for waste rate',()=>{
  const plans=[{date:'2026-08-01',stores:[makeEntry({production_items:[
    {id:'complete',variety_id:'v',variety_name:'V',quantity:10,received:8,waste:2},
    {id:'missing-waste',variety_id:'v',variety_name:'V',quantity:5,received:5,waste:null},
    {id:'missing-reception',variety_id:'v',variety_name:'V',quantity:4,received:null,waste:1}]})]}];
  const rows=articleRows(normalizeProductionPlans(plans),'variety','v'),totals=articleTotals(rows);
  assert.equal(totals.planned,19);assert.equal(totals.received,13);assert.equal(totals.waste,3);assert.equal(totals.sold,6);assert.equal(totals.receptionGap,2);assert.equal(totals.wasteRate,.25);
  assert.deepEqual(totals.coverage,{totalLines:3,completeLines:1,receivedKnownLines:2,wasteKnownLines:2,soldKnownLines:1,incompleteDays:1,totalDays:1,missingReceptionStores:['Lausanne'],missingWasteStores:['Lausanne'],partial:true});
});

test('August regression keeps 251 known sales when another line is incomplete',()=>{
  const plans=[{date:'2026-08-14',stores:[makeEntry({production_items:[{id:'complete',variety_id:'v',variety_name:'V',quantity:762,received:761,waste:510},{id:'incomplete',variety_id:'v',variety_name:'V',quantity:0,received:null,waste:null}]})]}];
  const totals=articleTotals(articleRows(normalizeProductionPlans(plans),'variety','v'));
  assert.equal(totals.planned,762);assert.equal(totals.received,761);assert.equal(totals.waste,510);assert.equal(totals.sold,251);assert.equal(totals.wasteRate,510/761);assert.equal(totals.coverage.partial,true);
});

test('confirmed zero is known while an unconfirmed zero remains missing',()=>{
  const confirmed=articleRows(normalizeProductionPlans([{date:'2026-08-02',stores:[makeEntry({production_items:[{id:'zero',variety_id:'v',variety_name:'V',quantity:4,received:0,waste:0}]})]}]),'variety','v')[0];
  assert.equal(confirmed.receivedKnown,true);assert.equal(confirmed.wasteKnown,true);assert.equal(confirmed.sold,0);assert.equal(confirmed.status,'Complet');
  const unconfirmed=articleRows(normalizeProductionPlans([{date:'2026-08-03',stores:[makeEntry({delivery_confirmed:false,waste_reported:false,production_items:[{id:'zero',variety_id:'v',variety_name:'V',quantity:4,received:0,waste:0}]})]}]),'variety','v')[0];
  assert.equal(unconfirmed.receivedKnown,false);assert.equal(unconfirmed.wasteKnown,false);assert.equal(unconfirmed.sold,null);assert.equal(unconfirmed.status,'Réception et déchets manquants');
});

test('daily, weekly and monthly buckets sum known values without invalidating partial buckets',()=>{
  const observations=normalizeProductionPlans([{date:'2026-07-31',stores:[makeEntry({production_items:[{id:'a',variety_id:'v',variety_name:'V',quantity:10,received:9,waste:1}]})]},{date:'2026-08-07',stores:[makeEntry({production_items:[{id:'b',variety_id:'v',variety_name:'V',quantity:10,received:8,waste:null}]})]}]);
  const rows=articleRows(observations,'variety','v'),totals=articleTotals(rows);
  for(const granularity of ['day','week','month'] as const){const points=articleSeries(rows,granularity);assert.equal(points.reduce((sum,p)=>sum+(p.received??0),0),totals.received);assert.equal(points.reduce((sum,p)=>sum+(p.sold??0),0),totals.sold);assert.ok(points.some(p=>p.coverage.partial));}
});

test('comparison protects percentage against division by zero',()=>{
  assert.deepEqual(comparisonChange(12,10),{quantity:2,percent:.2});assert.deepEqual(comparisonChange(2,0),{quantity:2,percent:null});assert.equal(comparisonChange(null,4),null);
});

test('article PDF uses the same rows, series and totals as the screen model',async()=>{
  const {buildArticlePdf}=await import('../../pdf/reports.ts');
  const rows=articleRows(normalizeProductionPlans([{date:'2026-07-04',stores:[makeEntry()]}]),'variety','classic');
  const totals=articleTotals(rows),series=articleSeries(rows,'day');
  const report=buildArticlePdf({rows,totals,series,article:'Original Glazed',type:'Doughnut individuel'},{periodStart:'2026-07-04',periodEnd:'2026-07-04',scope:'Tous les magasins'});
  assert.match(report.filename,/Rapport-article_Original-Glazed/);assert.ok(report.doc.getNumberOfPages()>=1);assert.ok(report.doc.output('arraybuffer').byteLength>1000);
});

test('fallback plan filtering supports boxes, varieties, all stores and selected stores',async()=>{
  const {filterPlansForArticle}=await import('../articleAnalysis.ts');
  const plans=[{date:'2026-08-14',stores:[{store_id:'one',production_items:[{variety_id:'v'}],box_productions:[{box_id:'b'}]},{store_id:'two',production_items:[{variety_id:'other'}],box_productions:[{box_id:'b'}]}],delivery_entries:[{store_id:'one',production_items:[],box_productions:[{box_id:'b'}]}]}];
  const boxes=filterPlansForArticle(plans,{productType:'box',productId:'b',storeIds:[]});assert.equal(boxes[0].stores.length,2);assert.equal(boxes[0].delivery_entries.length,1);
  const variety=filterPlansForArticle(plans,{productType:'variety',productId:'v',storeIds:['one']});assert.equal(variety[0].stores.length,1);assert.equal(variety[0].stores[0].store_id,'one');assert.equal(variety[0].delivery_entries.length,0);
  assert.deepEqual(filterPlansForArticle(plans,{productType:'box',productId:'absent',storeIds:[]}),[]);
});

test('HTTP failures distinguish invalid parameters, permissions, database, timeout and internal errors',async()=>{
  const {classifyArticleError,isArticleFunctionUnavailable}=await import('../articleErrors.ts');
  assert.equal(classifyArticleError({status:400}).kind,'invalid_parameters');assert.equal(classifyArticleError({status:403}).kind,'unauthorized');assert.equal(classifyArticleError({status:503,code:'DATABASE_ERROR'}).kind,'database');assert.equal(classifyArticleError({status:504}).kind,'timeout');assert.equal(classifyArticleError({status:500}).kind,'internal');assert.equal(isArticleFunctionUnavailable({status:404,code:'NOT_FOUND'}),true);
});

test('authorization uses user_roles first, normalizes casing and restricts store accounts',async()=>{
  const {resolveKkOpsAuthorization,restrictRequestedStores}=await import('../../../supabase/functions/_shared/authorization.ts');
  const admin=resolveKkOpsAuthorization({role:' Admin ',store_ids:[]},{user_metadata:{role:'store'}});assert.equal(admin.role,'admin');assert.equal(admin.roleSource,'user_roles');assert.deepEqual(restrictRequestedStores(admin.role!,[],[]),[]);
  const production=resolveKkOpsAuthorization({role:'Production'},{user_metadata:{}});assert.equal(production.role,'production');
  const store=resolveKkOpsAuthorization({role:'Magasin',store_ids:['one','two']},{user_metadata:{}});assert.equal(store.role,'store');assert.deepEqual(restrictRequestedStores(store.role!,store.storeIds,[]),['one','two']);assert.deepEqual(restrictRequestedStores(store.role!,store.storeIds,['two','forbidden']),['two']);
  assert.equal(resolveKkOpsAuthorization({role:'viewer'},{user_metadata:{}}).role,null);
});
