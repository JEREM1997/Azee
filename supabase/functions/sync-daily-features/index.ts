import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type StoreRow = {
  id: string;
  name: string;
  location: string;
  is_active: boolean;
};

type WeatherDaily = {
  tempMax: number | null;
  tempMin: number | null;
  rainMm: number | null;
  weatherCode: number | null;
};

const isoDate = (value: Date) => value.toISOString().slice(0, 10);

const parseDate = (raw?: string): string => {
  if (!raw) return isoDate(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD.');
  }
  return raw;
};

const getHolidaySet = (): Set<string> => {
  const fromEnv = (Deno.env.get('HOLIDAY_DATES') || '').trim();
  if (!fromEnv) return new Set();

  const entries = fromEnv
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
    .filter(v => /^\d{4}-\d{2}-\d{2}$/.test(v));

  return new Set(entries);
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return await res.json() as T;
};

const geocodeLocation = async (location: string): Promise<{ latitude: number; longitude: number } | null> => {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=fr&format=json`;
  type GeoResponse = { results?: Array<{ latitude: number; longitude: number }> };

  const data = await fetchJson<GeoResponse>(url);
  const first = data?.results?.[0];
  if (!first) return null;

  return { latitude: first.latitude, longitude: first.longitude };
};

const fetchWeatherForDate = async (lat: number, lon: number, date: string): Promise<WeatherDaily> => {
  const url = [
    'https://api.open-meteo.com/v1/forecast',
    `?latitude=${lat}`,
    `&longitude=${lon}`,
    `&start_date=${date}`,
    `&end_date=${date}`,
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code',
    '&timezone=UTC'
  ].join('');

  type WeatherResponse = {
    daily?: {
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_sum?: number[];
      weather_code?: number[];
    }
  };

  const data = await fetchJson<WeatherResponse>(url);
  const daily = data.daily;

  return {
    tempMax: daily?.temperature_2m_max?.[0] ?? null,
    tempMin: daily?.temperature_2m_min?.[0] ?? null,
    rainMm: daily?.precipitation_sum?.[0] ?? null,
    weatherCode: daily?.weather_code?.[0] ?? null
  };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Missing Supabase env vars');

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const targetDate = parseDate((body?.date as string | undefined));
    const holidaySet = getHolidaySet();

    const { data: stores, error: storeErr } = await supabase
      .from('stores')
      .select('id,name,location,is_active')
      .eq('is_active', true);

    if (storeErr) throw storeErr;

    let success = 0;
    const failures: Array<{ storeId: string; storeName: string; reason: string }> = [];

    for (const store of (stores || []) as StoreRow[]) {
      try {
        const geo = await geocodeLocation(store.location);
        if (!geo) throw new Error(`Geocoding failed for location: ${store.location}`);

        const weather = await fetchWeatherForDate(geo.latitude, geo.longitude, targetDate);

        const { error: weatherUpsertErr } = await supabase
          .from('weather_daily')
          .upsert({
            store_id: store.id,
            date: targetDate,
            temp_max: weather.tempMax,
            temp_min: weather.tempMin,
            rain_mm: weather.rainMm,
            weather_code: weather.weatherCode,
            source: 'open-meteo',
            fetched_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'store_id,date' });

        if (weatherUpsertErr) throw weatherUpsertErr;

        const isHoliday = holidaySet.has(targetDate);
        const { error: featureUpsertErr } = await supabase
          .from('store_daily_features')
          .upsert({
            store_id: store.id,
            date: targetDate,
            is_holiday: isHoliday,
            holiday_name: isHoliday ? 'Holiday (env HOLIDAY_DATES)' : null,
            rain_mm: weather.rainMm,
            promo_flag: false,
            promo_intensity: 0,
            weather_source: 'open-meteo',
            updated_at: new Date().toISOString()
          }, { onConflict: 'store_id,date' });

        if (featureUpsertErr) throw featureUpsertErr;
        success++;
      } catch (error) {
        failures.push({
          storeId: store.id,
          storeName: store.name,
          reason: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return new Response(JSON.stringify({
      date: targetDate,
      totalStores: (stores || []).length,
      success,
      failed: failures.length,
      failures
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
