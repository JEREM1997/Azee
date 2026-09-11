import { ANALYTICS_RULES, normalizeBuffer } from './businessRules.ts';
import { resolveSalesDate, salesDay, parseIsoDate } from './salesDate.ts';
import type { AnalyticsObservation, ConfidenceLevel, ObservationSource, ProductMetrics, ProductType, RecommendationStatus } from './types.ts';

const numberOrNull = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const median = (values: number[]) => { const sorted = [...values].sort((a,b)=>a-b); const m=Math.floor(sorted.length/2); return sorted.length%2 ? sorted[m] : (sorted[m-1]+sorted[m])/2; };
const sourceOf = (entry: any): ObservationSource => {
  if (entry?.source_type !== 'order') return 'shelf';
  if (entry?.order_type === 'b2b') return 'b2b';
  if (entry?.order_type === 'retail') return 'preorder';
  return 'external_order';
};

export const normalizeProductionPlans = (plans: any[], knownBoxIds?: Set<string>): AnalyticsObservation[] => {
  const observations: AnalyticsObservation[] = [];
  for (const plan of plans || []) {
    const entries = Array.isArray(plan?.delivery_entries) && plan.delivery_entries.length ? plan.delivery_entries : plan?.stores || [];
    for (const entry of entries) {
      const source = sourceOf(entry);
      const date = resolveSalesDate(plan.date, entry.delivery_date ?? entry.deliverydate);
      const add = (row: any, type: ProductType) => {
        const received = numberOrNull(row.received);
        const waste = numberOrNull(row.waste);
        const issues: string[] = [];
        let quality: AnalyticsObservation['quality'] = 'valid';
        if (source !== 'shelf') { quality = 'excluded'; issues.push(`Source ${source} exclue de l'assortiment rayon`); }
        if (!entry.delivery_confirmed) { quality = 'excluded'; issues.push('Livraison non confirmée'); }
        if (!entry.waste_reported) { quality = 'incomplete'; issues.push('Déchets non déclarés'); }
        if (received === null) { quality = 'incomplete'; issues.push('Quantité reçue manquante'); }
        if (waste === null) { quality = 'incomplete'; issues.push('Quantité de déchets manquante'); }
        if (received === 0) { quality = 'excluded'; issues.push('Produit non proposé (réception à zéro)'); }
        if (received !== null && received < 0) { quality = 'invalid'; issues.push('Quantité reçue négative'); }
        if (waste !== null && waste < 0) { quality = 'invalid'; issues.push('Déchets négatifs'); }
        if (received !== null && waste !== null && waste > received) { quality = 'invalid'; issues.push('Déchets supérieurs à la réception'); }
        if (type === 'box' && knownBoxIds && !knownBoxIds.has(row.box_id)) { quality = 'invalid'; issues.push('Configuration de boîte inconnue'); }
        const sold = quality === 'valid' && received !== null && waste !== null ? received - waste : null;
        observations.push({ id: `${entry.id || entry.store_id}:${type}:${row.id || row.variety_id || row.box_id}:${date}`, storeId: entry.store_id,
          storeName: entry.store_name, productType: type, productId: type === 'variety' ? row.variety_id : row.box_id,
          productName: type === 'variety' ? row.variety_name : row.box_name, productionDate: plan.date, salesDate: date, source,
          planned: Number(row.quantity) || 0, received, waste, sold, quality, issues,
          probableStockout: quality === 'valid' && received! > 0 && sold === received });
      };
      (entry.production_items || []).forEach((row:any)=>add(row,'variety'));
      (entry.box_productions || []).forEach((row:any)=>add(row,'box'));
    }
  }
  return observations;
};

export const restrictMetricsToStores = (metrics: ProductMetrics[], role: string | undefined, assignedStoreIds: string[]): ProductMetrics[] =>
  role === 'store' ? metrics.filter(metric => assignedStoreIds.includes(metric.storeId)) : metrics;

