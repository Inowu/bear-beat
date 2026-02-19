import { toast, type ExternalToast } from "sonner";

export const TOAST_DURATION_MS = 4000;

type AppToastType = "success" | "error" | "warning" | "info";

const TOAST_CLASS_BY_TYPE: Record<AppToastType, string> = {
  success: "bb-toast bb-toast--success",
  error: "bb-toast bb-toast--error",
  warning: "bb-toast bb-toast--warning",
  info: "bb-toast bb-toast--info",
};

const withDefaults = (type: AppToastType, options?: ExternalToast): ExternalToast => ({
  duration: TOAST_DURATION_MS,
  className: TOAST_CLASS_BY_TYPE[type],
  ...options,
});

export const appToast = {
  success: (message: string, options?: ExternalToast) =>
    toast.success(message, withDefaults("success", options)),
  error: (message: string, options?: ExternalToast) =>
    toast.error(message, withDefaults("error", options)),
  warning: (message: string, options?: ExternalToast) =>
    toast.warning(message, withDefaults("warning", options)),
  info: (message: string, options?: ExternalToast) =>
    toast.info(message, withDefaults("info", options)),
};

export function truncateToastLabel(value: string, max = 40): string {
  const normalized = `${value ?? ""}`.trim();
  if (normalized.length <= max) return normalized;
  if (max <= 1) return "…";
  return `${normalized.slice(0, max - 1)}…`;
}
