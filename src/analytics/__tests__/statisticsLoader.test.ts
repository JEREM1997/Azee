import test from 'node:test';
import assert from 'node:assert/strict';
import { canExportStatistics, friendlyStatisticsError, loadStatisticsWindows, splitIntoMonthlyBatches } from '../../services/statisticsLoader.ts';

const daysInBatches = (start:string,end:string) => splitIntoMonthlyBatches({start,end}).flatMap(batch => {
  const values:string[]=[]; let date=new Date(`${batch.start}T12:00:00Z`); const last=new Date(`${batch.end}T12:00:00Z`);
  while(date<=last){ values.push(date.toISOString().slice(0,10)); date=new Date(date.getTime()+86400000); } return values;
});

test('monthly splitting supports day, week, month and multi-month windows',()=>{
  assert.equal(splitIntoMonthlyBatches({start:'2026-09-11',end:'2026-09-11'}).length,1);
  assert.equal(splitIntoMonthlyBatches({start:'2026-09-07',end:'2026-09-13'}).length,1);
  assert.equal(splitIntoMonthlyBatches({start:'2026-08-01',end:'2026-08-31'}).length,1);
  assert.equal(splitIntoMonthlyBatches({start:'2026-07-18',end:'2026-09-11'}).length,3);
});

test('month boundaries cover 28, 29, 30 and 31 days without gaps or duplicates',()=>{
  for(const [start,end,count] of [['2025-02-01','2025-02-28',28],['2024-02-01','2024-02-29',29],['2026-04-01','2026-04-30',30],['2026-01-01','2026-01-31',31]] as const){
    const days=daysInBatches(start,end); assert.equal(days.length,count); assert.equal(new Set(days).size,count); assert.equal(days[0],start); assert.equal(days.at(-1),end);
  }
});

test('full year and periods over one year cross years exactly',()=>{
  assert.equal(daysInBatches('2026-01-01','2026-12-31').length,365);
  assert.equal(daysInBatches('2023-07-01','2024-07-01').length,367);
  assert.equal(splitIntoMonthlyBatches({start:'2025-11-15',end:'2026-02-12'}).length,4);
});

test('current and previous periods load together with bounded concurrency and no duplicate network call',async()=>{
  let active=0,maxActive=0,calls=0;
  const result=await loadStatisticsWindows({current:{start:'2026-01-01',end:'2026-03-31'},previous:{start:'2025-10-01',end:'2025-12-31'},concurrency:2,retries:0,
    fetchBatch:async(start)=>{calls++;active++;maxActive=Math.max(maxActive,active);await new Promise(r=>setTimeout(r,2));active--;return [{id:start,date:start}];}});
  assert.equal(calls,6); assert.equal(result.requestCount,6); assert.ok(maxActive<=2); assert.equal(result.current.length,3); assert.equal(result.previous.length,3);
});

test('failed and timed-out batches are reported and retried once',async()=>{
  const attempts=new Map<string,number>();
  const result=await loadStatisticsWindows({current:{start:'2026-01-01',end:'2026-02-28'},previous:{start:'2025-12-01',end:'2025-12-31'},retries:1,fetchBatch:async(start)=>{
    attempts.set(start,(attempts.get(start)||0)+1); if(start==='2026-01-01') throw Object.assign(new Error('statement timeout'),{code:'57014',status:500}); return [{id:start,date:start}]; }});
  assert.equal(attempts.get('2026-01-01'),2); assert.equal(result.failures.length,1); assert.equal(result.failures[0].code,'57014');
  assert.match(friendlyStatisticsError(result.failures[0]),/Délai d’exécution/);
});

test('non-2xx statuses produce useful safe messages',()=>{
  assert.match(friendlyStatisticsError({message:'failure',status:500}),/HTTP 500/);
  assert.match(friendlyStatisticsError({message:'failure',status:401}),/session/);
});

test('exports stay disabled for errors, loading and partial results',()=>{
  assert.equal(canExportStatistics('error',10),false); assert.equal(canExportStatistics('partial',10),false);
  assert.equal(canExportStatistics('loading',10),false); assert.equal(canExportStatistics('success',0),false); assert.equal(canExportStatistics('success',10),true);
});

test('stale searches are ignored',async()=>{
  let stale=false;
  await assert.rejects(loadStatisticsWindows({current:{start:'2026-01-01',end:'2026-01-31'},previous:{start:'2025-12-01',end:'2025-12-31'},isStale:()=>stale,fetchBatch:async(start)=>{stale=true;return [{id:start,date:start}];}}),/recherche plus récente/);
});

test('chunked and short loading return identical plans',async()=>{
  const plans=[{id:'1',date:'2026-01-10'},{id:'2',date:'2026-02-10'}];
  const result=await loadStatisticsWindows({current:{start:'2026-01-01',end:'2026-02-28'},previous:{start:'2025-11-01',end:'2025-12-31'},fetchBatch:async(start,end)=>plans.filter(p=>p.date>=start&&p.date<=end)});
  assert.deepEqual(result.current,plans);
});

test('realistic 365-day load remains complete for all stores/products',async()=>{
  const stores=20, varieties=30, boxes=5; let rows=0;
  const result=await loadStatisticsWindows({current:{start:'2026-01-01',end:'2026-12-31'},previous:{start:'2025-01-01',end:'2025-12-31'},concurrency:3,retries:0,fetchBatch:async(start)=>{
    const plans=Array.from({length:stores},(_,store)=>({id:`${start}-${store}`,date:start,items:varieties,boxes})); rows+=plans.length; return plans; }});
  assert.equal(result.requestCount,24); assert.equal(result.failures.length,0); assert.equal(result.current.length,240); assert.equal(result.previous.length,240); assert.equal(rows,480);
});
