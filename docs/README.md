# Documentación Bear Beat

## 1) Punto de entrada recomendado

- **[WORKFLOW_BRANCHES_RELEASES.md](./WORKFLOW_BRANCHES_RELEASES.md)**: estrategia actual de ramas, releases, deploy y limpieza operativa.
- **[branch-audit.md](./branch-audit.md)**: snapshot de ramas local/remoto actualizado (hoy).

## 2) Estado funcional y técnico del producto

- **[DISENO-Y-ESTADO-ACTUAL.md](./DISENO-Y-ESTADO-ACTUAL.md)**: sistema de diseño, rutas, páginas, modales y archivos clave.
- **[DOCUMENTACION_CAMBIOS.md](./DOCUMENTACION_CAMBIOS.md)**: resumen amplio de cambios implementados (frontend/backend/deploy).
- **[CAMBIOS-UX-MOBILE-APP-NATIVA-Y-DEPLOY.md](./CAMBIOS-UX-MOBILE-APP-NATIVA-Y-DEPLOY.md)**: guía recomendada para continuidad de UX/UI y deploy.

## 3) Operación y runbooks

- **[STAGING_LOCAL.md](./STAGING_LOCAL.md)**: entorno local reproducible (frontend + backend + MySQL + Redis) sin tocar producción.
- **[OPERACION_DOWNLOAD_HISTORY_ESCALABILIDAD.md](./OPERACION_DOWNLOAD_HISTORY_ESCALABILIDAD.md)**: runbook de escalabilidad para `download_history`.
- **[LOGICA-ENVIO-EMAILS.md](./LOGICA-ENVIO-EMAILS.md)**: mapa de automatizaciones de correo por flujo.
- **[email_automations_spec.md](./email_automations_spec.md)**: especificación de modos/envíos de email por entorno.

## 4) Integraciones y tracking

- **[FACEBOOK_META.md](./FACEBOOK_META.md)**: configuración de Meta Pixel + Conversions API.
- **[MANYCHAT_HANDOFF.md](./MANYCHAT_HANDOFF.md)** y **[MANYCHAT_ETIQUETAS.md](./MANYCHAT_ETIQUETAS.md)**: handoff y operación de tags/eventos.
- **[MANUAL_TRACKING_MANYCHAT.md](./MANUAL_TRACKING_MANYCHAT.md)**: guía manual de verificación de tracking ManyChat.

## 5) QA, auditoría y evidencia

- Carpeta **`docs/audit/`**: resultados de auditorías UX/UI, accesibilidad, Lighthouse e inventarios.
- **[qa-fullsite.md](./qa-fullsite.md)** y **[home-qa.md](./home-qa.md)**: checklist de pruebas manuales.
- **[REPORTE-UX-UI-PRODUCCION-THEBEARBEAT.md](./REPORTE-UX-UI-PRODUCCION-THEBEARBEAT.md)** y **[REPORTE-UX-UI-RUTAS.md](./REPORTE-UX-UI-RUTAS.md)**: reportes de hallazgos y cobertura.
