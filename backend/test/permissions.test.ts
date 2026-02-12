import fs from "fs";
import path from "path";
import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import { prisma } from "../src/db";
import { router } from "../src/trpc";
import { shieldedProcedure } from "../src/procedures/shielded.procedure";

jest.setTimeout(60_000);

type ShieldedProc = { type: "query" | "mutation"; name: string; file: string };

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      // Skip common build/noise dirs if they appear.
      if (ent.name === "node_modules" || ent.name === "build" || ent.name === "dist") continue;
      out.push(...listTsFiles(p));
      continue;
    }
    if (ent.isFile() && p.endsWith(".ts")) out.push(p);
  }
  return out;
}

function inferProcType(tail: string): "query" | "mutation" | null {
  const q = tail.indexOf(".query");
  const m = tail.indexOf(".mutation");
  if (q === -1 && m === -1) return null;
  if (q !== -1 && (m === -1 || q < m)) return "query";
  return "mutation";
}

function extractShieldedProceduresFromFile(filePath: string, text: string): ShieldedProc[] {
  const found: ShieldedProc[] = [];

  // `export const X = shieldedProcedure ... .query|.mutation`
  {
    const re = /export const\s+([A-Za-z0-9_]+)\s*=\s*shieldedProcedure\b/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
      const name = match[1];
      const tail = text.slice(match.index, match.index + 8000);
      const type = inferProcType(tail);
      if (type) found.push({ type, name, file: filePath });
    }
  }

  // Router object shorthand: `key: shieldedProcedure ...`
  {
    const re = /\b([A-Za-z0-9_]+)\s*:\s*shieldedProcedure\b/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
      const name = match[1];
      const tail = text.slice(match.index, match.index + 8000);
      const type = inferProcType(tail);
      if (type) found.push({ type, name, file: filePath });
    }
  }

  return found;
}

function extractObjectLiteralBlock(text: string, label: string): string {
  const idx = text.indexOf(label);
  if (idx === -1) throw new Error(`Could not find ${label}`);

  const braceIdx = text.indexOf("{", idx);
  if (braceIdx === -1) throw new Error(`Could not find opening { for ${label}`);

  let depth = 0;
  for (let i = braceIdx; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(braceIdx + 1, i);
    }
  }

  throw new Error(`Unterminated block for ${label}`);
}

function extractTopLevelKeys(block: string): Set<string> {
  const keys = new Set<string>();
  const keyRe = /^\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_]+))\s*:/gm;
  let match: RegExpExecArray | null;
  while ((match = keyRe.exec(block))) {
    const key = match[1] || match[2] || match[3];
    if (key) keys.add(key);
  }
  return keys;
}

describe("Permissions hardening (A-002)", () => {
  it("denies unmapped shielded procedures by default (fallback deny)", async () => {
    const testRouter = router({
      unmappedProcedure: shieldedProcedure.query(async () => "ok"),
    });

    const caller = testRouter.createCaller({
      req: { headers: {} } as any,
      res: {} as any,
      prisma,
      session: null,
    });

    try {
      await caller.unmappedProcedure();
      throw new Error("expected unmappedProcedure to be denied");
    } catch (cause) {
      expect(cause).toBeInstanceOf(TRPCError);
      expect(getHTTPStatusCodeFromError(cause as TRPCError)).toBe(403);
    }
  });

  it("has explicit permission rules for every shielded procedure in backend/src/routers", () => {
    const repoRoot = path.resolve(__dirname, "..");
    const routersDir = path.join(repoRoot, "src", "routers");
    const permissionFile = path.join(repoRoot, "src", "permissions", "index.ts");

    const files = listTsFiles(routersDir);
    const procedures = new Map<string, ShieldedProc>();
    for (const file of files) {
      const txt = fs.readFileSync(file, "utf8");
      if (!txt.includes("shieldedProcedure")) continue;
      for (const proc of extractShieldedProceduresFromFile(file, txt)) {
        const key = `${proc.type}:${proc.name}`;
        if (!procedures.has(key)) procedures.set(key, proc);
      }
    }

    const permissionsText = fs.readFileSync(permissionFile, "utf8");
    const queryBlock = extractObjectLiteralBlock(permissionsText, "query:");
    const mutationBlock = extractObjectLiteralBlock(permissionsText, "mutation:");
    const queryKeys = extractTopLevelKeys(queryBlock);
    const mutationKeys = extractTopLevelKeys(mutationBlock);

    const missing: ShieldedProc[] = [];
    for (const proc of procedures.values()) {
      const keys = proc.type === "query" ? queryKeys : mutationKeys;
      if (!keys.has(proc.name)) missing.push(proc);
    }

    missing.sort((a, b) => `${a.type}:${a.name}`.localeCompare(`${b.type}:${b.name}`));

    expect(missing).toEqual([]);
  });
});

