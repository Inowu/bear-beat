import Path from "path";

/**
 * Resolve an untrusted (user-controlled) path under a trusted root.
 *
 * Returns an absolute path that is guaranteed to be within `root`, or null when:
 * - inputs are empty
 * - the untrusted path is absolute
 * - the untrusted path escapes the root via traversal
 *
 * NOTE: This is used for local filesystem paths. When FILE_SERVICE=ftp, this still
 * provides a best-effort guardrail against obvious traversal, but server-side
 * chroot/permissions must also be enforced at the SFTP layer.
 */
export function resolvePathWithinRoot(root: string, untrustedPath: string): string | null {
  const rootRaw = `${root ?? ""}`.trim();
  const raw = `${untrustedPath ?? ""}`.trim();

  if (!rootRaw || !raw) return null;
  if (raw.includes("\0")) return null;

  // Normalize common Windows separators and force relative semantics.
  const cleaned = raw.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!cleaned) return null;

  const rootAbs = Path.resolve(rootRaw);
  const full = Path.resolve(rootAbs, cleaned);

  const rel = Path.relative(rootAbs, full);
  if (!rel || rel.startsWith("..") || Path.isAbsolute(rel)) return null;

  return full;
}

/**
 * Validate that a string is a single file name (no path separators / traversal).
 * This is stricter than resolvePathWithinRoot() and is useful for endpoints that
 * expect a file created by the server (e.g., a zip in a known directory).
 */
export function isSafeFileName(value: string): boolean {
  const raw = `${value ?? ""}`.trim();
  if (!raw) return false;
  if (raw.includes("\0")) return false;
  if (raw === "." || raw === "..") return false;
  if (raw.includes("/") || raw.includes("\\")) return false;
  return true;
}

