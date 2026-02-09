# Bear Beat: UI/UX/CRO Audit (Automated + Manual)

Generado: 2026-02-09

Este documento es la fuente de verdad para mejoras de UX/UI/CRO y accesibilidad. Incluye:

- Hallazgos automáticos (rutas + inventario de UI + a11y con axe).
- Hallazgos manuales priorizados (P0/P1/P2) por ruta y por componente.
- Cambios implementados (quick wins) y siguientes pasos.

## 1) Stack / Arquitectura (FASE 0)

- Frontend: React (CRA) + React Router (`frontend/src/index.tsx`)
- Estilos: SCSS + Bootstrap + Tailwind bridge (tokens en `frontend/src/styles/index.scss`, base en `frontend/src/index.css`)
- UI libs: react-bootstrap (Modal), lucide-react (iconos)
- Backend: Node/Express + tRPC + Prisma (MySQL)
- Observabilidad/UX: Sentry (FE/BE), Contentsquare UXA tag (Hotjar 2026)

## 2) Inventario Automático (FASE 1)

Artifacts generados en el repo:

- Reportes (tracked): `docs/audit/route-map.json`, `docs/audit/ui-inventory.json`, `docs/audit/a11y-report.md`, `docs/audit/error-copy-catalog.json`, `docs/audit/cro-findings.md`
- Screenshots (opcional): `audit/screenshots/*--desktop.png` y `audit/screenshots/*--mobile.png`

Resumen (última corrida):

- Rutas auditadas: 46
- Axe violations: 0 (ojo: esto no prueba toda WCAG; valida reglas axe)
- Console/network failures: 0 en entorno local auditado (con seed)

## 3) Issues Priorizados (FASE 2)

### P0 (bloquea conversión o rompe confianza)

1. **Registro: fricción innecesaria por campos obligatorios**
   - Problema: WhatsApp/teléfono obligatorio reduce conversión (especialmente US) y agrega fricción.
   - Fix implementado:
     - Teléfono/WhatsApp pasa a **opcional** (FE + BE).
     - Username pasa a **opcional**; si no se provee, se genera uno desde email.
   - Archivos:
     - `frontend/src/components/Auth/SignUpForm/SignUpForm.tsx`
     - `backend/src/routers/auth/procedures/register.ts`

2. **Registro: Captcha/Turnstile visible y bloqueante**
   - Problema: widget visible baja completación; además en algunos entornos provoca errores/ruido.
   - Fix implementado:
     - Turnstile se ejecuta en modo **invisible** (execution=execute) solo al submit.
     - Si falla, mensaje accionable y sin “romper” el form.
   - Archivos:
     - `frontend/src/components/Auth/SignUpForm/SignUpForm.tsx`
     - `frontend/src/components/Turnstile/Turnstile.tsx` (ya soportaba `invisible`)

3. **ManyChat: fallas deben ser non-blocking**
   - Problema: un fallo de ManyChat no debe impedir registro.
   - Fix implementado:
     - `manyChat.addTagToUser` envuelto en try/catch (warn + continúa).
   - Archivo:
     - `backend/src/routers/auth/procedures/register.ts`

### P1 (mejora fuerte de claridad/consistencia)

1. **Estandarización de formato de fechas y tamaños**
   - Estado: en progreso (ya hay `formatDateShort` y `formatBytes` y se aplicó en HOME/Library/MyAccount/Admin).
   - Próximo: migrar usos restantes de `toDateString()`, `.toFixed()` y bytes manuales.
   - Archivos base:
     - `frontend/src/utils/format.ts`

2. **Consistencia de empty/loading/error states**
   - Estado: ya existe `app-state-panel` global en `frontend/src/styles/index.scss`.
   - Próximo: reemplazar estados custom que no usen `app-state-panel` en rutas admin y checkout.

### P2 (calidad premium / deuda técnica)

1. Consolidar componentes UI duplicados (botones, inputs, modales).
2. Reducir warnings de ESLint (hooks deps) en rutas críticas (Checkout/Home/Admin) sin cambiar comportamiento.
3. Mejorar SEO por ruta pública (títulos/description consistentes) y schema.org (opcional).

## 4) Cambios Implementados (Quick Wins)

Además de lo anterior, ya estaban aplicados previamente:

- Home: clamp/overflow + metadata consistente en “Lo que más se descarga”
- Home: sticky CTA móvil correcto
- Home: trial vs métodos de pago alineado (prueba solo tarjeta)
- Auth: labels visibles en login/recuperación
- Mi Cuenta: “Cuota mensual / usado este ciclo” + fechas es-MX
- Biblioteca: formatBytes consistente (GB/TB)
- Admin Usuarios: “Por página: 25” + fechas es-MX

## 5) Checklist de Accesibilidad (guía interna)

- Todos los icon-buttons deben tener `aria-label` (audit automatizado ya lo valida).
- Focus visible: `:focus-visible` global y por componentes.
- Form labels: visibles, no depender de placeholder.
- Inputs: `autoComplete` correcto (`email`, `current-password`, `new-password`, `tel`).
- Targets táctiles: 44px mínimo.

## 6) Cómo validar (rápido)

1. Generar artifacts:
   - `AUDIT_BASE_URL=http://localhost:3000 AUDIT_API_BASE_URL=http://localhost:5001 AUDIT_LOGIN_EMAIL=... AUDIT_LOGIN_PASSWORD=... npm run audit:fullsite --workspace=backend`
2. Smoke e2e:
   - `npm run e2e:smoke --workspace=backend`
3. FE build + tests:
   - `npm run build`
   - `CI=true npm test --workspace=frontend -- --watchAll=false`
4. BE tests:
   - `npm test --workspace=backend`
