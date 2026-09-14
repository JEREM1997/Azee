import type { AnalyticsObservation, ProductMetrics } from '../analytics/types.ts';
import type { ArticleRow, ArticleSeries, ArticleTotals } from '../analytics/articleAnalysis.ts';
import { addContainedImage, addDataTable, addDocumentFooters, addDocumentHeader, addEmptyMessage, addKpiCard, addSectionTitle, createPdf, ensurePageSpace, formatPdfDate, formatPdfNumber, formatPdfPercent, formatWritableValue, safePdfFilename, PDF_COLORS, PDF_FOOTER, PDF_MARGIN, type PdfImage } from './pdfKit.ts';

export interface ReportContext { periodStart:string;periodEnd:string;scope:string;logo?:PdfImage|null;generatedAt?:Date }
const period=(ctx:ReportContext)=>`${ctx.periodStart} — ${ctx.periodEnd}`;
const validSalesRows=(observations:AnalyticsObservation[])=>observations.filter(o=>o.quality==='valid');

export const buildArticlePdf=(args:{rows:ArticleRow[];series:ArticleSeries[];totals:ArticleTotals;article:string;type:string},ctx:ReportContext)=>{
  const doc=createPdf('landscape',{title:`Rapport article - ${args.article}`,subject:'Production, réception, ventes et déchets'}),generated=ctx.generatedAt||new Date();
  let y=addDocumentHeader(doc,{title:'Rapport d’analyse par article',subtitle:`${args.article} · ${args.type}`,period:period(ctx),scope:ctx.scope,logo:ctx.logo});
  const c=args.totals.coverage,detail=(known:number)=>known===c.totalLines?`${known}/${c.totalLines} lignes complètes`:`Partiel · ${known}/${c.totalLines} lignes`;
  const cards=[['PRÉVU / PRODUIT',formatPdfNumber(args.totals.planned),detail(c.totalLines)],['RÉCEPTIONNÉ',formatPdfNumber(args.totals.received),detail(c.receivedKnownLines)],['VENDU',formatPdfNumber(args.totals.sold),detail(c.soldKnownLines)],['DÉCHETS',formatPdfNumber(args.totals.waste),detail(c.wasteKnownLines)],['TAUX DÉCHETS',formatPdfPercent(args.totals.wasteRate),detail(c.completeLines)],['ÉCART RÉCEPTION',formatPdfNumber(args.totals.receptionGap),detail(c.receivedKnownLines)]];
  const width=(doc.internal.pageSize.getWidth()-PDF_MARGIN*2-15)/6;cards.forEach(([label,value,cardDetail],i)=>addKpiCard(doc,{x:PDF_MARGIN+i*(width+3),y,width,label,value,detail:cardDetail}));y+=34;
  y=addSectionTitle(doc,'Évolution des volumes',y);
  if(args.series.length){const x=PDF_MARGIN+8,w=doc.internal.pageSize.getWidth()-PDF_MARGIN*2-16,h=46,max=Math.max(1,...args.series.flatMap(s=>[s.planned,s.received,s.sold,s.waste].filter((v):v is number=>v!==null)));
    doc.setDrawColor(...PDF_COLORS.line);doc.line(x,y+h,x+w,y+h);const colors=[PDF_COLORS.green,[54,121,184] as const,[4,106,56] as const,PDF_COLORS.red],keys=['planned','received','sold','waste'] as const;
    keys.forEach((key,ki)=>{doc.setDrawColor(...colors[ki]);doc.setLineWidth(.7);let previous:null|[number,number]=null;args.series.forEach((point,i)=>{const value=point[key];if(value===null){previous=null;return;}const px=x+(args.series.length===1?w/2:i*w/(args.series.length-1)),py=y+h-value/max*h;if(previous)doc.line(previous[0],previous[1],px,py);doc.circle(px,py,.7,'F');previous=[px,py];});});
    doc.setFontSize(7);doc.setTextColor(...PDF_COLORS.muted);doc.text(args.series[0].label,x,y+h+5);if(args.series.length>1)doc.text(args.series.at(-1)!.label,x+w,y+h+5,{align:'right'});y+=h+12;
  }else y=addEmptyMessage(doc,'Aucune série disponible.',y);
  y=addSectionTitle(doc,'Détail des observations',y+3);
  addDataTable(doc,{y,head:[['Production','Livraison / vente','Magasin','Article','Prévu','Reçu','Déchets','Vendu','Taux','Complétude']],body:args.rows.map(r=>[formatPdfDate(r.productionDate),formatPdfDate(r.salesDate),r.storeName,r.productName,formatPdfNumber(r.planned),formatPdfNumber(r.receivedKnown?r.received:null),formatPdfNumber(r.wasteKnown?r.waste:null),formatPdfNumber(r.sold),r.status==='Complet'&&r.received!==null&&r.received>0?formatPdfPercent(r.waste!/r.received):'—',r.status]),compact:true,columnStyles:{0:{cellWidth:22},1:{cellWidth:25},2:{cellWidth:33},3:{cellWidth:45},4:{cellWidth:17,halign:'right'},5:{cellWidth:17,halign:'right'},6:{cellWidth:17,halign:'right'},7:{cellWidth:17,halign:'right'},8:{cellWidth:18,halign:'right'},9:{cellWidth:37}}});
  addDocumentFooters(doc,{documentName:`Analyse article - ${args.article}`,period:period(ctx),generatedAt:generated});return{doc,filename:safePdfFilename(['KKOPS','Rapport-article',args.article,ctx.periodStart,ctx.periodEnd])};
};

