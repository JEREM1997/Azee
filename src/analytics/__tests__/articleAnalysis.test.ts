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
  assert.deepEqual(rows.map(r=>r.status),['Réception manquante','Déchets non renseignés']);
  const totals=articleTotals(rows);assert.equal(totals.received,null);assert.equal(totals.waste,null);assert.equal(totals.sold,null);assert.equal(totals.wasteRate,null);
});

test('anomalies and Friday sales mapping are retained in table and chart totals',()=>{
  const plans=[{date:'2026-07-03',stores:[makeEntry({production_items:[{id:'a',variety_id:'v',variety_name:'V',quantity:8,received:7,waste:9}]})]}];
  const rows=articleRows(normalizeProductionPlans(plans),'variety','v');
  assert.equal(rows[0].salesDate,'2026-07-04');assert.equal(rows[0].status,'Anomalie');assert.equal(rows[0].sold,null);
  assert.deepEqual(articleSeries(rows,'day')[0],{label:'2026-07-04',planned:8,received:7,waste:9,sold:null,wasteRate:9/7,receptionGap:1});
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
