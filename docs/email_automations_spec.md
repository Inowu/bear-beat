# Email Automations Spec (Bear Beat)

Este documento define el comportamiento esperado para automatizaciones de email estilo Netflix/Spotify enfocadas en billing/retención, con cumplimiento y controles operativos.

## Objetivos

- Reducir churn por pagos fallidos (dunning).
- Confirmar cancelación sin fricción y mantener claridad de “acceso hasta fin de periodo”.
- Recuperar usuarios cancelados (winback) con ofertas controladas.
- Permitir preferencias claras:
  - Transaccionales (no opt-out).
  - Marketing (opt-out global y por categorías).
- Seguridad operativa:
  - Kill switch para detener automatizaciones de email sin deploy.
  - No emails reales en dev/staging/tests (sink).
  - Idempotencia (no duplicar emails).
  - No PII ni datos de pago en logs.

## Definiciones

- Email transaccional: requerido para operar el servicio (seguridad, billing, cancelación, pago fallido, restablecer contraseña). No debe permitir “unsubscribe” global.
- Email marketing: promociones, novedades, digest. Siempre debe incluir `unsubscribe` y respetar preferencias.

## Controles Operativos (Obligatorios)

### Kill Switch

- `EMAIL_AUTOMATIONS_ENABLED`:
  - `1` (default): automatizaciones de email habilitadas.
  - `0`: deshabilita el envío de emails automatizados (dunning, cancelación, winback, campañas). No requiere deploy; basta con cambiar el env var y reiniciar el proceso.

### Modo de Entrega (No enviar emails reales fuera de producción)

- `EMAIL_DELIVERY_MODE`:
  - `ses`: permite envío real vía Amazon SES (solo en runtime de producción).
  - `sink`: no envía; “consume” el email sin delivery real.
- Runtime de producción:
  - `NODE_ENV=production` y (`SENTRY_ENVIRONMENT` vacío o `production`).
- En dev/staging/test el modo efectivo siempre debe ser `sink` aunque alguien configure `ses`.

### Idempotencia

- Cada email automatizado debe tener un idempotency key estable:
  - Recomendado: usar `automation_action_logs` con `action_key` + `stage` (o tabla dedicada) para garantizar `at-most-once`.
- Webhooks + jobs deben ser re-ejecutables sin duplicar envíos.

### Logs (sin PII)

En logs solo se permiten:
- `userId` interno.
- `emailKind` (tipo/código interno).
- `actionKey` y `stage` (si aplica).
- `timestamp`.
- `providerMessageId` (si aplica).

Prohibido loguear:
- Email/phone/dirección/IP.
- Payloads completos de Stripe/PayPal/Conekta.
- Datos de pago (tokens, last4, etc).

## Dunning (Pagos Fallidos)

### Disparadores

- Se inicia secuencia cuando el proveedor reporta un fallo de cobro de membresía:
  - Stripe: `invoice.payment_failed` y/o transición a `past_due`.
  - PayPal: `BILLING.SUBSCRIPTION.PAYMENT.FAILED`.
  - Conekta: eventos equivalentes (según integración).

### Secuencia de Emails

La secuencia se define por “Días desde el primer fallo”:

- D0 (inmediato):
  - Objetivo: notificar “no se pudo cobrar”.
  - CTA: “Actualizar método de pago”.
- D1:
  - Recordatorio corto + CTA.
- D3:
  - Reforzar pérdida de acceso si no se actualiza.
- D7:
  - Aviso fuerte. Puede activar “soft-lock” opcional.
- D14:
  - Último aviso. Si no se resuelve, el acceso puede suspenderse/cancelarse por sistema.

Notas:
- La secuencia se cancela automáticamente si el pago se recupera (payment succeeded).
- No deben enviarse emails antiguos fuera de ventana (ejemplo: si se habilitan después de 30 días, no backfillear D0/D1/D3).

### Reintentos y Ventanas

- Cada etapa (D0/D1/D3/D7/D14) solo se puede enviar 1 vez por usuario por “ciclo de dunning”.
- Reintentos internos por errores transitorios (SES / red) deben ser controlados por el job runner (con backoff) sin duplicar envíos.

### Soft-Lock (Opcional)

- Configurable (por env var) para limitar ciertas acciones si el pago sigue fallando:
  - Ejemplo: bloquear descargas pero permitir login/actualización de pago.
- Debe ser reversible automáticamente cuando el pago se recupere.

### Reactivación

Cuando el proveedor confirme pago exitoso:
- Cancelar estado de dunning.
- Enviar email transaccional “Pago recibido, acceso restaurado”.
- Quitar soft-lock si estaba activo.

### Link de Actualización de Pago

- CTA debe llevar a un flujo de actualización de método de pago:
  - Preferido: Stripe Billing Portal (session por usuario).
  - Alternativa: página propia que crea sesión/checkout para update.

## Cancelación (Voluntaria) + Fin de Acceso

### Al cancelar

Email transaccional inmediato:
- Confirmación de cancelación.
- Fecha exacta de fin de acceso (fin de periodo pagado).
- CTA opcional: “Reactivar” (si el proveedor lo permite) o “Ver planes”.

### 3 días antes de fin de acceso

Email transaccional:
- Recordatorio “tu acceso termina el {fecha}”.
- CTA: “Reactivar” / “Renovar”.

### Fin de acceso

Evento (sin email obligatorio, opcional según estrategia):
- Marcar usuario como “lapsed” para winback.
- Email transaccional opcional: “Tu acceso terminó” con CTA a reactivar.

## Winback (Recuperación)

Marketing only (respetar preferencias).

Cadencia:
- +7 días desde fin de acceso.
- +30 días.
- +60 días.

Contenido:
- Beneficio claro + CTA a planes.
- Oferta opcional (cupón) con expiración.
- Siempre incluir `unsubscribe`.

Segmentos recomendados:
- Lapsed: antes pagaron, hoy sin acceso.
- Never paid: se registraron pero nunca compraron.

## Preferencias (Centro de Preferencias + Unsubscribe)

### Reglas

- Transactional:
  - Seguridad/billing/cancelación/pago fallido.
  - No desactivable por el usuario (solo se detiene cerrando la cuenta o por razones legales).
- Marketing:
  - Desactivable globalmente.
  - Desactivable por categorías:
    - `novedades`
    - `ofertas`
    - `digest`

### Unsubscribe (Marketing)

- Debe existir un link funcional en todos los emails marketing.
- Debe desactivar marketing global (y, si existen, todas las categorías marketing).

### Centro de Preferencias

- Debe permitir:
  - Ver estado actual.
  - Activar/desactivar categorías marketing.
  - Confirmar que transaccionales siguen activos.
- El acceso puede ser:
  - Autenticado (usuario logueado), o
  - Tokenizado con firma/expiración (sin exponer PII).

