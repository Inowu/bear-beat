# Security Policy

## Supported Branch

- Rama soportada para parches de seguridad: `main`.

## Reportar una vulnerabilidad

No abras issues públicos para vulnerabilidades.

1. Reporta de forma privada al equipo mantenedor del repositorio.
2. Incluye:
   - impacto esperado,
   - pasos para reproducir,
   - evidencia mínima (sin PII ni secretos),
   - posible mitigación.

## Tiempos objetivo

- Confirmación de recepción: hasta 72 horas.
- Evaluación inicial y severidad: hasta 7 días.
- Plan de remediación: según criticidad e impacto en producción.

## Reglas de manejo de datos sensibles

- Prohibido exponer en logs:
  - PII (email, teléfono, dirección, IP),
  - datos de pago (payloads completos de Stripe/PayPal/Conekta, `last4`, tokens, IDs vinculados a persona).
- No commitear secretos, llaves ni credenciales.

## Validaciones de seguridad automáticas

- CI principal: `.github/workflows/ci.yml`
- Escaneo de secretos: `.github/workflows/gitleaks.yml`

Nota: `gitleaks` está configurado para escanear árbol de trabajo (`--no-git`) por histórico legacy.  
Cualquier limpieza de historial debe planearse aparte para no bloquear entregas.
