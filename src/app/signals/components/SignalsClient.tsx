'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';

type Side = 'BUY' | 'SELL' | 'NEUTRAL';

interface TimeframeSignal {
  timeframe: string;
  side: Side;
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
  barsSinceCross: number;
  reasons: string[];
  lastCandleTime: number;
}

type TimeframeResult = TimeframeSignal | { error: string };

interface SymbolResult {
  symbol: string;
  label: string;
  source: string;
  digits: number;
  contractSize: number;
  lastPrice: number | null;
  timeframes: Record<string, TimeframeResult>;
}

interface SignalsResponse {
  generatedAt: string;
  timeframes: string[];
  symbols: SymbolResult[];
}

const REFRESH_MS = 30_000;

const SIDE_STYLES: Record<Side, string> = {
  BUY: 'border-positive/40 bg-positive/10 text-positive',
  SELL: 'border-negative/40 bg-negative/10 text-negative',
  NEUTRAL: 'border-border bg-muted/40 text-muted-foreground',
};

function isSignal(r: TimeframeResult | undefined): r is TimeframeSignal {
  return !!r && !('error' in r);
}

function fmt(n: number | null | undefined, digits: number): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function timeAgo(unixSeconds: number): string {
  const s = Math.max(0, Math.round(Date.now() / 1000 - unixSeconds));
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 172800) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/** Lots so that a stop-out loses exactly `riskPct` of equity. */
function lotSize(sig: TimeframeSignal, equity: number, riskPct: number, contractSize: number) {
  if (sig.stopLoss === null || equity <= 0 || riskPct <= 0) return null;
  const stopDistance = Math.abs(sig.entry - sig.stopLoss);
  if (stopDistance <= 0) return null;
  const lots = (equity * (riskPct / 100)) / (stopDistance * contractSize);
  return Math.floor(lots * 100) / 100;
}

function consensus(sym: SymbolResult, timeframes: string[]) {
  const sides = timeframes
    .map((tf) => sym.timeframes[tf])
    .filter(isSignal)
    .map((s) => s.side);
  const buys = sides.filter((s) => s === 'BUY').length;
  const sells = sides.filter((s) => s === 'SELL').length;
  let side: Side = 'NEUTRAL';
  if (buys > sells && buys >= Math.ceil(sides.length / 2)) side = 'BUY';
  else if (sells > buys && sells >= Math.ceil(sides.length / 2)) side = 'SELL';
  return { side, buys, sells, total: sides.length };
}

