# Manual – Tracking ManyChat ya configurado

Todo el código está listo. Este manual indica qué hacer tú para que funcione al 100%.

---

## 1. Lo que ya está configurado (no hagas nada)

- ✅ API ManyChat: tags core + automatizaciones (ver `docs/MANYCHAT_ETIQUETAS.md`)
- ✅ ManyChat Pixel: eventos de conversión en toda la web
- ✅ Facebook Pixel: init + eventos Lead, Purchase, ViewPlans
- ✅ Scripts ManyChat en `index.html`
- ✅ Tags con fallback por nombre si los IDs fallan
- ✅ Custom fields al entrar a checkout (plan, precio)

---

## 2. Qué hacer tú

### Paso 1: Verificar MC_API_KEY en producción

En el servidor donde corre el backend, revisa que `backend/.env` tenga:

```
MC_API_KEY=104901938679498:ccb70598a0c14bcf3988c5a8d117cc63
```

(Si usas otra clave, ponla igualmente.)

### Paso 2: Verificar IDs de tags en ManyChat

Ejecuta en local (con `backend/.env` con MC_API_KEY):

```bash
cd backend && npm run manychat:tags
```

Si los IDs que salen no coinciden con `backend/src/many-chat/tags.ts`, actualiza ese archivo con los IDs correctos.

### Paso 3: Etiquetas en ManyChat (solo las que usamos)

**Listar las que hay:**
```bash
cd backend && npm run manychat:tags
```

**Crear las que falten (sin borrar otras):**
```bash
cd backend && npm run manychat:create-tags
```

**Sincronizar (recomendado):** borra de ManyChat las etiquetas que no usamos y crea las que sí usamos. Ver lista en `docs/MANYCHAT_ETIQUETAS.md`.
```bash
cd backend && npm run manychat:sync
```

Si los IDs cambian, el script imprime el bloque para pegar en `backend/src/many-chat/tags.ts`.

### Paso 4: Subir cambios a producción

Haz deploy del frontend y backend (por ejemplo con tu flujo habitual: Git, Netlify, etc.).

---

## 3. Cómo verificar que funciona

### Tags (API ManyChat)

1. Registra un usuario nuevo en la web.
2. En ManyChat → Contacts, busca ese correo.
3. Comprueba que tenga el tag "Usuario registrado" (o el nombre que uses en `tags.ts`).

### Pixel (eventos)

1. Entra a ManyChat → Analytics o Settings → Pixel (según tu plan).
2. Navega en la web y haz acciones (ver planes, registro, compra, etc.).
3. Comprueba que los eventos aparezcan en ManyChat.

> **Importante:** El Pixel de ManyChat funciona bien si el usuario llega desde Messenger (botón "Abrir sitio web" con `mcp_token`). Tras esa primera visita, los eventos suelen seguir registrándose durante unos 28 días.

---

## 4. Eventos que se disparan automáticamente

| Acción | Tag API | Evento Pixel |
|--------|---------|--------------|
| Ver landing | - | bear_beat_view_home |
| Clic "Obtener Acceso" / "QUIERO BLINDAR" | - | bear_beat_click_cta_register |
| Clic "Quiero plan USD/MXN" | - | bear_beat_click_plan_usd / _mxn |
| Entrar a auth | - | bear_beat_view_auth |
| Login exitoso | - | bear_beat_login_success |
| Registro exitoso | USER_REGISTERED | bear_beat_registration |
| Clic chat | - | bear_beat_click_chat |
| Ver planes | USER_CHECKED_PLANS | bear_beat_view_plans |
| Seleccionar plan / COMPRAR | USER_CHECKED_PLANS | bear_beat_select_plan, _click_buy |
| Clic SPEI / PayPal | - | bear_beat_click_spei / _click_paypal |
| Entrar a checkout | CHECKOUT_PLAN_ORO / CURIOSO | bear_beat_start_checkout |
| Pago exitoso | SUCCESSFUL_PAYMENT | bear_beat_payment_success |
| Pago fallido (webhooks) | FAILED_PAYMENT | - |
| Cancelar suscripción | CANCELLED_SUBSCRIPTION | bear_beat_cancel_subscription |
| Cambiar plan | - | bear_beat_change_plan |

La lista completa de tags (core + automatizaciones) está en `docs/MANYCHAT_ETIQUETAS.md`.

---

## 5. Automatizaciones en ManyChat

Con los tags y eventos ya funcionando, puedes crear flujos en ManyChat, por ejemplo:

- **Tag "Usuario registrado"** → Bienvenida + info de planes
- **Tag "Pago exitoso"** → Acceso a instrucciones FTP
- **Tag "Usuario revisó planes"** → Recordatorio o cupón
- **Evento bear_beat_start_checkout** → Recordatorio de carrito abandonado

Configúralos en ManyChat → Flows / Automations.

---

## 6. Si algo falla

| Problema | Qué revisar |
|----------|-------------|
| No se crean usuarios en ManyChat | MC_API_KEY en backend/.env, logs del backend |
| No se añaden tags | IDs en `tags.ts` vs `npm run manychat:tags`, logs `[MANYCHAT]` |
| No se ven eventos en ManyChat | Que el usuario llegue desde Messenger (con mcp_token) al menos una vez |
| Errores en consola | Comprobar `window.MC_PIXEL` en la consola del navegador |

---

## 7. Comandos útiles

```bash
# Listar tags de ManyChat
cd backend && npm run manychat:tags

# Crear tags que falten (no borra nada)
cd backend && npm run manychat:create-tags

# Sincronizar: borrar etiquetas no usadas y crear las que usamos
cd backend && npm run manychat:sync
```

---

## 8. Resumen rápido

1. ✅ MC_API_KEY en `backend/.env` (local y producción)
2. ✅ (Opcional) Ejecutar `manychat:sync` para sincronizar tags (es destructivo; ver `docs/MANYCHAT_ETIQUETAS.md`)
3. ✅ O bien `manychat:tags` + `manychat:create-tags` sin borrar nada
4. ✅ Deploy frontend y backend
5. ✅ Probar registro y compra para validar tags
6. ✅ Crear automatizaciones en ManyChat usando tags y eventos
7. ✅ Lista oficial de etiquetas: `docs/MANYCHAT_ETIQUETAS.md`
