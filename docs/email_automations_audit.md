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

## Automatizaciones Existentes (Marketing)

- Runner de automatizaciones (tick periódico): `EXISTE`
  - Evidencia:
    - `backend/src/automationRunner.ts`
    - `backend/src/automation/runner.ts` (reglas: trial/paid no download, registered no purchase, checkout abandoned, winback lapsed, etc.)
    - Dedupe/idempotencia: `backend/prisma/schema.prisma` (`automation_action_logs` con unique `user_id+action_key+stage`)

## Dunning (Pagos Fallidos)

- Secuencia D0/D1/D3/D7/D14 por email: `NO EXISTE`
  - Evidencia:
    - No hay `action_key`/jobs dedicados a dunning en `backend/src/automation/runner.ts`.
    - No hay templates de “pago fallido / actualiza tu pago” en `backend/src/email/templates.ts` orientados a dunning.

- Señales/analytics de “payment_failed”: `PARCIAL`
  - Evidencia:
    - Stripe: `backend/src/routers/webhooks/stripe/index.ts` ingiere eventos internos `payment_failed` (analytics), pero no dispara emails.
    - PayPal: `backend/src/routers/webhooks/paypal/index.ts` ingiere eventos internos `payment_failed` (analytics), pero no dispara emails.
    - Conekta: `backend/src/routers/webhooks/conekta/index.ts` ingiere eventos internos `payment_failed` (analytics), pero no dispara emails.

## Cancelación + Fin de Acceso

- Email de confirmación de cancelación (transaccional): `NO EXISTE`
  - Evidencia:
    - La cancelación actual existe a nivel de acceso/DB: `backend/src/routers/subscriptions/services/cancelSubscription.ts`.
    - No hay envío de email asociado a cancelación en ese flujo.

- Recordatorio 3 días antes de fin de acceso: `NO EXISTE`
  - Evidencia:
    - No hay job/scheduler que evalúe `date_end` (fin de acceso) para notificar.

- Email al terminar acceso (opcional): `NO EXISTE`
  - Evidencia:
    - No hay job/scheduler ni template asociado.

## Winback (Recuperación)

- Winback por email (7/30/60): `PARCIAL`
  - Evidencia:
    - Existe un flujo de winback “lapsed” en runner: `backend/src/automation/runner.ts` (regla `winback_lapsed`).
    - Existe un script de campaña (segmentos `lapsed`/`never_paid`): `backend/scripts/campaignWinback.ts`.
  - Gaps:
    - Cadencias 7/30/60 no están formalizadas como secuencia completa con jobs/ventanas.
    - Falta enforcement explícito de preferencias por categoría (solo existe `email_marketing_opt_in` global).

## Preferencias (Transaccional vs Marketing)

- Unsubscribe marketing: `EXISTE`
  - Evidencia:
    - Firma/verificación: `backend/src/comms/unsubscribe.ts`
    - Endpoint público: `backend/src/endpoints/comms-unsubscribe.endpoint.ts` (`GET /api/comms/unsubscribe`), setea `users.email_marketing_opt_in=false`.

- Centro de preferencias (categorías): `NO EXISTE`
  - Evidencia:
    - Solo existe `users.email_marketing_opt_in` (global) en `backend/prisma/schema.prisma`.
    - No hay UI/ruta para categorías (novedades/ofertas/digest) ni tabla/campos dedicados.