export default function SignalsClient() {
  const [data, setData] = useState<SignalsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [equity, setEquity] = useState(10_000);
  const [riskPct, setRiskPct] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/signals', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Signals request failed (HTTP ${response.status})`);
      setData(await response.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const timeframes = useMemo(() => data?.timeframes ?? [], [data]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-border flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Signals</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            XAUUSD and BTCUSD buy / sell signals by timeframe — refreshes every 30s
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted-foreground">
            Equity $
            <input
              type="number"
              min={0}
              value={equity}
              onChange={(e) => setEquity(Number(e.target.value))}
              className="input-base ml-1.5 w-28 inline-block py-1.5"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Risk %
            <input
              type="number"
              min={0}
              step={0.1}
              value={riskPct}
              onChange={(e) => setRiskPct(Number(e.target.value))}
              className="input-base ml-1.5 w-20 inline-block py-1.5"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              load();
            }}
            className="btn-secondary gap-2 text-xs"
          >
            <Icon name="ArrowPathIcon" size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-negative/10 border border-negative/20 rounded-lg text-negative text-sm">
            <Icon name="ExclamationTriangleIcon" size={16} />
            {error}
          </div>
        )}

        {!data && loading && <p className="text-sm text-muted-foreground">Loading market data…</p>}

        {data?.symbols.map((sym) => {
          const c = consensus(sym, timeframes);
          return (
            <section key={sym.symbol} className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {sym.symbol}{' '}
                    <span className="text-muted-foreground font-normal text-sm">{sym.label}</span>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {fmt(sym.lastPrice, sym.digits)} · {sym.source}
                  </p>
                </div>
                <div
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${SIDE_STYLES[c.side]}`}
                >
                  Overall {c.side} · {c.buys} buy / {c.sells} sell of {c.total} timeframes
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {timeframes.map((tf) => {
                  const r = sym.timeframes[tf];
                  const key = `${sym.symbol}-${tf}`;
                  if (!isSignal(r)) {
                    return (
                      <div key={key} className="rounded-xl border border-border bg-card p-4">
                        <p className="text-sm font-semibold text-foreground">{tf}</p>
                        <p className="text-xs text-negative mt-2">
                          {r?.error ?? 'No data for this timeframe'}
                        </p>
                      </div>
                    );
                  }
                  const lots = lotSize(r, equity, riskPct, sym.contractSize);
                  const open = expanded === key;
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setExpanded(open ? null : key)}
                      className="text-left rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">{tf}</span>
                        <span
                          className={`px-2 py-0.5 rounded-md border text-xs font-bold ${SIDE_STYLES[r.side]}`}
                        >
                          {r.side}
                        </span>
                      </div>

                      {r.side !== 'NEUTRAL' && (
                        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={
                              r.side === 'BUY' ? 'h-full bg-positive' : 'h-full bg-negative'
                            }
                            style={{ width: `${r.strength}%` }}
                          />
                        </div>
                      )}

                      <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-xs tabular-nums">
                        <dt className="text-muted-foreground">Entry</dt>
                        <dd className="text-right text-foreground">{fmt(r.entry, sym.digits)}</dd>
                        <dt className="text-muted-foreground">Stop</dt>
                        <dd className="text-right text-negative">{fmt(r.stopLoss, sym.digits)}</dd>
                        <dt className="text-muted-foreground">TP1 (1R)</dt>
                        <dd className="text-right text-positive">
                          {fmt(r.takeProfit1, sym.digits)}
                        </dd>
                        <dt className="text-muted-foreground">TP2 (2R)</dt>
                        <dd className="text-right text-positive">
                          {fmt(r.takeProfit2, sym.digits)}
                        </dd>
                        <dt className="text-muted-foreground">RSI</dt>
                        <dd className="text-right text-foreground">{r.rsi.toFixed(1)}</dd>
                        <dt
                          className="text-muted-foreground"
                          title={`Lot size risking ${riskPct}% of equity`}
                        >
                          Lots
                        </dt>
                        <dd className="text-right text-foreground">
                          {lots === null ? '—' : lots.toFixed(2)}
                        </dd>
                      </dl>

                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Strength {r.strength} · candle closed {timeAgo(r.lastCandleTime)}
                      </p>

                      {open && (
                        <ul className="mt-3 pt-3 border-t border-border space-y-1 text-[11px] text-muted-foreground list-disc pl-4">
                          {r.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                          <li>
                            EMA9 {fmt(r.ema9, sym.digits)} · EMA21 {fmt(r.ema21, sym.digits)} ·
                            EMA50 {fmt(r.ema50, sym.digits)}
                            {r.ema200 !== null && ` · EMA200 ${fmt(r.ema200, sym.digits)}`}
                          </li>
                          <li>ATR14 {fmt(r.atr, sym.digits)}</li>
                        </ul>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

        {data && (
          <div className="rounded-xl border border-border bg-card/50 p-4 text-xs text-muted-foreground leading-relaxed space-y-1.5">
            <p className="text-foreground font-medium">How these signals are made</p>
            <p>
              Each timeframe is scored on closed candles only, so a signal does not repaint. BUY
              when EMA9 is above EMA21 and the bias (EMA50 vs EMA200) is up; SELL when both point
              down; NEUTRAL when they disagree. RSI above 70 blocks a BUY, below 30 blocks a SELL.
              Stop is 1.5 × ATR14 from the live price; TP1 and TP2 are 1R and 2R. Lot size risks
              your chosen % of equity at a{' '}
              {data.symbols.map((s) => `${s.symbol} contract of ${s.contractSize}`).join(', ')}.
              Click any card for the full reasoning.
            </p>
            <p>
              XAUUSD uses PAX Gold on Kraken as a free 24/7 spot-gold proxy, so prices can differ
              from your broker&apos;s feed by a few dollars. These are rule-based indicators, not
              financial advice — confirm on your own chart before trading.
            </p>
            <p>Updated {new Date(data.generatedAt).toLocaleTimeString()}</p>
          </div>
        )}
      </div>
    </div>
  );
}