const confidence = (valid: AnalyticsObservation[], all: AnalyticsObservation[], cv: number | null) => {
  const received = valid.reduce((s,o)=>s+(o.received || 0),0);
  const occurrence = Math.min(1, valid.length / 8);
  const volume = Math.min(1, received / 80);
  const completeness = all.length ? valid.length / all.length : 0;
  const stability = Math.max(0, 1 - (cv ?? 1));
  let score = Math.round(100 * (.4*occurrence + .2*volume + .25*completeness + .15*stability));
  if (valid.length < 4) score = Math.min(score, 39);
  const level: ConfidenceLevel = score < 40 ? 'Faible' : score < 70 ? 'Moyen' : 'Élevé';
  return { score, level, reasons: [`${valid.length} occurrence${valid.length > 1 ? 's' : ''} valide${valid.length > 1 ? 's' : ''}`, `${Math.round(completeness*100)} % de complétude`, `volume reçu : ${received}`, cv === null ? 'stabilité non mesurable' : `variabilité : ${Math.round(cv*100)} %`] };
};

const classify = (m: Pick<ProductMetrics,'validCount'|'confidenceLevel'|'regularity'|'incompleteCount'|'invalidCount'|'salesRate'|'wasteRate'|'probableStockouts'|'probableStockoutRate'|'historyWeeks'>, badBothPeriods: boolean): RecommendationStatus => {
  if (m.validCount < 4) return 'À tester';
  const noAnomaly = m.incompleteCount === 0 && m.invalidCount === 0;
  if (m.salesRate < .5 && m.wasteRate > .3 && m.validCount >= 8 && m.historyWeeks >= 8 && badBothPeriods && m.confidenceLevel === 'Élevé' && noAnomaly) return 'Retrait recommandé';
  if (m.salesRate < .5 && m.wasteRate > .3 && m.confidenceLevel !== 'Faible') return 'Candidat au retrait';
  if (m.salesRate >= .95 && m.probableStockouts >= 3 && m.probableStockoutRate >= .5 && m.wasteRate <= .05 && m.confidenceLevel !== 'Faible') return 'À augmenter';
  if (m.confidenceLevel === 'Faible' || m.incompleteCount > 0 || m.invalidCount > 0 || (m.regularity ?? 1) > .4) return 'À surveiller';
  if (m.wasteRate > .2 || m.salesRate < .75) return 'À réduire';
  return 'À maintenir';
};

