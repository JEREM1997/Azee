const DAY_MS = 86_400_000;

export const parseIsoDate = (value: string): Date => new Date(`${value.slice(0, 10)}T12:00:00Z`);
export const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);
export const addDays = (value: string, days: number): string =>
  toIsoDate(new Date(parseIsoDate(value).getTime() + days * DAY_MS));

/** deliveryDate is the authoritative sales date. Friday plans shift only when no delivery date exists. */
export const resolveSalesDate = (productionDate: string, deliveryDate?: string | null): string => {
  if (deliveryDate) return deliveryDate.slice(0, 10);
  return parseIsoDate(productionDate).getUTCDay() === 5 ? addDays(productionDate, 1) : productionDate;
};

export const salesDay = (date: string): number => parseIsoDate(date).getUTCDay();

export interface DateWindow { start: string; end: string }
export interface ComparisonWindows { current: DateWindow; previous: DateWindow }

export const getComparisonWindows = (args: {
  period: 'day' | 'range' | 'month' | 'year'; date: string; start: string; end: string; month: number; year: number;
}): ComparisonWindows => {
  let current: DateWindow;
  if (args.period === 'day') current = { start: args.date, end: args.date };
  else if (args.period === 'range') current = { start: args.start, end: args.end };
  else if (args.period === 'month') {
    current = { start: `${args.year}-${String(args.month).padStart(2, '0')}-01`, end: toIsoDate(new Date(Date.UTC(args.year, args.month, 0, 12))) };
  } else current = { start: `${args.year}-01-01`, end: `${args.year}-12-31` };

  if (args.period === 'day') return { current, previous: { start: addDays(current.start, -7), end: addDays(current.end, -7) } };
  if (args.period === 'month') return { current, previous: { start: `${args.year - 1}-${String(args.month).padStart(2, '0')}-01`, end: toIsoDate(new Date(Date.UTC(args.year - 1, args.month, 0, 12))) } };
  if (args.period === 'year') return { current, previous: { start: `${args.year - 1}-01-01`, end: `${args.year - 1}-12-31` } };
  const length = Math.round((parseIsoDate(current.end).getTime() - parseIsoDate(current.start).getTime()) / DAY_MS) + 1;
  return { current, previous: { start: addDays(current.start, -length), end: addDays(current.end, -length) } };
};
