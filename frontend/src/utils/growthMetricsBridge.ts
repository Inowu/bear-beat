// Lightweight bridge for growth metrics so critical UX routes don't pay the full
// analytics module cost on first paint. Metrics are queued and later flushed
// once the full module is initialized.

export const GROWTH_METRICS = {
  PAGE_VIEW: "page_view",
} as const;

export type GrowthMetricBridgeName = (typeof GROWTH_METRICS)[keyof typeof GROWTH_METRICS] | string;

export type GrowthMetricBridgeEvent = {
  metric: GrowthMetricBridgeName;
  payload: Record<string, unknown>;
  timestamp: string;
};

declare global {
  interface Window {
    __bbGrowthBridgeQueue?: GrowthMetricBridgeEvent[];
    __bbGrowthBridgeTrack?: (metric: GrowthMetricBridgeName, payload: Record<string, unknown>) => void;
  }
}

const MAX_QUEUE = 120;

export function trackGrowthMetricBridge(
  metric: GrowthMetricBridgeName,
  payload: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") return;

  const bound = window.__bbGrowthBridgeTrack;
  if (typeof bound === "function") {
    try {
      bound(metric, payload);
    } catch {
      // noop
    }
    return;
  }

  const detail: GrowthMetricBridgeEvent = {
    metric,
    payload,
    timestamp: new Date().toISOString(),
  };

  try {
    if (!window.__bbGrowthBridgeQueue) {
      window.__bbGrowthBridgeQueue = [];
    }
    window.__bbGrowthBridgeQueue.push(detail);
    if (window.__bbGrowthBridgeQueue.length > MAX_QUEUE) {
      window.__bbGrowthBridgeQueue = window.__bbGrowthBridgeQueue.slice(-MAX_QUEUE);
    }

    // Maintain the same event surface the full module uses (so other listeners
    // can subscribe without importing analytics at bootstrap time).
    window.dispatchEvent(new CustomEvent("bb:growth-metric", { detail }));
  } catch {
    // noop
  }
}

export function consumeGrowthMetricBridgeQueue(): GrowthMetricBridgeEvent[] {
  if (typeof window === "undefined") return [];
  const pending = window.__bbGrowthBridgeQueue ?? [];
  window.__bbGrowthBridgeQueue = [];
  return pending;
}

export function bindGrowthMetricBridge(
  trackFn: (metric: GrowthMetricBridgeName, payload: Record<string, unknown>) => void,
): void {
  if (typeof window === "undefined") return;
  window.__bbGrowthBridgeTrack = trackFn;

  const pending = consumeGrowthMetricBridgeQueue();
  if (!pending.length) return;

  for (const item of pending) {
    try {
      trackFn(item.metric, item.payload);
    } catch {
      // noop
    }
  }
}
