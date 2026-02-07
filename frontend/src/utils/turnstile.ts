const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

export const TURNSTILE_BYPASS_TOKEN = "__TURNSTILE_LOCAL_BYPASS__";

export function shouldBypassTurnstile(): boolean {
  if (typeof window === "undefined") return false;

  if (process.env.REACT_APP_TURNSTILE_BYPASS === "true") return true;

  const isDevelopment = process.env.NODE_ENV === "development";
  const isLocalHost = LOCAL_HOSTNAMES.has(window.location.hostname);
  return isDevelopment && isLocalHost;
}