export const calculateProductMetrics = (current: AnalyticsObservation[], previous: AnalyticsObservation[] = [], bufferInput = ANALYTICS_RULES.initialBuffer): ProductMetrics[] => {
  const keys = new Set(current.map(o=>`${o.storeId}|${o.productType}|${o.productId}`));
  return [...keys].map(key => {
    const all = current.filter(o=>`${o.storeId}|${o.productType}|${o.productId}`===key);
    const valid = all.filter(o=>o.quality==='valid').sort((a,b)=>a.salesDate.localeCompare(b.salesDate));
    const targetDay = valid.length ? salesDay(valid.at(-1)!.salesDate) : null;
    const comparable = targetDay === null ? [] : valid.filter(o=>salesDay(o.salesDate)===targetDay);
    const comparableAll = targetDay === null ? all : all.filter(o=>salesDay(o.salesDate)===targetDay);
    const prior = previous.filter(o=>`${o.storeId}|${o.productType}|${o.productId}`===key && o.quality==='valid' && (targetDay===null || salesDay(o.salesDate)===targetDay));
    const soldValues = comparable.map(o=>o.sold!); const avg = soldValues.length ? soldValues.reduce((a,b)=>a+b,0)/soldValues.length : 0;
    const variance = soldValues.length > 1 ? soldValues.reduce((s,v)=>s+(v-avg)**2,0)/soldValues.length : 0;
    const cv = soldValues.length > 1 && avg > 0 ? Math.sqrt(variance)/avg : null;
    const received = valid.reduce((s,o)=>s+o.received!,0), sold=valid.reduce((s,o)=>s+o.sold!,0), waste=valid.reduce((s,o)=>s+o.waste!,0);
    const priorAvg = prior.length ? prior.reduce((s,o)=>s+o.sold!,0)/prior.length : null;
    const trend = priorAvg !== null ? (avg-priorAvg)/Math.max(priorAvg,1) : null;
    const conf = confidence(comparable, comparableAll, cv);
    const span = comparable.length > 1 ? 1 + (parseIsoDate(comparable.at(-1)!.salesDate).getTime()-parseIsoDate(comparable[0].salesDate).getTime())/604800000 : comparable.length;
    const midpoint = Math.floor(comparable.length/2), halves=[comparable.slice(0,midpoint),comparable.slice(midpoint)];
    const badBoth = halves.every(h=>h.length>0 && h.reduce((s,o)=>s+o.sold!,0)/h.reduce((s,o)=>s+o.received!,0)<.5 && h.reduce((s,o)=>s+o.waste!,0)/h.reduce((s,o)=>s+o.received!,0)>.3);
    const comparableReceived=comparable.reduce((s,o)=>s+o.received!,0), comparableSold=comparable.reduce((s,o)=>s+o.sold!,0), comparableWaste=comparable.reduce((s,o)=>s+o.waste!,0);
    const draft:any = { validCount:comparable.length, confidenceLevel:conf.level, regularity:cv, incompleteCount:comparableAll.filter(o=>o.quality==='incomplete').length, invalidCount:comparableAll.filter(o=>o.quality==='invalid').length,
      salesRate:comparableReceived?comparableSold/comparableReceived:0,wasteRate:comparableReceived?comparableWaste/comparableReceived:0,probableStockouts:comparable.filter(o=>o.probableStockout).length,probableStockoutRate:comparable.length?comparable.filter(o=>o.probableStockout).length/comparable.length:0,historyWeeks:span };
    const status=classify(draft,badBoth); const recent=comparable.slice(-8); const reference=recent.length ? median(recent.map(o=>o.received!)) : null;
    const trendFactor=trend===null?1:Math.min(1.15,Math.max(.85,1+trend)); const buffer=normalizeBuffer(bufferInput);
    let target=recent.length?median(recent.map(o=>o.sold!))*trendFactor*(1+buffer):null;
    if(target!==null&&reference!==null) target=Math.min(reference*(1+ANALYTICS_RULES.maxIncrease),Math.max(reference*(1-ANALYTICS_RULES.maxDecrease),target));
    let recommended=target===null?null:Math.round(target); const min=all[0].productType==='box'?2:4;
    if(recommended!==null && !['Candidat au retrait','Retrait recommandé'].includes(status)) recommended=Math.max(min,recommended);
    if(!['À augmenter','À réduire'].includes(status)) recommended=status==='À maintenir'?Math.round(reference || recommended || min):null;
    const day=targetDay; const dayName=day===null?'jours comparables':['dimanches','lundis','mardis','mercredis','jeudis','vendredis','samedis'][day];
    const reasons = comparable.length<4 ? [`Données insuffisantes : seulement ${comparable.length} ${dayName} valides disponibles. Aucune modification recommandée.`] :
      status==='À augmenter' ? [`Augmenter de ${Math.round(reference!)} à ${recommended} unités : vente totale lors de ${draft.probableStockouts} des ${comparable.length} dernières occurrences comparables, avec ${Math.round(draft.wasteRate*100)} % de déchets.`] :
      status==='À réduire' ? [`Réduire de ${Math.round(reference!)} à ${recommended} unités : moyenne de ${avg.toFixed(1)} unités vendues et ${Math.round(draft.wasteRate*100)} % de déchets sur les ${comparable.length} derniers ${dayName} valides.`] :
      [`${status} : taux de vente ${Math.round(draft.salesRate*100)} %, déchets ${Math.round(draft.wasteRate*100)} %, ${comparable.length} observations comparables valides.`];
    const first=all[0]; return { key,storeId:first.storeId,storeName:first.storeName,productType:first.productType,productId:first.productId,productName:first.productName,
      received,sold,waste,averageReceived:valid.length?received/valid.length:0,averageSold:avg,averageWaste:valid.length?waste/valid.length:0,
      salesRate:received?sold/received:0,wasteRate:received?waste/received:0,offeredDays:new Set(valid.map(o=>o.salesDate)).size,
      validCount:comparable.length,incompleteCount:draft.incompleteCount,excludedCount:comparableAll.filter(o=>o.quality==='excluded').length,invalidCount:draft.invalidCount,
      probableStockouts:draft.probableStockouts,probableStockoutRate:draft.probableStockoutRate,trend,regularity:cv,referenceQuantity:reference,recommendedQuantity:recommended,
      recommendationLabel:['Candidat au retrait','Retrait recommandé'].includes(status)?'Test minimum à '+min+' unités':recommended===null?'Aucun changement fiable':`${recommended} unités`,status,
      confidenceScore:conf.score,confidenceLevel:conf.level,confidenceReasons:conf.reasons,reasons,observations:all,comparableDay:day,historyWeeks:span };
  });
};
