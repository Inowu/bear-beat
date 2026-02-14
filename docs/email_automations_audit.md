# Email Automations Audit (Estado Actual)

Este documento audita el estado actual del repo respecto a automatizaciones de email solicitadas (dunning, cancelación/winback, preferencias).

Leyenda:
- `EXISTE`: implementado y operativo (con rutas/jobs + idempotencia + templates).
- `PARCIAL`: hay piezas, pero falta secuencia completa, jobs, o cumplimiento.
- `NO EXISTE`: no hay implementación.

## Infra / Envío de Emails

- Amazon SES (envío básico): `EXISTE`
  - Evidencia:
    - `backend/src/email/ses.ts` (cliente SESv2 + `sendSesEmail`)
    - `backend/src/email/mailer.ts` (`sendEmail`, `sendWelcomeEmail`, etc.)
    - `backend/.env.example` (variables `AWS_REGION`, `SES_FROM_EMAIL`, `SES_FROM_NAME`)

## Controles Operativos (Seguridad)

- Kill switch de automatizaciones de email: `EXISTE`
  - Evidencia:
    - `backend/src/automation/runner.ts` (lee `EMAIL_AUTOMATIONS_ENABLED` y salta envíos)
    - `backend/scripts/campaignWinback.ts` (respeta `EMAIL_AUTOMATIONS_ENABLED=0`)

- Modo “sink” fuera de producción (no emails reales): `EXISTE`
  - Evidencia:
    - `backend/src/email/mailer.ts` (fuerza `sink` en no-prod; opcional `EMAIL_SINK_DIR`)
    - `backend/.env.example` (`EMAIL_DELIVERY_MODE`, `EMAIL_SINK_DIR`)

- Logs sin PII/payloads completos: `PARCIAL`
  - Evidencia:
    - Se removieron logs con emails/payloads completos en varios webhooks y mailer.
  - Gaps:
    - Aún hay logs y herramientas internas que podrían requerir una revisión adicional para eliminar identificadores externos no esenciales.

## Automatizaciones Existentes (Marketing)

- Runner de automatizaciones (tick periódico): `EXISTE`
  - Evidencia:
    - `backend/src/automationRunner.ts`
    - `backend/src/automation/runner.ts` (reglas: trial/paid no download, registered no purchase, checkout abandoned, winback lapsed, etc.)
    - Dedupe/idempotencia: `backend/prisma/schema.prisma` (`automation_action_logs` con unique `user_id+action_key+stage`)

## Dunning (Pagos Fallidos)

- Secuencia D0/D1/D3/D7/D14 por email: `PARCIAL`
  - Evidencia:
    - `backend/src/automation/runner.ts` (`action_key='dunning_payment_failed'` con stages 0/1/3/7/14)
    - Template: `backend/src/email/templates.ts` (`dunningPaymentFailed`)
    - Link de actualizacion (Stripe): `backend/src/endpoints/billing-portal.endpoint.ts` + `backend/src/billing/stripeBillingPortalLink.ts`
  - Gaps:
    - Reactivacion (email "pago recuperado") no implementada.
    - Soft-lock opcional no implementado (solo notificacion).

- Señales/analytics de “payment_failed”: `PARCIAL`
  - Evidencia:
    - Stripe: `backend/src/routers/webhooks/stripe/index.ts` ingiere eventos internos `payment_failed` (billing).
    - PayPal: `backend/src/routers/webhooks/paypal/index.ts` ingiere eventos internos `payment_failed` (billing).
    - Runner: `backend/src/automation/runner.ts` consume `payment_failed` y dispara la secuencia si `DUNNING_ENABLED=1`.
  - Gaps:
    - Falta normalizar triggers a `invoice.payment_failed` en Stripe (hoy se basa en transiciones/errores ya integrados).

## Cancelación + Fin de Acceso

- Email de confirmación de cancelación (transaccional): `EXISTE`
  - Evidencia:
    - Template: `backend/src/email/templates.ts` (`cancellationConfirmed`)
    - Envío: `backend/src/routers/subscriptions/cancel/cancelServicesSubscriptions.ts` (idempotente via `automation_action_logs`)
    - Mailer: `backend/src/email/mailer.ts` (`sendCancellationConfirmedEmail`)

- Recordatorio 3 días antes de fin de acceso: `EXISTE`
  - Evidencia:
    - Runner: `backend/src/automation/runner.ts` (`action_key='cancel_access_end_reminder'`, `stage=3`)
    - Template: `backend/src/email/templates.ts` (`cancellationEndingSoon`)

- Email al terminar acceso (opcional): `NO EXISTE`
  - Evidencia:
    - No hay job/scheduler ni template asociado.

## Winback (Recuperación)

- Winback por email (7/30/60): `EXISTE`
  - Evidencia:
    - Runner: `backend/src/automation/runner.ts` (regla `winback_lapsed` con cadencia 7/30/60; respeta `email_marketing_opt_in` + `email_marketing_offers_opt_in`).
    - Script de campaña (segmentos `lapsed`/`never_paid`): `backend/scripts/campaignWinback.ts` (respeta `email_marketing_opt_in` + `email_marketing_offers_opt_in`).
  - Notas:
    - La categoría `digest` existe en preferencias, pero hoy no hay envíos tipo digest (solo se usa para futuros emails).

## Preferencias (Transaccional vs Marketing)

- Unsubscribe marketing: `EXISTE`
  - Evidencia:
    - Firma/verificación: `backend/src/comms/unsubscribe.ts`
    - Endpoint público: `backend/src/endpoints/comms-unsubscribe.endpoint.ts` (`GET /api/comms/unsubscribe`), setea `users.email_marketing_opt_in=false` y desactiva categorías.

- Centro de preferencias (categorías): `EXISTE`
  - Evidencia:
    - Campos por categoría: `backend/prisma/schema.prisma` (`email_marketing_news_opt_in`, `email_marketing_offers_opt_in`, `email_marketing_digest_opt_in`).
    - API (autenticada): `backend/src/routers/comms` (`getEmailPreferences`, `updateEmailPreferences`).
    - UI (Mi cuenta): `frontend/src/pages/MyAccount/MyAccount.tsx` (panel “Preferencias de email”).
