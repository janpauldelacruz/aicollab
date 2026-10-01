/**
 * Buy/sell signal engine for the /signals page.
 *
 * Deliberately simple and fully transparent: every signal can be traced back to
 * the indicator values shown next to it. Nothing here is a prediction — it is a
 * rule set applied to the latest closed candles.
 *
 * Rules, per timeframe:
 *   Bias      EMA50 vs EMA200 (fewer than 200 candles: EMA50 slope)
 *   Trigger   EMA9 vs EMA21, and how recently they crossed
 *   Filter    RSI14 — no BUY above 70, no SELL below 30
 *   Levels    entry = last close, stop = 1.5 x ATR14, targets at 1R and 2R
 */

export type Side = 'BUY' | 'SELL' | 'NEUTRAL';

export interface Candle {
  time: number; // unix seconds, candle open
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface TimeframeSignal {
  timeframe: string;
  side: Side;
  /** 0-100. How many rules agree, and how fresh the trigger is. */
  strength: number;
  entry: number;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  rsi: number;
  atr: number;
  ema9: number;
  ema21: number;
  ema50: number;
  ema200: number | null;
  /** Candles since EMA9/EMA21 last crossed. */
  barsSinceCross: number;
  reasons: string[];
  /** Unix seconds when the latest closed candle closed. */
  lastCandleTime: number;
}

export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

/** Wilder's RSI. */
export function rsi(closes: number[], period = 14): number[] {
  const out: number[] = new Array(closes.length).fill(50);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

/** Wilder's ATR. */
export function atr(candles: Candle[], period = 14): number[] {
  const out: number[] = new Array(candles.length).fill(0);
  if (candles.length === 0) return out;
  const tr = candles.map((c, i) =>
    i === 0
      ? c.high - c.low
      : Math.max(
          c.high - c.low,
          Math.abs(c.high - candles[i - 1].close),
          Math.abs(c.low - candles[i - 1].close)
        )
  );
  let value = tr.slice(0, period).reduce((a, b) => a + b, 0) / Math.min(period, tr.length);
  for (let i = 0; i < candles.length; i++) {
    if (i >= period) value = (value * (period - 1) + tr[i]) / period;
    out[i] = value;
  }
  return out;
}

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;

/**
 * Computes the signal for one timeframe. `candles` must be closed candles only,
 * oldest first — the still-forming candle repaints and is excluded upstream.
 * `livePrice` (the forming candle's price) anchors entry, stop and targets, so a
 * D1 signal is not quoted at yesterday's close.
 */
export function computeSignal(
  timeframe: string,
  candles: Candle[],
  digits = 2,
  livePrice?: number
): TimeframeSignal {
  const closes = candles.map((c) => c.close);
  const last = closes.length - 1;

  const e9 = ema(closes, 9);
  const e21 = ema(closes, 21);
  const e50 = ema(closes, 50);
  const has200 = closes.length >= 200;
  const e200 = has200 ? ema(closes, 200) : null;
  const r = rsi(closes, 14);
  const a = atr(candles, 14);

  const fastAbove = e9[last] > e21[last];
  let barsSinceCross = 0;
  for (let i = last; i > 0; i--) {
    if (e9[i] > e21[i] !== fastAbove) break;
    barsSinceCross++;
  }

  const biasUp = e200 ? e50[last] > e200[last] : e50[last] > e50[Math.max(0, last - 10)];
  const priceAbove50 = closes[last] > e50[last];
  const rsiNow = r[last];
  const reasons: string[] = [];

  let side: Side = 'NEUTRAL';
  if (fastAbove && biasUp) side = 'BUY';
  else if (!fastAbove && !biasUp) side = 'SELL';

  reasons.push(
    e200
      ? `Bias ${biasUp ? 'up' : 'down'}: EMA50 ${biasUp ? 'above' : 'below'} EMA200`
      : `Bias ${biasUp ? 'up' : 'down'}: EMA50 sloping ${biasUp ? 'up' : 'down'}`
  );
  reasons.push(
    `EMA9 ${fastAbove ? 'above' : 'below'} EMA21 for ${barsSinceCross} candle${barsSinceCross === 1 ? '' : 's'}`
  );

  if (side === 'NEUTRAL') {
    reasons.push('Trigger and bias disagree — no trade');
  }
  if (side === 'BUY' && rsiNow >= 70) {
    side = 'NEUTRAL';
    reasons.push(`RSI ${rsiNow.toFixed(0)} overbought — BUY filtered out`);
  } else if (side === 'SELL' && rsiNow <= 30) {
    side = 'NEUTRAL';
    reasons.push(`RSI ${rsiNow.toFixed(0)} oversold — SELL filtered out`);
  } else {
    reasons.push(`RSI ${rsiNow.toFixed(0)}`);
  }

  let strength = 0;
  if (side !== 'NEUTRAL') {
    strength = 50;
    if ((side === 'BUY') === priceAbove50) {
      strength += 15;
      reasons.push(`Price ${side === 'BUY' ? 'above' : 'below'} EMA50`);
    }
    if (side === 'BUY' ? rsiNow > 50 && rsiNow < 65 : rsiNow < 50 && rsiNow > 35) strength += 15;
    // Fresh crosses score higher; a cross 30 candles old is a stale entry.
    strength += Math.max(0, 20 - barsSinceCross * 2);
    strength = Math.min(100, strength);
  }

  const entry = livePrice && livePrice > 0 ? livePrice : closes[last];
  const risk = a[last] * 1.5;
  const dir = side === 'BUY' ? 1 : -1;
  const levels = side !== 'NEUTRAL' && risk > 0;

  return {
    timeframe,
    side,
    strength,
    entry: round(entry, digits),
    stopLoss: levels ? round(entry - dir * risk, digits) : null,
    takeProfit1: levels ? round(entry + dir * risk, digits) : null,
    takeProfit2: levels ? round(entry + dir * risk * 2, digits) : null,
    rsi: round(rsiNow, 1),
    atr: round(a[last], digits),
    ema9: round(e9[last], digits),
    ema21: round(e21[last], digits),
    ema50: round(e50[last], digits),
    ema200: e200 ? round(e200[last], digits) : null,
    barsSinceCross,
    reasons,
    // Close time of the last closed candle = its open plus one candle length.
    lastCandleTime:
      last > 0 ? candles[last].time + (candles[last].time - candles[last - 1].time) : 0,
  };
}
