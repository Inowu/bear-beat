# Lógica de envío de emails – Bear Beat

Todos los emails salen del **backend** y se envían con **Amazon SES** (AWS SDK). No hay envío de emails desde el frontend; el frontend solo dispara acciones (registro, recuperar contraseña, pago) y el backend envía el correo cuando corresponde.

---

## Proveedor: Amazon SES

- **Cliente:** `backend/src/email/ses.ts` → `SESv2Client` (AWS SDK) con `AWS_REGION` y credenciales estándar de AWS (IAM Role o `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`).
- **Método usado:** `sendSesEmail({ to, subject, html, text })`.
- **Plantillas:** Viven en el código: `backend/src/email/templates.ts` (HTML + texto). No dependemos de templates en el panel del proveedor.

---

## Resumen: qué email se envía y cuándo

| # | Acción en la web | Cuándo se envía | Plantilla (código) | Destinatario | Parámetros que se envían |
|---|------------------|------------------|-----------------|--------------|---------------------------|
| 1 | **Registro** (sign up) | Justo después de crear el usuario en BD | `welcome` | `email` del nuevo usuario | `NAME`, `EMAIL` |
| 2 | **Recuperar contraseña** | Cuando el usuario pide “recuperar contraseña” y el email existe | `passwordReset` | `email` del usuario | `NAME`, `EMAIL`, `LINK` (enlace para reset) |
| 3 | **Compra/activación de plan (Stripe)** | Cuando Stripe confirma la suscripción activa (webhook) | `planActivated` | `email` del usuario | `NAME`, `plan_name`, `price`, `currency`, `ORDER` |
| 4 | **Compra/activación de plan (Conekta)** | Cuando Conekta confirma pago de suscripción (webhook) | `planActivated` | `email` del usuario | `NAME`, `plan_name`, `price`, `currency`, `ORDER` |
| 5 | **Compra/activación de plan (PayPal o Admin)** | Cuando se activa la suscripción vía PayPal o manual (admin) en el flujo de `subscribe()` | `planActivated` | `email` del usuario | `NAME`, `plan_name`, `price`, `currency`, `ORDER` |
| 6 | **Automatización: prueba activa sin descargas (24h)** | Cuando el usuario inicia prueba y no descarga en 24h (automation runner) | `automationTrialNoDownload24h` | `email` del usuario | `NAME`, `URL` |
| 7 | **Automatización: plan pagado sin descargas (24h)** | Cuando el usuario paga su primer plan y no descarga en 24h (automation runner) | `automationPaidNoDownload24h` | `email` del usuario | `NAME`, `URL` |
| 8 | **Automatización: registrado sin compra (7d)** | Cuando el usuario se registró hace 7 días y no compró (automation runner) | `automationRegisteredNoPurchase7d` | `email` del usuario | `NAME`, `URL` |
| 9 | **Alertas internas de analytics** | Script/cron que envía alertas cuando hay métricas fuera de umbral | `analyticsAlerts` | Lista `ANALYTICS_ALERTS_EMAIL_TO` | `days`, `count`, `detailsText`, `generatedAt` |
| 10 | **Automatización: oferta (cupón) tras ver planes** | Si el usuario ve `/planes` y no inicia checkout en 12h. Escala a 30% tras 2 días y 50% tras 15 días (si sigue sin comprar) | `automationPlansOffer` | `email` del usuario | `NAME`, `URL`, `couponCode`, `percentOff`, `expiresAt` |
| 11 | **Automatización: verificar WhatsApp (24h)** | Si el usuario se registró hace 24h+ y no verificó WhatsApp (requerido para descargar) | `automationVerifyWhatsApp24h` | `email` del usuario | `NAME`, `URL` |
| 12 | **Automatización: checkout sin compra (1h)** | Si el usuario inicia checkout y no compra en 1 hora | `automationCheckoutAbandoned` | `email` del usuario | `NAME`, `URL` (y opcional `planName/price/currency`) |
| 13 | **Automatización: checkout sin compra (24h)** | Si el usuario inicia checkout y no compra en 24 horas | `automationCheckoutAbandoned` | `email` del usuario | `NAME`, `URL` (y opcional `planName/price/currency`) |
| 14 | **Automatización: prueba expira (24h)** | Si el usuario inició prueba y está a ~24h de expirar sin comprar | `automationTrialExpiring24h` | `email` del usuario | `NAME`, `URL` |
| 15 | **Automatización: activo sin descargas (7/14/21d)** | Si el usuario tiene plan activo pero no descarga en 7/14/21 días | `automationActiveNoDownload` | `email` del usuario | `NAME`, `URL`, `days` |