export const buildSalesPdf=(observations:AnalyticsObservation[],ctx:ReportContext,storeName?:string)=>{
  const doc=createPdf('landscape',{title:storeName?`Rapport de ventes — ${storeName}`:'Rapport de ventes',subject:'Ventes et déchets confirmés'});
  let y=addDocumentHeader(doc,{title:storeName?'Rapport magasin':'Rapport de ventes et déchets',subtitle:'Ventes confirmées et qualité opérationnelle',period:period(ctx),scope:storeName||ctx.scope,logo:ctx.logo});
  const rows=validSalesRows(observations).filter(o=>!storeName||o.storeName===storeName);
  const received=rows.reduce((s,o)=>s+o.received!,0),sold=rows.reduce((s,o)=>s+o.sold!,0),waste=rows.reduce((s,o)=>s+o.waste!,0);
  const width=(doc.internal.pageSize.getWidth()-PDF_MARGIN*2-9)/4;
  [['REÇU',formatPdfNumber(received)],['VENDU',formatPdfNumber(sold)],['DÉCHETS',formatPdfNumber(waste)],['TAUX DE DÉCHETS',formatPdfPercent(received?waste/received:0)]].forEach(([label,value],i)=>addKpiCard(doc,{x:PDF_MARGIN+i*(width+3),y,width,label,value})); y+=34;
  y=addSectionTitle(doc,'Détail des observations',y,'Données confirmées');
  if(rows.length)y=addDataTable(doc,{y,head:[['Date','Magasin','Produit','Type','Reçu','Vendu','Déchets','Taux déchets']],body:rows.map(o=>[o.salesDate,o.storeName,o.productName,o.productType==='box'?'Boîte':'Individuel',formatPdfNumber(o.received),formatPdfNumber(o.sold),formatPdfNumber(o.waste),formatPdfPercent(o.received?o.waste!/o.received:0)]),columnStyles:{4:{halign:'right'},5:{halign:'right'},6:{halign:'right'},7:{halign:'right'}}});else y=addEmptyMessage(doc,'Aucune observation confirmée pour ce périmètre.',y);
  addDocumentFooters(doc,{documentName:storeName?'Rapport magasin':'Rapport de ventes',period:period(ctx),generatedAt:ctx.generatedAt});
  return {doc,filename:safePdfFilename(['KKOPS',storeName?'Rapport-magasin':'Rapport-ventes',storeName||ctx.scope,ctx.periodStart,ctx.periodEnd])};
};

