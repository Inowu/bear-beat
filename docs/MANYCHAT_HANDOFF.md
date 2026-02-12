# ManyChat → Web Handoff (multicanal)

Objetivo: cuando alguien haga click en tu botón/link "✅ Ver el DEMO" desde **Instagram / Messenger / WhatsApp / Ads**, la web reciba el contexto del contacto de ManyChat sin depender de `mcp_token` y sin meter PII directo en la URL.

Esto se hace con un **token de handoff** (`mc_t`) generado server-side.

---

## 1) Qué hace el sistema

1. ManyChat llama a tu backend con un **External Request**.
2. El backend guarda un snapshot mínimo del contacto (id/canal/nombre/teléfono/email si existe) y genera un token random.
3. El backend responde un `url` como:

```
https://thebearbeat.com/#demo?mc_t=TOKEN...
```

4. El usuario abre el link.
5. La web captura `mc_t`, lo **borra del URL** (para que no se lo traguen trackers), y lo resuelve con:

```
GET https://thebearbeatapi.lat/api/manychat/handoff/resolve?token=TOKEN...
```

6. Cuando el usuario se registra o ya estaba logueado, la web "claimea" el token y el backend intenta ligar ese contacto a `users.mc_id` (best-effort).

---

## 2) Backend (variables de entorno)

En el backend (producción) agrega:

- `MC_HANDOFF_SECRET` (string largo random)
- `MC_HANDOFF_TTL_DAYS` (ej. `14`)

Nota: si ya tienes `MC_API_KEY` configurado (para tags/campos de ManyChat), el handoff **funciona aunque no pongas** `MC_HANDOFF_SECRET`, usando `MC_API_KEY` como fallback. Recomendación: usa `MC_HANDOFF_SECRET` dedicado.

Ver ejemplo: `backend/.env.example`.

---

## 3) DB (migración)

Hay una migración nueva que crea la tabla:

- `manychat_handoff_tokens`

Ruta:
- `backend/prisma/migrations/20260212120000_add_manychat_handoff_tokens/migration.sql`

---

## 4) ManyChat (cómo configurarlo)

### A) Crear campo para guardar la URL

1. ManyChat → Settings → Fields (User Fields)
2. Crear un campo de texto, por ejemplo:
   - Name: `bb_handoff_url`
   - Type: Text

### B) External Request (antes de mandar el botón)

En tu Flow/Automation, antes del mensaje "✅ Ver el DEMO":

1. Action: **External Request**
2. Method: `POST`
3. URL:

```
https://thebearbeatapi.lat/api/manychat/handoff
```

4. Body (JSON). Ejemplo (ajusta los `{{...}}` a las variables que te ofrece ManyChat en tu workspace):

```json
{
  "secret": "TU_MC_HANDOFF_SECRET_O_MC_API_KEY",
  "contactId": "{{contact.id}}",
  "channel": "{{contact.channel}}",
  "firstName": "{{contact.first_name}}",
  "lastName": "{{contact.last_name}}",
  "phone": "{{contact.phone}}",
  "email": "{{contact.email}}",
  "ref": "demo",
  "redirectPath": "/#demo",
  "utm_source": "manychat",
  "utm_medium": "{{contact.channel}}",
  "utm_campaign": "demo"
}
```

5. Response Mapping:
   - guarda `url` en tu custom field `bb_handoff_url`

### C) Mandar el botón/link usando ese campo

En el mensaje, usa el botón "Open website" (o el tipo de botón equivalente) y pon como URL:

```
{{bb_handoff_url}}
```

---

## 5) Debug rápido

Si te llega un link con `mc_t=...`, prueba:

```
https://thebearbeatapi.lat/api/manychat/handoff/resolve?token=MC_T_AQUI
```

Te debe regresar `ok: true` y el snapshot.