Fuera de esto, no hay más puntos en el repo que envíen emails. Cualquier otro email que quieras (por ejemplo recordatorios, facturas, etc.) habría que añadirlo y definir el HTML/subject en `backend/src/email/templates.ts`.

---

## Detalle por acción

### 1. Email tras registro (welcome)

- **Dónde:** `backend/src/routers/auth/procedures/register.ts`
- **Cuándo:** Después de crear el usuario en la base de datos y (si aplica) crear cliente en Conekta. Se envía siempre que el registro termine bien, independientemente de Twilio/verificación.
- **Por qué:** Dar la bienvenida y confirmar el registro (y opcionalmente recordar usuario/email).
- **Flujo en la web:** El usuario rellena el formulario en `/auth/registro` → frontend llama a `auth.register` (tRPC) → backend crea usuario → envía email con template 3.
- **Params:** `NAME` (username), `EMAIL` (email del usuario).

---

### 2. Email de recuperar contraseña (passwordReset)

- **Dónde:** `backend/src/routers/auth/procedures/forgotPasword.ts`
- **Cuándo:** El usuario introduce su email en “Recuperar contraseña”; si existe un usuario con ese email, se genera un token, se guarda en BD con expiración (1 hora) y se envía el email. Si el email no existe, no se envía nada (por seguridad no se revela si el email está registrado).
- **Por qué:** Enviar el enlace seguro para restablecer la contraseña en `/auth/reset-password?token=...&userId=...`.
- **Flujo en la web:** Usuario en `/auth/recuperar` escribe su email → frontend llama a `auth.forgotPassword` → backend busca usuario, genera token, guarda, envía email (y además envía el mismo enlace por WhatsApp si hay teléfono, vía Twilio).
- **Params:** `NAME`, `EMAIL`, `LINK` (enlace de reset con token y userId).

---

### 3. Email de compra/plan (planActivated) – Stripe

- **Dónde:** `backend/src/routers/webhooks/stripe/index.ts`
- **Cuándo:** El webhook de Stripe recibe el evento `customer.subscription.updated` y el estado de la suscripción es `active`. Justo antes de llamar a `subscribe()` se envía el email.
- **Por qué:** Confirmar al usuario que su pago con Stripe fue exitoso y que su plan está activo (resumen de plan, precio, orden).
- **Flujo en la web:** Usuario paga con Stripe → Stripe envía webhook al backend → backend procesa, activa suscripción y envía email con template 2.
- **Params:** `NAME`, `plan_name`, `price`, `currency`, `ORDER` (orderId que viene en `subscription.metadata.orderId`).

---

### 4. Email de compra/plan (planActivated) – Conekta

- **Dónde:** `backend/src/routers/webhooks/conekta/index.ts`
- **Cuándo:** El webhook de Conekta recibe el evento de suscripción pagada (p. ej. `sub_paid`); después de crear/actualizar la suscripción en BD se envía el email.
- **Por qué:** Confirmar que el pago con Conekta (OXXO, SPEI, tarjeta, etc.) fue recibido y el plan está activo.
- **Flujo en la web:** Usuario paga con Conekta → Conekta envía webhook → backend procesa y envía email con template 2.
- **Params:** `NAME`, `plan_name`, `price`, `currency`, `ORDER` (id de la orden).

---

### 5. Email de compra/plan (planActivated) – PayPal o Admin

- **Dónde:** `backend/src/routers/subscriptions/services/subscribe.ts`
- **Cuándo:** Dentro de `subscribe()`, cuando es una **nueva** suscripción (no existía `ftpUser`) y el servicio es `PaymentService.ADMIN` o `PaymentService.PAYPAL`. Tras crear FTP, descargas y orden, se envía el email.
- **Por qué:** Confirmar la activación del plan cuando el pago fue por PayPal o cuando un admin activa el plan manualmente.
- **Flujo en la web:**  
  - PayPal: usuario paga con PayPal → flujo de PayPal confirma → se llama a `subscribe()` con servicio PAYPAL → se envía email.  
  - Admin: desde el panel admin se activa un plan para un usuario → se llama a `subscribe()` con servicio ADMIN → se envía email.
