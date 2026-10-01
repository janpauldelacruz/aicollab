import { NextResponse } from 'next/server';
import { computeSignal, type TimeframeSignal } from '@/lib/signals/engine';
import { SYMBOLS, TIMEFRAMES, fetchCandles } from '@/lib/signals/marketData';

export const dynamic = 'force-dynamic';

interface SymbolResult {
  symbol: string;
  label: string;
  source: string;
  digits: number;
  contractSize: number;
  lastPrice: number | null;
  /** Timeframe id → signal, or an error string when that series failed. */
  timeframes: Record<string, TimeframeSignal | { error: string }>;
}

/**
 * GET /api/signals
 * XAUUSD and BTCUSD buy/sell signals for every timeframe. Market data is public
 * and cached server-side, so polling this does not hammer the exchange.
 */
export async function GET() {
  const symbols: SymbolResult[] = await Promise.all(
    SYMBOLS.map(async (symbol) => {
      const entries = await Promise.all(
        TIMEFRAMES.map(async (tf) => {
          try {
            const { candles, livePrice } = await fetchCandles(symbol, tf);
            return [tf.id, computeSignal(tf.id, candles, symbol.digits, livePrice)] as const;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Signals ${symbol.id} ${tf.id}:`, message);
            return [tf.id, { error: message }] as const;
          }
        })
      );

      const timeframes = Object.fromEntries(entries);
      const fastest = entries.find(([, s]) => !('error' in s));
      const lastPrice = fastest && !('error' in fastest[1]) ? fastest[1].entry : null;

      return {
        symbol: symbol.id,
        label: symbol.label,
        source: symbol.source,
        digits: symbol.digits,
        contractSize: symbol.contractSize,
        lastPrice,
        timeframes,
      };
    })
  );

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      timeframes: TIMEFRAMES.map((t) => t.id),
      symbols,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
