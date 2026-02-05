/**
 * Script para listar todas las etiquetas (tags) disponibles en ManyChat.
 * Útil para verificar que los IDs en src/many-chat/tags.ts coincidan con la cuenta.
 *
 * Ejecutar desde la raíz del proyecto:
 *   cd backend && npx ts-node scripts/checkManyChatTags.ts
 *
 * Requiere MC_API_KEY en backend/.env
 */
import axios from "axios";
import fs from "fs";
import path from "path";

// Cargar .env manualmente (evita depender de dotenv en workspaces)
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const MC_API_KEY = process.env.MC_API_KEY;

async function main() {
  if (!MC_API_KEY) {
    console.error("❌ MC_API_KEY no está definida en backend/.env");
    process.exit(1);
  }

  try {
    const response = await axios.get("https://api.manychat.com/fb/page/getTags", {
      headers: {
        Authorization: `Bearer ${MC_API_KEY}`,
      },
    });

    const data = response.data;
    const tags = data?.data ?? data?.tags ?? data;

    if (!Array.isArray(tags)) {
      console.log("Respuesta de la API:", JSON.stringify(data, null, 2));
      console.error("❌ La respuesta no contiene un array de tags.");
      process.exit(1);
    }

    if (tags.length === 0) {
      console.log("No hay etiquetas en esta cuenta.");
      return;
    }

    console.log("\n📋 Etiquetas disponibles en ManyChat:\n");
    tags.forEach((tag: Record<string, unknown>) => {
      const name = (tag.name ?? tag.tag_name ?? "(sin nombre)") as string;
      const id = tag.id ?? tag.tag_id ?? "?";
      console.log(`  ${name}: ${id}`);
    });
    console.log("\n");
  } catch (error: unknown) {
    const err = error as { response?: { data?: unknown }; message?: string };
    console.error("❌ Error al obtener tags:", err.message ?? err);
    if (err.response?.data) {
      console.error("   Respuesta API:", JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