const statusOrder=['Retrait recommandé','Candidat au retrait','À réduire','À augmenter','À surveiller','À tester','À maintenir'];
export const buildDecisionPdf=(metrics:ProductMetrics[],ctx:ReportContext,includeAnnex=false)=>{
  const doc=createPdf('landscape',{title:'Rapport d’aide à la décision',subject:'Performance des produits par point de vente'}),generated=ctx.generatedAt||new Date();
  const pageW=doc.internal.pageSize.getWidth(),pageH=doc.internal.pageSize.getHeight();
  doc.setFillColor(...PDF_COLORS.green);doc.rect(0,0,pageW,pageH,'F');doc.setFillColor(...PDF_COLORS.white);doc.roundedRect(18,22,pageW-36,pageH-44,5,5,'F');const coverLogo=addContainedImage(doc,ctx.logo,30,31,48,18);doc.setCharSpace(0);doc.setTextColor(...PDF_COLORS.green);doc.setFont('helvetica','bold');doc.setFontSize(10);if(!coverLogo)doc.text('KRISPY KREME / KK OPS',30,44);doc.setTextColor(...PDF_COLORS.ink);doc.setFontSize(30);doc.text('Rapport d’aide à la décision',30,72);doc.setFont('helvetica','normal');doc.setFontSize(15);doc.text('Performance des produits par point de vente',30,84);doc.setDrawColor(...PDF_COLORS.line);doc.line(30,99,pageW-30,99);doc.setFontSize(10);doc.text(`Période analysée : ${period(ctx)}`,30,115);doc.text(`Périmètre : ${ctx.scope}`,30,125);doc.text(`Généré le : ${generated.toLocaleString('fr-CH')}`,30,135);doc.setTextColor(...PDF_COLORS.red);doc.setFont('helvetica','bold');doc.text('DOCUMENT INTERNE ET CONFIDENTIEL - DIFFUSION CONTRÔLÉE',30,pageH-38);
  doc.addPage();let y=addDocumentHeader(doc,{title:'Résumé exécutif',subtitle:'Indicateurs consolidés du périmètre sélectionné',period:period(ctx),scope:ctx.scope,logo:ctx.logo});
  const received=metrics.reduce((s,m)=>s+m.received,0),sold=metrics.reduce((s,m)=>s+m.sold,0),waste=metrics.reduce((s,m)=>s+m.waste,0),valid=metrics.reduce((s,m)=>s+m.validCount,0),incomplete=metrics.reduce((s,m)=>s+m.incompleteCount+m.excludedCount+m.invalidCount,0);
  const cards=[['VENTES RÉELLES',formatPdfNumber(sold)],['QUANTITÉ REÇUE',formatPdfNumber(received)],['DÉCHETS',formatPdfNumber(waste)],['TAUX DÉCHETS',formatPdfPercent(received?waste/received:0)],['MAGASINS',String(new Set(metrics.map(m=>m.storeId)).size)],['PRODUITS',String(metrics.length)],['OBSERVATIONS VALIDES',String(valid)],['COMPLÉTUDE',formatPdfPercent(valid+incomplete?valid/(valid+incomplete):0)]];const cw=(pageW-PDF_MARGIN*2-9)/4;cards.forEach(([label,value],i)=>addKpiCard(doc,{x:PDF_MARGIN+(i%4)*(cw+3),y:y+Math.floor(i/4)*30,width:cw,label,value}));y+=68;
  y=addSectionTitle(doc,'Actions prioritaires',y,'Décisions recommandées');const actions=[...metrics].filter(m=>m.status!=='À maintenir').sort((a,b)=>statusOrder.indexOf(a.status)-statusOrder.indexOf(b.status));
  if(actions.length){
    y=addDataTable(doc,{y,head:[['Magasin','Produit','Action','Actuel','Recommandé','Vente','Déchets','Confiance']],body:actions.slice(0,20).map(m=>[m.storeName,m.productName,m.status,formatPdfNumber(m.referenceQuantity),m.recommendationLabel,formatPdfPercent(m.salesRate),formatPdfPercent(m.wasteRate),`${m.confidenceScore}/100`]),columnStyles:{0:{cellWidth:38},1:{cellWidth:57},2:{cellWidth:36},3:{halign:'right',cellWidth:18},4:{cellWidth:35},5:{halign:'right',cellWidth:20},6:{halign:'right',cellWidth:20},7:{halign:'right',cellWidth:20}}});
    y=ensurePageSpace(doc,y+8,28,()=>addDocumentHeader(doc,{title:'Actions prioritaires - détails',period:period(ctx),scope:ctx.scope,logo:ctx.logo}));
    y=addSectionTitle(doc,'Motifs des décisions principales',y+8);
    actions.slice(0,10).forEach(metric=>{
      const reason=metric.reasons.slice(0,2).join(' ')||'Aucun motif complémentaire disponible.';
      const titleLines=doc.splitTextToSize(`${metric.storeName} - ${metric.productName}`,pageW-PDF_MARGIN*2-10);
      const reasonLines=doc.splitTextToSize(`Motif : ${reason}`,pageW-PDF_MARGIN*2-10);
      const detailY=11+(titleLines.length-1)*4,reasonY=detailY+5;
      const blockHeight=reasonY+reasonLines.length*4+2;
      y=ensurePageSpace(doc,y,blockHeight,()=>addDocumentHeader(doc,{title:'Actions prioritaires - détails',period:period(ctx),scope:ctx.scope,logo:ctx.logo}));
      doc.setFillColor(...PDF_COLORS.paper);doc.setDrawColor(...PDF_COLORS.line);doc.roundedRect(PDF_MARGIN,y,pageW-PDF_MARGIN*2,blockHeight-2,2,2,'FD');
      doc.setCharSpace(0);doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...PDF_COLORS.ink);doc.text(titleLines,PDF_MARGIN+5,y+6);
      doc.setFontSize(8);doc.setTextColor(...PDF_COLORS.green);doc.text(`${metric.status} | ${formatPdfNumber(metric.referenceQuantity)} -> ${metric.recommendationLabel}`,PDF_MARGIN+5,y+detailY);
      doc.setFont('helvetica','normal');doc.setTextColor(...PDF_COLORS.muted);doc.text(`Vente : ${formatPdfPercent(metric.salesRate)} | Déchets : ${formatPdfPercent(metric.wasteRate)} | Confiance : ${metric.confidenceScore}/100`,pageW-PDF_MARGIN-5,y+detailY,{align:'right'});
      doc.setTextColor(...PDF_COLORS.ink);doc.text(reasonLines,PDF_MARGIN+5,y+reasonY);y+=blockHeight+3;
    });
  }else y=addEmptyMessage(doc,'Aucune action prioritaire sur la période.',y);
  doc.addPage();y=addDocumentHeader(doc,{title:'Synthèse par magasin',subtitle:'Vue compacte des enjeux et actions',period:period(ctx),scope:ctx.scope,logo:ctx.logo});const storeRows=[...new Set(metrics.map(m=>m.storeName))].sort().map(name=>{const rows=metrics.filter(m=>m.storeName===name),r=rows.reduce((s,m)=>s+m.received,0),d=rows.reduce((s,m)=>s+m.waste,0);return[name,rows.length,formatPdfPercent(r?d/r:0),rows.filter(m=>m.status==='À augmenter').length,rows.filter(m=>m.status==='À réduire').length,rows.filter(m=>m.status.includes('retrait')).length,rows.filter(m=>m.status==='À surveiller'||m.status==='À tester').length];});addDataTable(doc,{y,head:[['Magasin','Produits','Déchets','À augmenter','À réduire','Retraits','À suivre']],body:storeRows,columnStyles:{0:{cellWidth:72},1:{halign:'right',cellWidth:24},2:{halign:'right',cellWidth:28},3:{halign:'right',cellWidth:30},4:{halign:'right',cellWidth:28},5:{halign:'right',cellWidth:25},6:{halign:'right',cellWidth:25}}});
  if(includeAnnex){for(const storeName of [...new Set(metrics.map(m=>m.storeName))].sort()){doc.addPage();y=addDocumentHeader(doc,{title:`Annexe - ${storeName}`,subtitle:'Détail complet des produits',period:period(ctx),scope:storeName,logo:ctx.logo});const rows=metrics.filter(m=>m.storeName===storeName);y=addSectionTitle(doc,'Performance des produits',y);y=addDataTable(doc,{y,head:[['Produit','Type','Reçu','Vendu','Déchets','Taux vente','Taux déchets','Statut']],body:rows.map(m=>[m.productName,m.productType==='box'?'Boîte':'Individuel',m.received,m.sold,m.waste,formatPdfPercent(m.salesRate),formatPdfPercent(m.wasteRate),m.status]),columnStyles:{0:{cellWidth:72},1:{cellWidth:28},2:{halign:'right'},3:{halign:'right'},4:{halign:'right'},5:{halign:'right'},6:{halign:'right'},7:{cellWidth:42}}});y=ensurePageSpace(doc,y+8,35,()=>addDocumentHeader(doc,{title:`${storeName} - recommandations`,period:period(ctx),scope:storeName,logo:ctx.logo}));y=addSectionTitle(doc,'Recommandations et confiance',y+8);addDataTable(doc,{y,head:[['Produit','Ruptures probables','Tendance','Actuel','Recommandé','Confiance']],body:rows.map(m=>[m.productName,`${m.probableStockouts} sur ${m.validCount}`,m.trend==null?'—':formatPdfPercent(m.trend),formatPdfNumber(m.referenceQuantity),m.recommendationLabel,`${m.confidenceLevel} - ${m.confidenceScore}/100`]),columnStyles:{0:{cellWidth:82},1:{cellWidth:38},2:{halign:'right'},3:{halign:'right'},4:{cellWidth:48},5:{cellWidth:42}}});}}
  doc.addPage();y=addDocumentHeader(doc,{title:'Lecture transversale par produit',subtitle:'Les écarts entre magasins sont des signaux à examiner, pas des causalités démontrées.',period:period(ctx),scope:ctx.scope,logo:ctx.logo});const products=new Map<string,ProductMetrics[]>();metrics.forEach(m=>products.set(`${m.productType}:${m.productId}`,[...(products.get(`${m.productType}:${m.productId}`)||[]),m]));addDataTable(doc,{y,head:[['Produit','Type','Magasins','Meilleur taux','Plus faible taux','Lecture']],body:[...products.values()].map(rows=>{const rates=rows.map(r=>r.salesRate);return[rows[0].productName,rows[0].productType==='box'?'Boîte':'Individuel',rows.length,formatPdfPercent(Math.max(...rates)),formatPdfPercent(Math.min(...rates)),Math.max(...rates)-Math.min(...rates)>.25?'Résultats contrastés selon les magasins':'Performance relativement homogène'];}),columnStyles:{0:{cellWidth:68},1:{cellWidth:25},2:{halign:'right',cellWidth:22},3:{halign:'right',cellWidth:28},4:{halign:'right',cellWidth:28},5:{cellWidth:80}}});
  doc.addPage();y=addDocumentHeader(doc,{title:'Qualité des données et méthodologie',period:period(ctx),scope:ctx.scope,logo:ctx.logo});y=addSectionTitle(doc,'Qualité et limites',y);doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setCharSpace(0);doc.setTextColor(...PDF_COLORS.ink);const quality=[`Observations valides : ${valid}. Observations incomplètes ou exclues : ${incomplete}.`,'Les commandes externes et B2B sont exclues par défaut de l’analyse rayon.','Une vente totale signale une rupture probable. Elle ne prouve pas une demande non servie.','Les recommandations sont des aides à la décision et nécessitent une validation humaine.'];quality.forEach(line=>{const wrapped=doc.splitTextToSize(`- ${line}`,pageW-PDF_MARGIN*2);doc.text(wrapped,PDF_MARGIN,y);y+=wrapped.length*5+5;});y=ensurePageSpace(doc,y,65);y=addSectionTitle(doc,'Méthodologie',y);['Ventes réelles = quantité reçue - déchets.','Taux de vente = total vendu / total reçu.','Taux de déchets = total déchets / total reçu.','Les recommandations utilisent le même jour de semaine. La production du vendredi correspond aux ventes du samedi.','La confiance combine le nombre d’occurrences, le volume, la complétude et la stabilité. Elle reste faible sous quatre occurrences.','Un retrait recommandé exige au moins huit occurrences, huit semaines, deux sous-périodes faibles, une confiance élevée et aucune anomalie explicative.'].forEach(line=>{const wrapped=doc.splitTextToSize(`- ${line}`,pageW-PDF_MARGIN*2);doc.text(wrapped,PDF_MARGIN,y);y+=wrapped.length*5+5;});
  addDocumentFooters(doc,{documentName:'Aide à la décision',period:period(ctx),generatedAt:generated});return{doc,filename:safePdfFilename(['KKOPS',includeAnnex?'Aide-decision-detail-annexes':'Aide-decision-synthese',ctx.scope,ctx.periodStart,ctx.periodEnd])};
};

