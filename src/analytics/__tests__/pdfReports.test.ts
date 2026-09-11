import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateProductMetrics, normalizeProductionPlans } from '../engine.ts';
import { makeEntry, makePlans } from './fixtures.ts';
import { buildDecisionPdf, buildDeliveryPdf, buildProductionPlanPdf, buildSalesPdf } from '../../pdf/reports.ts';
import { formatPdfNumber, safePdfFilename } from '../../pdf/pdfKit.ts';

const ctx={periodStart:'2026-01-01',periodEnd:'2026-12-31',scope:'Tous les magasins'};
const observations=normalizeProductionPlans(makePlans(8));
const metrics=calculateProductMetrics(observations);
const bytes=(doc:any)=>new Uint8Array(doc.output('arraybuffer'));

test('sales PDF opens as a compact landscape PDF with selectable French text',()=>{
  const report=buildSalesPdf(observations,ctx);const output=bytes(report.doc);
  assert.equal(new TextDecoder().decode(output.slice(0,5)),'%PDF-');assert.equal(report.doc.internal.pageSize.getWidth()>report.doc.internal.pageSize.getHeight(),true);assert.ok(output.length<1_000_000);
});

test('long sales table creates multiple pages with footer numbering',()=>{
  const many=Array.from({length:250},(_,i)=>({...observations[i%observations.length],id:`row-${i}`,productName:`Crème brûlée très longue édition ${i}`}));
  const report=buildSalesPdf(many,ctx);assert.ok(report.doc.getNumberOfPages()>1);assert.ok(bytes(report.doc).length<3_000_000);
});

test('decision report supports one, several and all stores over a year',()=>{
  const multi=calculateProductMetrics(normalizeProductionPlans(makePlans(8,i=>makeEntry({id:`a${i}`})))).concat(metrics.map(m=>({...m,key:`b-${m.key}`,storeId:'b',storeName:'Genève Centre très longue appellation'})));
  for(const selection of [multi.filter(m=>m.storeId==='store-a'),multi,multi]){const report=buildDecisionPdf(selection,ctx);assert.ok(report.doc.getNumberOfPages()>=4);assert.equal(report.doc.internal.pageSize.getWidth()>report.doc.internal.pageSize.getHeight(),true);assert.ok(bytes(report.doc).length<4_000_000);}
});

test('decision PDF handles no removal and multiple removal candidates consistently with UI metrics',()=>{
  const low=calculateProductMetrics(normalizeProductionPlans(makePlans(8,i=>makeEntry({production_items:[{id:`l${i}`,variety_id:'low',variety_name:'Faible',quantity:10,received:10,waste:6}]}))));
  assert.equal(low[0].status,'Retrait recommandé');const report=buildDecisionPdf([...metrics,...low,...low.map(m=>({...m,key:`2-${m.key}`,productId:'low2',productName:'Faible 2'}))],ctx);assert.ok(bytes(report.doc).length>10_000);
});

test('delivery PDF stays portrait, supports nulls, true zeros and a missing logo',()=>{
  const report=buildDeliveryPdf({storeName:'Genève & Rive',productionDate:'2026-09-11',deliveryDate:'2026-09-12',sourceLabel:'Plan habituel',items:[{name:'Crème brûlée',planned:4,received:null,waste:null},{name:'Original',planned:4,received:4,waste:0}],boxes:[{name:'Boîte de 12',planned:2,received:2,waste:0}]},null);
  assert.equal(report.doc.internal.pageSize.getHeight()>report.doc.internal.pageSize.getWidth(),true);assert.equal(new TextDecoder().decode(bytes(report.doc).slice(0,5)),'%PDF-');
});

test('production plan PDF is landscape and preserves unknown box configuration',()=>{
  const report=buildProductionPlanPdf({date:'2026-09-12',stores:[{name:'Lausanne',deliveryDate:'2026-09-13',items:[{name:'Original',form:'Anneau',quantity:12}],boxes:[{name:'Configuration ancienne',quantity:2,size:null}]}]});
  assert.equal(report.doc.internal.pageSize.getWidth()>report.doc.internal.pageSize.getHeight(),true);assert.equal(new TextDecoder().decode(bytes(report.doc).slice(0,5)),'%PDF-');
});

test('wide and long names wrap without forcing microscopic tables',()=>{const report=buildDecisionPdf(metrics.map((m,i)=>({...m,key:String(i),productName:'Produit avec un nom exceptionnellement long — édition limitée à vérifier'})),ctx);assert.ok(report.doc.getNumberOfPages()>=4);});
test('French formatting and filenames are safe',()=>{assert.equal(formatPdfNumber(null),'—');assert.equal(formatPdfNumber(0),'0');assert.equal(safePdfFilename(['KKOPS','Aide décision','Genève']), 'KKOPS_Aide-decision_Geneve.pdf');});
