# Contributing

Guía breve para contribuir al repo sin romper flujos de producción.

## 1) Pre-requisitos

- Node `24.x` (usar `.nvmrc` en raíz/backend/frontend).
- Docker Desktop.
- npm.

## 2) Setup local

1. Instalar dependencias:
   - `npm install`
2. Levantar backend DB local:
   - `cd backend && docker compose up -d db`
3. Aplicar migraciones:
   - `cd backend && npx prisma migrate deploy`
4. Correr proyecto completo:
   - `npm run start`

Referencia detallada:

- `README.md`
- `docs/STAGING_LOCAL.md`

## 3) Flujo de ramas

1. Partir de `main` actualizado.
2. Crear rama corta y enfocada:
   - `codex/<scope-corto>`
   - `fix/<scope-corto>`
   - `feat/<scope-corto>`
3. Mantener cambios pequeños (si crece, dividir en varios PRs).

## 4) Validaciones mínimas antes de PR

Ejecutar y documentar resultados:

1. `npm run test:local`
2. `npm test --workspace=frontend`

Si tocaste build/deploy/configuración crítica, agregar también:

1. `npm run build --workspace=backend`
2. `npm run build`

## 5) Requisitos obligatorios de PR

- Describir el objetivo del cambio.
- Listar cambios propuestos.
- Incluir evidencia de pruebas (comandos + resultado).
- Anotar impactos de migraciones, variables de entorno o contratos API.

## 6) Reglas de seguridad y compliance

- No loguear PII: email, teléfono, dirección, IP.
- No loguear payloads de pago ni identificadores sensibles:
  - Stripe/PayPal/Conekta payloads completos.
  - `last4`, tokens, IDs ligados a una persona.
- Mantener secretos solo en `.env` local o secretos del proveedor CI/CD.

## 7) Si cambias arquitectura o flujo de release

Actualizar en el mismo PR:

- `docs/WORKFLOW_BRANCHES_RELEASES.md`
- `docs/branch-audit.md` (si cambia el estado de ramas)
- `docs/README.md` (si agregas/mueves documentación)