- **Params:** `NAME`, `plan_name`, `price`, `currency`, `ORDER` (id de la orden).

---

## Resumen de plantillas (código)

| Plantilla | Uso                         | Variables que recibe el backend |
|-----|-----------------------------|----------------------------------|
| `passwordReset` | Recuperar contraseña       | `NAME`, `EMAIL`, `LINK`         |
| `planActivated` | Confirmación de compra/plan | `NAME`, `plan_name`, `price`, `currency`, `ORDER` |
| `welcome` | Bienvenida / registro       | `NAME`, `EMAIL`                 |
| `automationTrialNoDownload24h` | Automatización: prueba activa sin descargas (24h) | `NAME`, `URL` |
| `automationPaidNoDownload24h` | Automatización: plan pagado sin descargas (24h) | `NAME`, `URL` |
| `automationRegisteredNoPurchase7d` | Automatización: registrado sin compra (7d) | `NAME`, `URL` |
| `automationPlansOffer` | Automatización: oferta (cupón) tras ver planes sin checkout | `NAME`, `URL`, `couponCode`, `percentOff`, `expiresAt` |
| `automationVerifyWhatsApp24h` | Automatización: verificar WhatsApp (24h) | `NAME`, `URL` |
| `automationCheckoutAbandoned` | Automatización: checkout sin compra | `NAME`, `URL` (y opcional `planName/price/currency`) |
| `automationTrialExpiring24h` | Automatización: prueba expira (24h) | `NAME`, `URL` |
| `automationActiveNoDownload` | Automatización: activo sin descargas (7/14/21d) | `NAME`, `URL`, `days` |
| `analyticsAlerts` | Alertas internas de analytics (script/cron) | `days`, `count`, `detailsText`, `generatedAt` |

Los textos/diseño se editan en el repo (templates en `backend/src/email/templates.ts`).

---

## Notas

- **Recuperar contraseña:** Además del email, se envía el mismo enlace por **WhatsApp** (Twilio) si el usuario tiene teléfono en BD.
- **Automations (emails):** Se envían desde `backend/src/automation/runner.ts` y están detrás de flags tipo `AUTOMATION_EMAIL_*_TEMPLATE_ID` (por compatibilidad histórica). Si el valor es `> 0`, se envía el email.
- **Límite por corrida:** `AUTOMATION_EMAIL_MAX_PER_RUN` limita cuántos emails manda el runner en una sola corrida (protege entregabilidad).
- **Oferta por email (cupón):** Flag: `AUTOMATION_EMAIL_PLANS_OFFER_TEMPLATE_ID` (si `> 0`, se envía).
- **Consent / desuscripción (promos):** Los emails de marketing incluyen enlace para **cancelar promociones**. Esto desactiva `email_marketing_opt_in` y las categorías (`email_marketing_news_opt_in`, `email_marketing_offers_opt_in`, `email_marketing_digest_opt_in`) para el usuario (no afecta emails transaccionales como pagos o reset password). Endpoint: `/api/comms/unsubscribe` (firma HMAC con `EMAIL_PREFERENCES_SECRET`). Las automatizaciones por email respetan opt-in global + categoría.
- **Alertas de analytics:** Se envían desde `backend/scripts/analyticsAlerts.ts` (ejecutar con `npm run analytics:alerts` en el workspace `backend`). Requiere `ANALYTICS_ALERTS_EMAIL_TO`.
- **Errores:** Si SES falla, se registra en logs y en algunos flujos se devuelve un mensaje neutral al usuario; la lógica de negocio (crear usuario, guardar token, activar plan) ya se habrá ejecutado.
- **Variables de entorno:** `AWS_REGION` y `SES_FROM_EMAIL` deben estar definidas en el backend para que cualquier envío funcione.
- **CLIENT_URL:** En el email de recuperar contraseña, el enlace se arma con `process.env.CLIENT_URL`; debe apuntar a la URL del frontend (ej. `https://thebearbeat.com`).

Si en el futuro añades más emails (por ejemplo recordatorio de vencimiento, factura, cambio de contraseña confirmado), conviene añadir aquí la acción y el template en código que se usó.
