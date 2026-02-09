# Home QA Checklist (PublicHome)

Scope: Solo la landing pública (`/`) cuando NO hay sesión. Estética dark/neón.

## Smoke (Desktop + Mobile)
1. Abrir `https://thebearbeat.com/` (o local).
2. En 5 segundos se entiende:
   - Qué es: membresía para DJs con catálogo + descargas organizadas.
   - Cómo funciona: eliges del catálogo total y descargas con cuota mensual.
   - Qué hacer ahora: CTA principal claro.
3. Verificar que NO existe texto ambiguo tipo “Acceso Total” sin aclarar la cuota.
4. Verificar que el CTA principal siempre dice exactamente:
   - Si trial está habilitado: `Empezar prueba (7 días)` (o el número real de días según backend).
   - Si trial NO está habilitado: `Activar acceso`.
5. Verificar que el CTA secundario (demo catálogo) siempre dice: `Ver los 200 géneros al activar`.
6. Funnel post‑CTA (sin ambigüedad):
   - Usuario SIN cuenta: CTA primario lleva a `/auth/registro` (crear cuenta) y al completar debe volver a `/planes`.
   - Usuario CON cuenta: link “Ya tengo cuenta” lleva a `/auth` (login) y al completar debe volver a `/` (app) o a `from`.

## Responsivo / Legibilidad
1. Mobile (390x844):
   - El hero se ve claro y legible (título, subheadline, 3 bullets, CTA).
   - Texto secundario y FAQ se leen sin esfuerzo (tamaño/contraste).
   - Links del topnav no se empalman.
2. Desktop (1280x800):
   - Jerarquía clara, sin look de “dashboard”.
   - Cards con buena densidad; CTA principal destaca.

## Performance / UX
1. No hay spinners infinitos.
2. Si falla data del catálogo o top descargas:
   - No se muestran ceros que parezcan bug.
   - Hay fallback elegante (demo por ejemplo, mensaje honesto).
3. No hay layout shifts feos cuando cargan datos.

## Accesibilidad (rápido)
1. Navegación con teclado:
   - Tab llega al CTA principal y a FAQ.
   - Enfoque visible (`:focus-visible`) en links/botones/summary.
2. FAQ:
   - `details/summary` abre/cierra correctamente.
3. Modal “Ver demo”:
   - Se puede abrir/cerrar con teclado.
   - Tiene título accesible.

## Analytics (eventos requeridos)
Abrir DevTools Console y ejecutar:
1. `window.__bbGrowthQueue` debe existir y crecer con eventos.
2. Recargar home:
   - Debe aparecer `home_view`.
3. Click en “Ver demo”:
   - Debe aparecer `view_demo_click` con `metadata.location = \"hero\"`.
4. Click en CTA principal (hero, steps, pricing, footer):
   - Debe aparecer `cta_primary_click` con `metadata.location` correcto:
     - `hero`, `mid`, `pricing`, `footer`.
5. Click en CTA secundario (Catalog Demo):
   - Debe aparecer `cta_secondary_click` con `metadata.location = \"catalog_demo\"`.
6. Scroll hasta Pricing:
   - Debe aparecer `pricing_view` una sola vez.
7. Expandir un FAQ:
   - Debe aparecer `faq_expand` con `metadata.question = <id>`.

## Regresión (no romper flujo)
1. Links funcionan:
   - `/planes`
   - `/auth` (login)
   - `/auth/registro` (registro)
   - `/legal` (FAQ y políticas)
   - `/instrucciones`
2. No hay errores en consola al cargar `/`.