export interface DeliveryPdfData {storeName:string;productionDate?:string;deliveryDate:string;sourceLabel:string;reference?:string;customerName?:string;customerPhone?:string;orderType?:string;paymentStatus?:string;companyName?:string;billingAddress?:string;deliveryAddress?:string;conditioning?:string;handledBy?:string;deliveredBy?:string;comments?:string;items:Array<{name:string;conditioning?:string;planned:number;received:number|null;waste:number|null}>;boxes:Array<{name:string;planned:number;received:number|null;waste:number|null}>}
const present=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0;
const orderTypeLabel=(value:string)=>({b2b:'B2B',retail:'Retail'}[value.toLowerCase()]||value);
const paymentStatusLabel=(value:string)=>({a_facturer:'À facturer',deja_paye:'Déjà payé',a_la_livraison:'À la livraison'}[value.toLowerCase()]||value);
export const buildDeliveryPdf=(data:DeliveryPdfData,logo?:PdfImage|null)=>{
  const doc=createPdf('portrait',{title:`Bon de livraison - ${data.storeName}`,subject:'Contrôle de livraison'});
  let y=addDocumentHeader(doc,{title:'Bon de livraison',subtitle:data.sourceLabel,period:data.deliveryDate,scope:data.storeName,logo});
  const isOrder=/commande|b2b|client|externe/i.test(data.sourceLabel)||!!data.reference;
  const showConditioning=isOrder&&data.items.some(item=>present(item.conditioning));
  const documentInfo:[string,string][]=[['Magasin demandeur',data.storeName],['Date de livraison',data.deliveryDate]];
  if(present(data.productionDate))documentInfo.push(['Date de production',data.productionDate]);
  if(present(data.reference))documentInfo.push(['Référence',data.reference]);
  y=addDataTable(doc,{y,head:[['Commande','Information']],body:documentInfo,compact:true})+4;
  if(isOrder){
    const customerInfo:[string,string][]=[];
    if(present(data.customerName))customerInfo.push(['Nom du client',data.customerName.trim()]);
    if(present(data.customerPhone))customerInfo.push(['Téléphone',data.customerPhone.trim()]);
    if(present(data.orderType))customerInfo.push(['Type de commande',orderTypeLabel(data.orderType.trim())]);
    if(present(data.paymentStatus))customerInfo.push(['Statut de facturation',paymentStatusLabel(data.paymentStatus.trim())]);
    if(present(data.companyName))customerInfo.push(['Société',data.companyName.trim()]);
    if(present(data.billingAddress))customerInfo.push(['Adresse de facturation',data.billingAddress.trim()]);
    if(present(data.deliveryAddress))customerInfo.push(['Adresse de livraison',data.deliveryAddress.trim()]);
    if(present(data.conditioning))customerInfo.push(['Conditionnement général',data.conditioning.trim()]);
    if(present(data.comments))customerInfo.push(['Commentaire',data.comments.trim()]);
    if(present(data.handledBy))customerInfo.push(['Commande saisie par',data.handledBy.trim()]);
    if(present(data.deliveredBy))customerInfo.push(['Livraison effectuée par',data.deliveredBy.trim()]);
    if(customerInfo.length){y=addSectionTitle(doc,'Client et livraison',y);y=addDataTable(doc,{y,head:[['Champ','Valeur']],body:customerInfo,compact:true})+4;}
  }
  y=addSectionTitle(doc,'Doughnuts individuels',y);
  const itemHead=showConditioning?['Produit','Conditionnement','Prévu','Reçu','Déchets']:['Produit','Prévu','Reçu','Déchets'];
  const itemBody=data.items.map(item=>showConditioning
    ?[item.name,item.conditioning||'',item.planned,formatWritableValue(item.received),formatWritableValue(item.waste)]
    :[item.name,item.planned,formatWritableValue(item.received),formatWritableValue(item.waste)]);
  const standardColumns={0:{cellWidth:76,minCellHeight:8},1:{halign:'right',cellWidth:22,minCellHeight:8},2:{halign:'center',cellWidth:41,minCellHeight:8},3:{halign:'center',cellWidth:41,minCellHeight:8}};
  const orderColumns={0:{cellWidth:52,minCellHeight:8},1:{cellWidth:31,minCellHeight:8},2:{halign:'right',cellWidth:19,minCellHeight:8},3:{halign:'center',cellWidth:39,minCellHeight:8},4:{halign:'center',cellWidth:39,minCellHeight:8}};
  y=data.items.length?addDataTable(doc,{y,head:[itemHead],body:itemBody,compact:true,columnStyles:showConditioning?orderColumns:standardColumns}):addEmptyMessage(doc,'Aucun doughnut individuel.',y);
  if(data.boxes.length){
    y=addSectionTitle(doc,'Boîtes',y+4);
    y=addDataTable(doc,{y,head:[['Boîte','Prévu','Reçu','Déchets']],body:data.boxes.map(box=>[box.name,box.planned,formatWritableValue(box.received),formatWritableValue(box.waste)]),compact:true,columnStyles:standardColumns});
  }
  const pageHeight=doc.internal.pageSize.getHeight();
  let receptionY=Math.max(y+4,pageHeight-37);
  if(receptionY+16>pageHeight-PDF_FOOTER){doc.addPage();receptionY=addDocumentHeader(doc,{title:'Bon de livraison - suite',subtitle:data.sourceLabel,period:data.deliveryDate,scope:data.storeName,logo})+4;}
  doc.setDrawColor(...PDF_COLORS.line);doc.roundedRect(PDF_MARGIN,receptionY,doc.internal.pageSize.getWidth()-PDF_MARGIN*2,16,2,2,'S');
  doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...PDF_COLORS.muted);doc.text('RÉCEPTION MAGASIN',PDF_MARGIN+4,receptionY+5);
  doc.setFont('helvetica','normal');doc.text('Nom / initiales :',PDF_MARGIN+4,receptionY+11);doc.text('Heure :',92,receptionY+11);doc.text('Signature :',135,receptionY+11);
  addDocumentFooters(doc,{documentName:'Bon de livraison',period:data.deliveryDate});
  return{doc,filename:safePdfFilename(['KKOPS','Bon-livraison',data.storeName,data.deliveryDate])};
};

