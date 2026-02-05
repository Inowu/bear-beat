/**
 * Sincroniza etiquetas ManyChat con el código:
 * 1. Lista todas las etiquetas actuales
 * 2. BORRA las que NO usamos (no están en TAG_NAMES)
 * 3. CREA las que usamos y faltan
 * 4. Muestra el resumen para tags.ts
 *
 * Ejecutar: cd backend && npm run manychat:sync
 * Requiere MC_API_KEY en backend/.env
 */

import axios from "axios";
import fs from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const MC_API_KEY = process.env.MC_API_KEY;

/** Etiquetas que SÍ usamos en el código (nombre en ManyChat) */
const TAG_NAMES: Record<string, string> = {
  USER_CHECKED_PLANS: "Usuario revisó planes",
  USER_REGISTERED: "Usuario registrado",
  CHECKOUT_PLAN_ORO: "Checkout Plan Oro",
  CHECKOUT_PLAN_CURIOSO: "Checkout Plan Curioso",
  SUCCESSFUL_PAYMENT: "Pago exitoso",
  CANCELLED_SUBSCRIPTION: "Canceló suscripción",
  FAILED_PAYMENT: "Pago fallido",
};

const USED_NAMES = new Set(
  Object.values(TAG_NAMES).map((n) => n.toLowerCase().trim())
);

const api = axios.create({
  baseURL: "https://api.manychat.com",
  headers: { Authorization: `Bearer ${MC_API_KEY}` },
});

async function getTags(): Promise<Array<{ id: number; name: string }>> {
  const res = await api.get("/fb/page/getTags");
  const tags = res.data?.data ?? res.data?.tags ?? res.data;
  if (!Array.isArray(tags)) return [];
  return tags.map((t: Record<string, unknown>) => ({
    id: Number(t.id ?? t.tag_id ?? 0),
    name: String(t.name ?? t.tag_name ?? "").trim(),
  }));
}

async function removeTag(tagId: number): Promise<boolean> {
  try {
    await api.post("/fb/page/removeTag", { tag_id: tagId });
    return true;
  } catch (err: unknown) {
    const e = err as { response?: { data?: unknown }; message?: string };
    console.error(`   ❌ Error borrando tag id ${tagId}:`, JSON.stringify(e.response?.data ?? e.message));
    return false;
  }
}

async function createTag(name: string): Promise<number | null> {
  try {
    const res = await api.post("/fb/page/createTag", { name });
    const tag = res.data?.data ?? res.data;
    const id = tag?.id ?? tag?.tag_id;
    return id ? Number(id) : null;
  } catch (err: unknown) {
    const e = err as { response?: { data?: unknown }; message?: string };
    console.error(`   ❌ Error creando "${name}":`, JSON.stringify(e.response?.data ?? e.message));
    return null;
  }
}

async function main() {
  if (!MC_API_KEY) {
    console.error("❌ MC_API_KEY no está definida en backend/.env");
    process.exit(1);
  }

  console.log("\n📋 1. Listando etiquetas actuales en ManyChat...\n");
  let existing = await getTags();

  console.log(`   Total: ${existing.length} etiquetas\n`);
  console.log("📋 2. Borrando etiquetas que NO usamos...\n");

  for (const tag of existing) {
    const nameLower = tag.name.toLowerCase();
    if (!USED_NAMES.has(nameLower)) {
      console.log(`   🗑️  Borrando "${tag.name}" (id: ${tag.id})`);
      const ok = await removeTag(tag.id);
      if (ok) {
        existing = existing.filter((t) => t.id !== tag.id);
      }
    }
  }

  console.log("\n📋 3. Asegurando que existan las etiquetas que SÍ usamos...\n");
  const byName = new Map(existing.map((t) => [t.name.toLowerCase(), t]));
  const results: Record<string, number> = {};

  for (const [key, name] of Object.entries(TAG_NAMES)) {
    const found = byName.get(name.toLowerCase());
    if (found) {
      console.log(`   ✅ "${name}" ya existe (id: ${found.id})`);
      results[key] = found.id;
    } else {
      console.log(`   ➕ Creando "${name}"...`);
      const id = await createTag(name);
      if (id) {
        console.log(`      ✅ Creado con id: ${id}`);
        results[key] = id;
        existing.push({ id, name });
      }
    }
  }

  console.log("\n📋 4. Resumen final – etiquetas en ManyChat (las que usamos):\n");
  if (Object.keys(results).length === 0) {
    console.log("   ⚠️ No hay etiquetas para mostrar.");
    return;
  }
  Object.entries(results).forEach(([key, id]) => {
    const name = TAG_NAMES[key];
    console.log(`   ${name}: ${id}`);
  });

  console.log("\n📋 5. Código para backend/src/many-chat/tags.ts:\n");
  console.log("export const manyChatTags = {");
  for (const [key, id] of Object.entries(results)) {
    console.log(`  ${key}: ${id},`);
  }
  console.log("};");
  console.log("");
}

main().catch((e) => {
  console.error("❌ Error:", (e as any).response?.data ?? (e as Error).message);
  process.exit(1);
});
