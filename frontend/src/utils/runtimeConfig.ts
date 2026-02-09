const LOCAL_API_BASE = "http://localhost:5001";
const PROD_API_BASE = "https://thebearbeatapi.lat";

const isBrowser = typeof window !== "undefined";
const hostname = isBrowser ? window.location.hostname : "";
const isLocalHost =
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname.endsWith(".local");

const explicitApiBaseUrl = process.env.REACT_APP_API_BASE_URL?.trim();
const explicitTrpcUrl = process.env.REACT_APP_TRPC_URL?.trim();
const explicitSseUrl = process.env.REACT_APP_SSE_URL?.trim();
const sseEnabled = process.env.REACT_APP_SSE_ENABLED?.trim() === "1";
const environment = process.env.REACT_APP_ENVIRONMENT?.trim();

// Prefer explicit environment setting over hostname inference.
// This lets us use production APIs even when running the frontend on localhost.
const inferredApiBaseUrl =
  environment === "production"
    ? PROD_API_BASE
    : environment === "development"
      ? LOCAL_API_BASE
      : isLocalHost
        ? LOCAL_API_BASE
        : PROD_API_BASE;

export const apiBaseUrl = explicitApiBaseUrl || inferredApiBaseUrl;
export const trpcUrl = explicitTrpcUrl || `${apiBaseUrl}/trpc`;
// SSE is optional (only for real-time admin feedback). Keep it opt-in to avoid noisy 404s in local dev.
// If needed, run `node backend/sse_server/index.js` and set `REACT_APP_SSE_ENABLED=1` (or `REACT_APP_SSE_URL`).
export const sseEndpoint = explicitSseUrl || (sseEnabled ? "http://localhost:8001/sse" : null);