export interface ProductionPlanPdfData {date:string;stores:Array<{name:string;deliveryDate:string;items:Array<{name:string;form:string;quantity:number}>;boxes:Array<{name:string;quantity:number;size:number|null}>}>}
export const buildProductionPlanPdf=(data:ProductionPlanPdfData,logo?:PdfImage|null)=>{const doc=createPdf('landscape',{title:`Plan de production - ${data.date}`,subject:'Instructions de production par magasin'});let y=addDocumentHeader(doc,{title:'Plan de production',subtitle:'Volumes à préparer par point de vente',period:data.date,scope:`${data.stores.length} magasin(s)`,logo});const total=data.stores.reduce((s,store)=>s+store.items.reduce((a,i)=>a+i.quantity,0)+store.boxes.reduce((a,b)=>a+b.quantity*(b.size||0),0),0);addKpiCard(doc,{x:PDF_MARGIN,y,width:60,label:'ÉQUIVALENT DOUGHNUTS TOTAL',value:formatPdfNumber(total)});addKpiCard(doc,{x:PDF_MARGIN+64,y,width:60,label:'MAGASINS',value:String(data.stores.length)});y+=34;for(const store of data.stores){y=ensurePageSpace(doc,y,55,()=>addDocumentHeader(doc,{title:'Plan de production - suite',period:data.date,scope:store.name,logo}));y=addSectionTitle(doc,store.name,y,`Livraison ${store.deliveryDate}`);if(store.items.length)y=addDataTable(doc,{y,head:[['Variété','Forme','Quantité sans réserve','Forme avec réserve 5 %']],body:store.items.map(i=>[i.name,i.form,i.quantity,Math.ceil(i.quantity*1.05)]),columnStyles:{2:{halign:'right'},3:{halign:'right'}}});if(store.boxes.length){y=ensurePageSpace(doc,y+7,30);y=addSectionTitle(doc,'Boîtes',y+7);y=addDataTable(doc,{y,head:[['Configuration','Nombre de boîtes','Taille','Équivalent doughnuts']],body:store.boxes.map(b=>[b.name,b.quantity,b.size==null?'Donnée inconnue':b.size,b.size==null?'Donnée inconnue':b.quantity*b.size]),columnStyles:{1:{halign:'right'},2:{halign:'right'},3:{halign:'right'}}});}y+=9;}addDocumentFooters(doc,{documentName:'Plan de production',period:data.date});return{doc,filename:safePdfFilename(['KKOPS','Plan-production',data.date])};};
