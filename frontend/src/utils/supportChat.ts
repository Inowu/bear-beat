import { GROWTH_METRICS, trackGrowthMetric } from "./growthMetrics";

export const SUPPORT_CHAT_URL = "https://m.me/rn/104901938679498?topic=VIDEOS%20PARA%20DJ&cadence=daily";

export function openSupportChat(source = "generic"): void {
  if (typeof window === "undefined") return;
  trackGrowthMetric(GROWTH_METRICS.SUPPORT_CHAT_OPENED, {
    source,
    pagePath: window.location.pathname,
  });
  window.open(SUPPORT_CHAT_URL, "_blank", "noopener,noreferrer");
}
