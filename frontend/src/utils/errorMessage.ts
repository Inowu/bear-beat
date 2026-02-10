export function extractValidationMessage(raw: string): string | null {
  const text = `${raw ?? ""}`.trim();
  if (!text) return null;
  if (!text.includes('"validation"')) return null;
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0] as any;
      const msg = typeof first?.message === "string" ? first.message : "";
      return msg.trim() ? msg.trim() : null;
    }
  } catch {
    // ignore
  }
  return null;
}

export function toErrorMessage(err: unknown): string {
  if (err == null) return "";
  if (typeof err === "string") {
    return extractValidationMessage(err) ?? err;
  }

  if (err instanceof Error) {
    const msg = err.message || "";
    return extractValidationMessage(msg) ?? msg;
  }

  const anyErr = err as any;
  if (typeof anyErr?.message === "string") {
    return extractValidationMessage(anyErr.message) ?? anyErr.message;
  }

  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

