export const makeEntry = (overrides: Record<string, unknown> = {}) => ({
  id: 'entry', store_id: 'store-a', store_name: 'Lausanne', delivery_confirmed: true, waste_reported: true,
  production_items: [{ id:'item', variety_id:'classic', variety_name:'Original Glazed', quantity:8, received:8, waste:0 }],
  box_productions: [], ...overrides,
});

export const makePlans = (count: number, entryFactory: (index:number)=>any = ()=>makeEntry()) => Array.from({length:count},(_,index)=>{
  const date = new Date(Date.UTC(2026, 6, 4 + index * 7, 12)).toISOString().slice(0, 10);
  return { id:`plan-${index}`, date, stores:[entryFactory(index)] };
});
