/**
 * Script para crear las etiquetas (tags) necesarias en ManyChat usando la API.
 * Crea los tags que faltan y muestra los IDs actualizados para tags.ts
 *
 * Ejecutar: cd backend && npm run manychat:create-tags
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

/** Tags que deben existir y cuyos IDs viven en backend/src/many-chat/tags.ts */
const CORE_TAG_NAMES: Record<string, string> = {
  USER_CHECKED_PLANS: "Usuario revisó planes",
  USER_REGISTERED: "Usuario registrado",
  CHECKOUT_PLAN_ORO: "Checkout Plan Oro",
  CHECKOUT_PLAN_CURIOSO: "Checkout Plan Curioso",
  SUCCESSFUL_PAYMENT: "Pago exitoso",
  TRIAL_STARTED: "Trial iniciado",
  TRIAL_CONVERTED: "Trial convertido",
  SUBSCRIPTION_RENEWED: "Renovación de suscripción",
  CANCELLED_SUBSCRIPTION: "Canceló suscripción",
  FAILED_PAYMENT: "Pago fallido",
};

/**
 * Tags extra (no viven en tags.ts) pero se usan en ManyChat flows/automatizaciones y/o backend automation runner.
 * OJO: Estos tags deben existir para que ManyChat `addTagByName` funcione.
 */
const EXTRA_TAG_NAMES: string[] = [
  // Flow tag (ManyChat UI)
  "Interesado Demo",
  // Backend automation runner tags
  "AUTOMATION_TRIAL_NO_DOWNLOAD_24H",
  "AUTOMATION_PAID_NO_DOWNLOAD_24H",
  "AUTOMATION_REGISTERED_NO_PURCHASE_7D",
  "AUTOMATION_ACTIVE_NO_DOWNLOAD_7D",
  "AUTOMATION_ACTIVE_NO_DOWNLOAD_14D",
  "AUTOMATION_ACTIVE_NO_DOWNLOAD_21D",
  "AUTOMATION_PLANS_OFFER_10",
  "AUTOMATION_PLANS_OFFER_30",
  "AUTOMATION_PLANS_OFFER_50",
];

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
    name: (t.name ?? t.tag_name ?? "") as string,
  }));
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

  console.log("\n🔍 Obteniendo tags existentes...\n");
  const existing = await getTags();
  const byName = new Map(existing.map((t) => [t.name.toLowerCase().trim(), t]));

  const results: Record<string, number> = {};

  for (const [key, name] of Object.entries(CORE_TAG_NAMES)) {
    const found = byName.get(name.toLowerCase().trim());
    if (found) {
      console.log(`✅ "${name}" ya existe (id: ${found.id})`);
      results[key] = found.id;
    } else {
      console.log(`➕ Creando "${name}"...`);
      const id = await createTag(name);
      if (id) {
        console.log(`   ✅ Creado con id: ${id}`);
        results[key] = id;
      }
    }
  }

  for (const name of EXTRA_TAG_NAMES) {
    const found = byName.get(name.toLowerCase().trim());
    if (found) {
      console.log(`✅ "${name}" ya existe (id: ${found.id})`);
    } else {
      console.log(`➕ Creando "${name}"...`);
      const id = await createTag(name);
      if (id) {
        console.log(`   ✅ Creado con id: ${id}`);
      }
    }
  }

  if (Object.keys(results).length === 0) {
    console.log("\n⚠️ No se creó ni encontró ningún tag.");
    return;
  }

  console.log("\n📋 Resumen para tags.ts:\n");
  console.log("export const manyChatTags = {");
  for (const [key, id] of Object.entries(results)) {
    console.log(`  ${key}: ${id},`);
  }
  console.log("};");
  console.log("");
}

main().catch((e) => {
  console.error("❌ Error:", e.response?.data ?? e.message);
  process.exit(1);
});
