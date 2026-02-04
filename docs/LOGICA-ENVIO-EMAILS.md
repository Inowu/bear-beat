# Lógica de envío de emails – Bear Beat

Todos los emails salen del **backend** y se envían con **Brevo** (API transaccional). No hay envío de emails desde el frontend; el frontend solo dispara acciones (registro, recuperar contraseña, pago) y el backend envía el correo cuando corresponde.

---

## Proveedor: Brevo

- **Cliente:** `backend/src/email/index.ts` → instancia de `Api` de `brevo.ts` con `api-key` en `process.env.BREVO_API_KEY`.
- **Método usado:** `brevo.smtp.sendTransacEmail({ templateId, to, params })`.
- **Plantillas:** Se usan 3 plantillas en la cuenta de Brevo (por ID). Los textos se gestionan en el panel de Brevo; el backend solo pasa el `templateId` y las variables (`params`).

---

## Resumen: qué email se envía y cuándo

| # | Acción en la web | Cuándo se envía | Plantilla Brevo | Destinatario | Parámetros que se envían |
|---|------------------|------------------|-----------------|--------------|---------------------------|
| 1 | **Registro** (sign up) | Justo después de crear el usuario en BD | **Template 3** | `email` del nuevo usuario | `NAME`, `EMAIL` |
| 2 | **Recuperar contraseña** | Cuando el usuario pide “recuperar contraseña” y el email existe | **Template 1** | `email` del usuario | `NAME`, `EMAIL`, `LINK` (enlace para reset) |
| 3 | **Compra/activación de plan (Stripe)** | Cuando Stripe confirma la suscripción activa (webhook) | **Template 2** | `email` del usuario | `NAME`, `plan_name`, `price`, `currency`, `ORDER` |
| 4 | **Compra/activación de plan (Conekta)** | Cuando Conekta confirma pago de suscripción (webhook) | **Template 2** | `email` del usuario | `NAME`, `plan_name`, `price`, `currency`, `ORDER` |
| 5 | **Compra/activación de plan (PayPal o Admin)** | Cuando se activa la suscripción vía PayPal o manual (admin) en el flujo de `subscribe()` | **Template 2** | `email` del usuario | `NAME`, `plan_name`, `price`, `currency`, `ORDER` |

No hay más puntos en el código que llamen a `sendTransacEmail`. Cualquier otro email que quieras (por ejemplo recordatorios, facturas, etc.) habría que añadirlo y, si usas plantilla, crearla en Brevo y referenciarla por `templateId`.

---

## Detalle por acción

### 1. Email tras registro (Template 3)

- **Dónde:** `backend/src/routers/auth/procedures/register.ts`
- **Cuándo:** Después de crear el usuario en la base de datos y (si aplica) crear cliente en Conekta. Se envía siempre que el registro termine bien, independientemente de Twilio/verificación.
- **Por qué:** Dar la bienvenida y confirmar el registro (y opcionalmente recordar usuario/email).
- **Flujo en la web:** El usuario rellena el formulario en `/auth/registro` → frontend llama a `auth.register` (tRPC) → backend crea usuario → envía email con template 3.
- **Params:** `NAME` (username), `EMAIL` (email del usuario).

---

### 2. Email de recuperar contraseña (Template 1)

- **Dónde:** `backend/src/routers/auth/procedures/forgotPasword.ts`
- **Cuándo:** El usuario introduce su email en “Recuperar contraseña”; si existe un usuario con ese email, se genera un token, se guarda en BD con expiración (1 hora) y se envía el email. Si el email no existe, no se envía nada (por seguridad no se revela si el email está registrado).
- **Por qué:** Enviar el enlace seguro para restablecer la contraseña en `/auth/reset-password?token=...&userId=...`.
- **Flujo en la web:** Usuario en `/auth/recuperar` escribe su email → frontend llama a `auth.forgotPassword` → backend busca usuario, genera token, guarda, envía email (y además envía el mismo enlace por WhatsApp si hay teléfono, vía Twilio).
- **Params:** `NAME`, `EMAIL`, `LINK` (enlace de reset con token y userId).

