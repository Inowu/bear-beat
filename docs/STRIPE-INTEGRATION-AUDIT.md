# Auditoría de integración Stripe (vs documentación actual)

Referencia: [Payment Element best practices](https://docs.stripe.com/payments/payment-element/best-practices), [Payment Intents API](https://docs.stripe.com/payments/payment-intents), [API versioning](https://docs.stripe.com/upgrades#api-versions).

---

## Estado actual del proyecto

| Área | Implementación actual | Recomendación Stripe |
|------|------------------------|----------------------|
| **Backend** | | |
| API version | `2023-08-16` en `backend/src/stripe/index.ts` | Usar versión reciente y fijarla en código. Revisar [changelog](https://docs.stripe.com/changelog) antes de subir. |
| Suscripciones | `subscriptions.create` con `expand: ['latest_invoice.payment_intent']`, metadata `orderId` | ✅ Payment Intents bajo la factura. Idempotency key añadida. |
| PaymentIntents (compras GB) | `paymentIntents.create` con metadata `productOrderId` | ✅ Idempotency key añadida. |
| Webhooks | Firma verificada con `constructEvent(body, sig, secret)`; body parseado con `JSON.parse` | ✅ Body crudo (Buffer) manejado con `getStripeWebhookBody()` para parseo seguro. |
| **Frontend** | | |
| Checkout | `CardElement` + `stripe.confirmCardPayment(clientSecret, { payment_method: { card } })` | Migrar a **Payment Element** para 3DS automático, Link, más métodos y mejor conversión. |

---

## Mejoras ya aplicadas en este repo

1. **Webhook body seguro**  
   Con `express.raw()`, `req.body` es un `Buffer`. Se añadió `getStripeWebhookBody(req)` y su uso en los handlers de webhook (suscripciones y Payment Intents) para hacer `JSON.parse` sobre string y evitar fallos o comportamientos raros.

2. **Idempotency keys**  
   - `subscribeWithStripe`: `subscriptions.create(..., { idempotencyKey: 'stripe-sub-order-{orderId}' })`.  
   - `buyMoreGB` (Stripe): `paymentIntents.create(..., { idempotencyKey: 'stripe-pi-order-{productOrderId}' })`.  
   Así se evitan suscripciones o intents duplicados en reintentos.

3. **Metadata como string**  
   `metadata.orderId` y `metadata.productOrderId` se envían como string (requisito de la API).

---

## Recomendaciones pendientes (no críticas)

### 1. Migrar de Card Element a Payment Element (frontend)

- **Documentación:** [Payment Element](https://docs.stripe.com/payments/payment-element), [Accept a payment (Elements)](https://docs.stripe.com/payments/accept-a-payment?payment-ui=elements&api-integration=paymentintents).
- **Ventajas:** Métodos dinámicos desde el Dashboard, 3DS/SCA manejado por Stripe, Link, Apple/Google Pay, mejor UX y menos código propio.
- **Cambio:** En Checkout, en lugar de `CardElement` + `confirmCardPayment`, usar `<PaymentElement>` con el `clientSecret` del Payment Intent (el que ya devuelve el backend en `subscribeWithStripe`). Confirmar con `stripe.confirmPayment()`.
- El flujo de suscripción (crear suscripción → `latest_invoice.payment_intent.client_secret` → confirmar en front) es compatible; solo cambia el componente de pago.

### 2. Actualizar versión de API (backend)

- Hoy: `apiVersion: '2023-08-16'`.
- Revisar [Stripe API Changelog](https://docs.stripe.com/changelog) y la versión que usa el SDK de Node (`stripe` en `package.json`).  
- Actualizar a una versión reciente (p. ej. la que trae el SDK o la última estable del changelog), probar en test y luego en producción.

### 3. Opcionales según producto

- **Link:** Activar en [Dashboard → Payment methods](https://dashboard.stripe.com/settings/payment_methods) para guardar y rellenar datos.
- **Payment Method Messaging / Express Checkout:** Si se ofrecen BNPL o botones de pago express, seguir [docs de esos elementos](https://docs.stripe.com/payments/payment-element/best-practices).
- **Radar / metadata:** Para reglas de fraude, se puede enviar en metadata (sin datos sensibles) identificadores como `user_id` o `plan_id` si lo permite tu modelo de datos.

---

## Resumen

- La integración ya usa **Payment Intents** (vía suscripciones y compras de GB), **webhooks verificados** y **metadata** en órdenes.
- Se han aplicado **mejores prácticas críticas**: body de webhook seguro e **idempotency** en creación de suscripción y PaymentIntent.
- El siguiente paso de mayor impacto es migrar el checkout al **Payment Element** y, en segundo plano, actualizar la **API version** de forma controlada.
