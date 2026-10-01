import type { Candle } from './engine';

/**
 * Free, keyless market data for the signals page.
 *
 * Kraken's public OHLC endpoint serves both symbols, needs no account, and —
 * unlike api.binance.com — is not geo-blocked from US hosting regions.
 *
 *   BTCUSD  Kraken XBTUSD
 *   XAUUSD  Kraken PAXGUSD — PAX Gold, one token per fine troy ounce, trades 24/7
 *           and tracks spot gold closely. It is a proxy: expect it to differ from
 *           your broker's XAUUSD by a few dollars, more on weekends when FX is shut.
 */

export interface SymbolSpec {
  id: 'XAUUSD' | 'BTCUSD';
  label: string;
  krakenPair: string;
  source: string;
  digits: number;
  /** Units per 1.00 lot at a typical raw-spread CFD broker. */
  contractSize: number;
}

export const SYMBOLS: SymbolSpec[] = [
  {
    id: 'XAUUSD',
    label: 'Gold',
    krakenPair: 'PAXGUSD',
    source: 'Kraken PAXG/USD (spot-gold proxy)',
    digits: 2,
    contractSize: 100,
  },
  {
    id: 'BTCUSD',
    label: 'Bitcoin',
    krakenPair: 'XBTUSD',
    source: 'Kraken BTC/USD',
    digits: 2,
    contractSize: 1,
  },
];

export interface TimeframeSpec {
  id: string;
  minutes: number;
  /** How long a fetched series stays fresh in the server cache. */
  cacheMs: number;
}

export const TIMEFRAMES: TimeframeSpec[] = [
  { id: 'M1', minutes: 1, cacheMs: 20_000 },
  { id: 'M5', minutes: 5, cacheMs: 30_000 },
  { id: 'M15', minutes: 15, cacheMs: 60_000 },
  { id: 'H1', minutes: 60, cacheMs: 120_000 },
  { id: 'H4', minutes: 240, cacheMs: 300_000 },
  { id: 'D1', minutes: 1440, cacheMs: 600_000 },
];

export interface CandleSeries {
  /** Closed candles, oldest first. Signals are computed on these only. */
  candles: Candle[];
  /** Close of the still-forming candle: the price an entry would get now. */
  livePrice: number;
}

const cache = new Map<string, { at: number; series: CandleSeries }>();

/**
 * Closed candles only, oldest first. Kraken's last row is the candle still
 * forming; including it would make every signal repaint until it closes.
 */
export async function fetchCandles(symbol: SymbolSpec, tf: TimeframeSpec): Promise<CandleSeries> {
  const key = `${symbol.id}:${tf.id}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < tf.cacheMs) return hit.series;

  const url = `https://api.kraken.com/0/public/OHLC?pair=${symbol.krakenPair}&interval=${tf.minutes}`;
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
    headers: { 'User-Agent': 'AICollab-Signals/1.0' },
  });
  if (!response.ok) throw new Error(`Kraken HTTP ${response.status}`);

  const body = await response.json();
  if (Array.isArray(body?.error) && body.error.length) {
    throw new Error(`Kraken: ${body.error.join(', ')}`);
  }

  const resultKey = Object.keys(body?.result ?? {}).find((k) => k !== 'last');
  const rows: unknown[][] = resultKey ? body.result[resultKey] : [];
  if (!Array.isArray(rows) || rows.length < 30) {
    throw new Error(`Kraken returned too little data for ${symbol.id} ${tf.id}`);
  }

  const candles: Candle[] = rows.slice(0, -1).map((r) => ({
    time: Number(r[0]),
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
  }));

  const series = { candles, livePrice: Number(rows[rows.length - 1][4]) };
  cache.set(key, { at: Date.now(), series });
  return series;
}