---

### 3. Email de compra/plan (Template 2) – Stripe

- **Dónde:** `backend/src/routers/webhooks/stripe/index.ts`
- **Cuándo:** El webhook de Stripe recibe el evento `customer.subscription.updated` y el estado de la suscripción es `active`. Justo antes de llamar a `subscribe()` se envía el email.
- **Por qué:** Confirmar al usuario que su pago con Stripe fue exitoso y que su plan está activo (resumen de plan, precio, orden).
- **Flujo en la web:** Usuario paga con Stripe → Stripe envía webhook al backend → backend procesa, activa suscripción y envía email con template 2.
- **Params:** `NAME`, `plan_name`, `price`, `currency`, `ORDER` (orderId que viene en `subscription.metadata.orderId`).

---

### 4. Email de compra/plan (Template 2) – Conekta

- **Dónde:** `backend/src/routers/webhooks/conekta/index.ts`
- **Cuándo:** El webhook de Conekta recibe el evento de suscripción pagada (p. ej. `sub_paid`); después de crear/actualizar la suscripción en BD se envía el email.
- **Por qué:** Confirmar que el pago con Conekta (OXXO, SPEI, tarjeta, etc.) fue recibido y el plan está activo.
- **Flujo en la web:** Usuario paga con Conekta → Conekta envía webhook → backend procesa y envía email con template 2.
- **Params:** `NAME`, `plan_name`, `price`, `currency`, `ORDER` (id de la orden).

---

### 5. Email de compra/plan (Template 2) – PayPal o Admin

- **Dónde:** `backend/src/routers/subscriptions/services/subscribe.ts`
- **Cuándo:** Dentro de `subscribe()`, cuando es una **nueva** suscripción (no existía `ftpUser`) y el servicio es `PaymentService.ADMIN` o `PaymentService.PAYPAL`. Tras crear FTP, descargas y orden, se envía el email.
- **Por qué:** Confirmar la activación del plan cuando el pago fue por PayPal o cuando un admin activa el plan manualmente.
- **Flujo en la web:**  
  - PayPal: usuario paga con PayPal → flujo de PayPal confirma → se llama a `subscribe()` con servicio PAYPAL → se envía email.  
  - Admin: desde el panel admin se activa un plan para un usuario → se llama a `subscribe()` con servicio ADMIN → se envía email.
- **Params:** `NAME`, `plan_name`, `price`, `currency`, `ORDER` (id de la orden).

---

## Resumen de plantillas Brevo

| ID  | Uso                         | Variables que recibe el backend |
|-----|-----------------------------|----------------------------------|
| **1** | Recuperar contraseña       | `NAME`, `EMAIL`, `LINK`         |
| **2** | Confirmación de compra/plan | `NAME`, `plan_name`, `price`, `currency`, `ORDER` |
| **3** | Bienvenida / registro       | `NAME`, `EMAIL`                 |

Los textos y el diseño de cada plantilla se editan en el panel de Brevo (Transactional → Templates). El backend solo envía el `templateId` y los `params`; no define el asunto ni el cuerpo del correo.

---

## Notas

- **Recuperar contraseña:** Además del email, se envía el mismo enlace por **WhatsApp** (Twilio) si el usuario tiene teléfono en BD.
- **Errores:** Si `sendTransacEmail` falla, se registra en logs y en algunos flujos se devuelve un mensaje al usuario (por ejemplo en forgot password); la lógica de negocio (crear usuario, guardar token, activar plan) ya se habrá ejecutado.
- **Variable de entorno:** `BREVO_API_KEY` debe estar definida en el backend para que cualquier envío funcione.
- **CLIENT_URL:** En el email de recuperar contraseña, el enlace se arma con `process.env.CLIENT_URL`; debe apuntar a la URL del frontend (ej. `https://thebearbeat.com`).

Si en el futuro añades más emails (por ejemplo recordatorio de vencimiento, factura, cambio de contraseña confirmado), conviene añadir aquí la acción, el archivo y el `templateId` usado.
