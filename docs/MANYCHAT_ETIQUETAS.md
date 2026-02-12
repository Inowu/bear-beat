# ManyChat – Etiquetas (tags) oficiales

Lista única de etiquetas que usa Bear Beat (código + automatizaciones).

---

## 1) Tags Core (código)

| Nombre en ManyChat       | Clave en código        | Cuándo se asigna                          |
|--------------------------|------------------------|-------------------------------------------|
| Usuario revisó planes    | USER_CHECKED_PLANS     | Usuario ve la lista de planes (API)       |
| Usuario registrado       | USER_REGISTERED        | Registro exitoso                          |
| Checkout Plan Oro        | CHECKOUT_PLAN_ORO      | Entra a checkout con plan Oro             |
| Checkout Plan Curioso    | CHECKOUT_PLAN_CURIOSO  | Entra a checkout con plan Curioso         |
| Pago exitoso             | SUCCESSFUL_PAYMENT     | Pago correcto (Stripe, PayPal, Conekta)  |
| Canceló suscripción      | CANCELLED_SUBSCRIPTION | Usuario cancela la suscripción           |
| Pago fallido             | FAILED_PAYMENT         | Pago fallido (tarjeta, renovación, etc.) |
| Trial iniciado           | TRIAL_STARTED          | Trial empieza (Stripe)                    |
| Trial convertido         | TRIAL_CONVERTED        | Trial pasa a pago (Stripe)                |
| Renovación de suscripción| SUBSCRIPTION_RENEWED   | Renovación (Stripe/PayPal)                |

Los IDs se guardan en `backend/src/many-chat/tags.ts`. Si cambian, actualizar ese archivo.

---

## 2) Tags de Automatización (backend automation runner)

Estos tags no están tipados en `tags.ts` (se agregan por nombre). Deben existir para que `addTagByName` funcione.

| Nombre en ManyChat                    | Cuándo se asigna |
|--------------------------------------|------------------|
| AUTOMATION_TRIAL_NO_DOWNLOAD_24H     | Trial iniciado y no descargó en 24h |
| AUTOMATION_PAID_NO_DOWNLOAD_24H      | Pagó y no descargó en 24h |
| AUTOMATION_REGISTERED_NO_PURCHASE_7D | Registrado hace 7 días y no compró |
| AUTOMATION_ACTIVE_NO_DOWNLOAD_7D     | Suscripción activa y sin descargas 7 días |
| AUTOMATION_ACTIVE_NO_DOWNLOAD_14D    | Suscripción activa y sin descargas 14 días |
| AUTOMATION_ACTIVE_NO_DOWNLOAD_21D    | Suscripción activa y sin descargas 21 días |
| AUTOMATION_PLANS_OFFER_10            | Oferta 10% (planes vistos, no checkout) |
| AUTOMATION_PLANS_OFFER_30            | Escalación oferta 30% |
| AUTOMATION_PLANS_OFFER_50            | Escalación oferta 50% |

---

## 3) Tags de Flow (ManyChat UI)

| Nombre en ManyChat | Cuándo se asigna |
|--------------------|------------------|
| Interesado Demo    | Cuando alguien pide el demo/catálogo en ManyChat |

---

## Sincronizar ManyChat con el código

**Listar etiquetas actuales:**
```bash
cd backend && npm run manychat:tags
```

**Crear solo las que faltan (no borra nada):**
```bash
cd backend && npm run manychat:create-tags
```

**Sincronizar (borra las que no usamos y crea las que faltan):**
```bash
cd backend && npm run manychat:sync
```

- `manychat:sync` elimina de ManyChat cualquier etiqueta cuyo nombre **no** esté en este documento.
- Luego crea las tags que falten.
- Al final imprime el bloque para copiar en `tags.ts` si los IDs cambian.

Requisito: `MC_API_KEY` en `backend/.env`.

---

## Resumen

- Las que no estén en esta lista se consideran “no usadas” y se pueden borrar con `manychat:sync` (es destructivo).
- Documentación detallada: `TRACKING_NIVEL_DIOS.md` y `MANUAL_TRACKING_MANYCHAT.md`.
