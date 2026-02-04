# Documentación de cambios – Bear Beat

Resumen de todo lo implementado en el proyecto (diseño, landing, deploy, correcciones) para referencia futura.

---

## 1. Resumen ejecutivo

- **Landing y home público:** nueva landing con enfoque neuroventas, estética futurista/DJ y home público para no logueados.
- **Sistema de diseño:** estilos unificados (glassmorphism, Bear Blue) en todas las páginas y modales.
- **Facebook Pixel:** util centralizado y eventos estándar/custom; inicialización por variable de entorno.
- **Responsive:** breakpoints y ajustes en todas las vistas para móvil.
- **Experiencia móvil (mobile-first):** estilos tipo app nativa (inputs 16px, botones min-height 48px), tablas Admin en cards en móvil, scroll corregido (padding-bottom en layout y PublicHome).
- **Sistema de temas:** modo claro (por defecto), oscuro, según sistema y por horario; selector en Navbar; variables CSS en `_variables-theme.scss`; preferencia guardada en `localStorage`.
- **Admin – Catálogo:** página de estadísticas del catálogo (videos, audios, karaokes, géneros, GB, archivos) en `/admin/catalogo`; endpoint REST `GET /api/catalog-stats` (JWT) en backend; acceso con usuario logueado.
- **Deploy Netlify:** configuración para monorepo y corrección del 404 (redirects SPA).
- **Deploy backend:** GitHub Actions + SSH ejecutan `deploy.sh` en el servidor (build, PM2 blue/green, nginx); compatibilidad sed BSD en el script.
- **Rutas:** raíz `/` muestra landing o home según sesión; rutas protegidas con `AuthRoute`; Admin incluye ruta `catalogo`.

Ningún cambio afecta la lógica de negocio, pagos o auth; solo UI, contenido, temas, estadísticas de solo lectura y configuración de build/deploy.

---

## 2. Landing y contenido (neuroventas)

### Archivos principales
- `frontend/src/pages/Landing/` – componentes y estilos de la landing.
- `frontend/src/pages/PublicHome/` – vista “home” para usuarios no logueados (landing mejorada).
- `frontend/src/utils/Constants.ts` – textos de planes y mensajes (organización por géneros, exclusivo para DJs).

### Diseño
- **Estética:** glassmorphism, gradientes sutiles, Bear Blue (`#08E1F7`), fondos oscuros.
- **Iconos:** Phosphor Icons (`react-icons/pi`) en lugar de FontAwesome en la landing.
- **Bento Grid:** sección “Lo que pierdes si sigues sin Bear Beat” con tarjetas interactivas.
- **Hero:** título centrado en el dolor del DJ (“Nunca más digás 'no lo tengo'”), descarga masiva, música exclusiva, organización por géneros.
- **CTAs:** botones con glow exterior Bear Blue; mensajes persuasivos (valor, urgencia, pérdida).

### Mensajes clave repetidos en la app
- Música y videos **exclusivos para DJs**.
- Todo **organizado por géneros**.
- **Descarga masiva** (FTP: FileZilla o Air Explorer).
- Estos mensajes aparecen en: Landing, PublicHome, Auth, Instructions, Constants (planes), etc.

---

## 3. Home público vs Home logueado

### Lógica
- **Ruta raíz `/`:** renderiza `HomeOrLanding` (sin `AuthRoute`).
- **Sin sesión:** se muestra `PublicHome` (landing/home público).
- **Con sesión:** se muestra `Home` (explorador de archivos / app principal).

### Archivos
- `frontend/src/functions/HomeOrLanding.tsx` – elige entre `PublicHome` y `Home` según token.
- `frontend/src/index.tsx` – ruta `path: "/"` con `element: <HomeOrLanding />` dentro de `MainLayout`; el resto de rutas protegidas envueltas en `AuthRoute`.

### MainLayout y landing a ancho completo
- En `MainLayout`: cuando no hay token y `pathname === "/"`, el contenedor principal usa fondo negro y el contenido de la landing no tiene padding/max-width extra (full-bleed).
- La landing usa `margin-left: calc(-50vw + 50%)` y ancho completo para no quedar enmarcada por el layout.

---

## 4. Sistema de diseño unificado

### Archivo base
- `frontend/src/styles/landing-design.scss` – variables y clases reutilizables.

### Variables
- `$bear-blue`, `$card-glass`, `$bg-dark`, etc.
- Clases: `.landing-layout`, `.landing-card`, `.landing-title`, `.landing-btn-primary`, inputs y tablas coherentes.

### Dónde se aplica
- Layouts: MainLayout, Navbar, AsideNavbar.
- Páginas: Auth, PublicHome, Home, Instructions, MyAccount, Downloads, Plans, Checkout, PlanUpgrade, Admin y subpáginas (usuarios, planes, almacenamiento, cupones, órdenes, historiales, dominios/teléfonos bloqueados).
- Componentes: PlanCard, Pagination.
- Modales: Modal, ErrorModal, SuccessModal, etc. (glassmorphism, botones con glow, colores unificados).

Se importa `_landing-design.scss` o `landing-design.scss` donde haga falta para que los estilos estén disponibles.

---

## 5. Meta (Facebook) Pixel y Conversions API (CAPI)

### Frontend – Pixel (navegador)
- **Archivo:** `frontend/src/utils/facebookPixel.ts`.
- **Funciones:** `initFacebookPixel()`, `trackStandardEvent()`, `trackCustomEvent()`, `trackPurchase()`, `trackLead()`, `trackViewPlans()`.
- El pixel **solo se inicializa** si existe `REACT_APP_FB_PIXEL_ID`; no hay ID hardcodeado en código.
- En componentes se usan estas funciones (no `fbq` directo): PlanCard, CheckoutForm, SignUpForm.
- Eventos estándar usados: `Purchase`, `Lead`, `CompleteRegistration`, `PageView`; además eventos custom `UsuarioRevisoPlanes`, `PagoExitoso`, `BearBeatRegistro`.

### Backend – Conversions API (servidor)
- **Archivo:** `backend/src/facebook/index.ts`.
- Envía eventos al Conversions API de Meta con **nombres estándar**: `CompleteRegistration` (registro) y `Purchase` (compra).
- Para `Purchase` se envían `value` y `currency` (requeridos por Meta).
- Si no están definidos `FACEBOOK_ACCESS_TOKEN` o `FACEBOOK_PIXEL_ID`, no se envía nada (solo log de aviso).

### Variables de entorno

| Dónde     | Variable                 | Descripción |
|----------|---------------------------|-------------|
| Frontend | `REACT_APP_FB_PIXEL_ID`   | ID del pixel de Meta (ej. desde Meta Business Suite → Configuración de datos → Pixels). Debe coincidir con el ID en el `<noscript>` de `frontend/public/index.html` para usuarios sin JS. |
| Backend  | `FACEBOOK_PIXEL_ID`       | Mismo ID del pixel (mismo valor que en frontend). |
| Backend  | `FACEBOOK_ACCESS_TOKEN`   | Token de acceso del pixel para CAPI. En Meta: Business Suite → Configuración de datos → Pixels → Tu pixel → Configuración → Conversions API → “Generar token de acceso”. Usar un token que no expire o renovarlo cuando caduque. |

### Resumen de eventos
- **Registro:** frontend dispara `Lead` + `CompleteRegistration` (y custom `BearBeatRegistro`); backend envía CAPI `CompleteRegistration`.
- **Pago (Stripe/PayPal):** frontend dispara `Purchase` (y custom `PagoExitoso`); backend envía CAPI `Purchase` con `value` y `currency`.
- **Ver planes:** frontend dispara custom `UsuarioRevisoPlanes`.

---

## 6. Responsive

### Breakpoints (mixin)
- En `frontend/src/styles/` (p. ej. `mixin.scss`): `phone` (max-width 576px), `tablet` (max-width 768px).

### Ajustes
- Todas las páginas, layouts, modales y componentes principales con `@media` para móvil: tamaños de fuente, padding, flex-direction, ocultar elementos secundarios, tablas con `overflow-x: auto`.
- `viewport-fit=cover` en el meta viewport de `frontend/public/index.html` para mejor comportamiento en móvil.

---

## 7. Netlify y corrección del 404

### Problema
- En `https://thebearbeat.com` (y rutas como `/`, `/planes`) aparecía “Page not found” de Netlify.
- Causas: en monorepo sin config, Netlify no construía/publicaba el frontend; además, con `base` y `publish` personalizados, los redirects definidos en la raíz del repo no se aplican correctamente al directorio publicado.

### Solución

**`netlify.toml` (en la raíz del repo):**
```toml
[build]
  base = "frontend"
  command = "npm run build"
  publish = "build"
```
- No se usan `[[redirects]]` en este archivo: con `base` + `publish`, Netlify aplica bien los redirects solo desde el directorio publicado (el `build/`), no desde la raíz. Poner redirects aquí hacía que `/index.html` se resolviera en el contexto equivocado y seguía el 404.

**`frontend/public/_redirects`:**
```
/* /index.html 200
```
- Este archivo se copia a `frontend/build/` en cada build (Create React App copia todo `public/` a `build/`).
- Netlify lee `_redirects` desde el directorio publicado y sirve `index.html` para cualquier ruta sin archivo físico (SPA), con status 200 (rewrite, no redirect).

### Resumen
- Build y publicación: `netlify.toml` con `base`, `command` y `publish`.
- Redirects SPA: solo `_redirects` dentro de `frontend/public` (y por tanto en `build/`).

---

## 8. Rutas y autenticación

### Estructura (index.tsx, createBrowserRouter)
- `/` → `HomeOrLanding` (público).
- `/instrucciones`, `/micuenta`, `/descargas`, `/planes`, `/comprar`, `/actualizar-planes` → con `AuthRoute` (requieren sesión).
- `/admin/*` → con `AuthRoute`; hijos: usuarios, planesAdmin, almacenamiento, historial-descargas, cupones, ordenes, historialCheckout, dominios-bloqueados, telefonos-bloqueados.
- `/auth` → login, registro, forgot password, reset password (según subruta).

### AuthRoute
- Envuelve rutas que requieren usuario logueado; si no hay token, redirige a login o a la vista pública según corresponda.

---

## 9. Experiencia móvil (mobile-first / app-like)

### Objetivo
- Que la app se sienta como una app nativa en móvil: botones y áreas táctiles grandes, fuentes legibles, sin cortes de scroll.

### Archivos principales
- `frontend/src/styles/_mobile-app.scss` – estilos globales móvil: `font-size: 16px` en inputs (evita zoom en iOS), `min-height: 48px` en botones, espaciados y contraste.
- `frontend/src/styles/_admin-tables-mobile.scss` – en pantallas pequeñas las tablas del Admin se muestran como cards; cada celda usa `data-label` para mostrar el nombre del campo.

### Dónde se aplica
- Layout: `MainLayout.scss` (padding-bottom para que el contenido no quede cortado al final).
- Páginas: Home, PublicHome, Auth, Instructions, MyAccount, Plans, Downloads, Checkout, PlanUpgrade, Admin y subpáginas (tamaños de fuente, padding, botones).
- Navbar: tamaño de fuente y botón hamburguesa más grandes en móvil.
- Redirects SPA: `frontend/public/_redirects` evita 404 en rutas directas en móvil.

### Scroll
- Se ajustó `padding-bottom` en `MainLayout` y en `PublicHome` para que el contenido no quede cortado al hacer scroll hasta abajo.

---

## 10. Sistema de temas (claro / oscuro / sistema / horario)

### Objetivo
- Permitir elegir entre tema claro (por defecto), oscuro, según sistema o por horario; sin flash al cargar.

### Archivos principales
- `frontend/src/contexts/ThemeContext.tsx` – `ThemeProvider` y `useTheme()`; modos: `light`, `dark`, `system`, `schedule`; persistencia en `localStorage`.
- `frontend/src/styles/_variables-theme.scss` – variables CSS (`--theme-bg`, `--theme-text`, `--theme-nav-border-bottom`, etc.) para modo claro y oscuro; modo claro con más “vida” (gradiente sutil, sombras, acentos, `--theme-ink` / `--theme-heading` para títulos).
- `frontend/public/index.html` – script inline que aplica el tema desde `localStorage` antes de que cargue React (evita flash).

### UI
- En la Navbar hay un botón de tema (sol/luna) que abre un menú: Claro, Oscuro, Según sistema, Por horario.
- Los estilos de layout, nav, cards, Home, Admin, landing, etc. usan las variables de `_variables-theme.scss` para respetar el tema elegido.

### Por horario
- Si el usuario elige “Por horario”, la app usa tema claro u oscuro según la hora (configurable en `ThemeContext`).

---

## 11. Admin – Estadísticas del catálogo

### Objetivo
- Mostrar estadísticas de solo lectura del catálogo de archivos (videos, audios, karaokes, géneros, GB, total de archivos).

### Backend
- **Endpoint REST (usado por el frontend):** `GET /api/catalog-stats` con header `Authorization: Bearer <token>`. Responde JSON con las estadísticas.
- **Archivo del endpoint:** `backend/src/endpoints/catalog-stats.endpoint.ts` (registrado en `backend/src/index.ts`).
- **Lógica compartida:** `backend/src/routers/file-actions/catalog-stats.ts` exporta `getCatalogStats()`; el endpoint REST y el procedimiento tRPC `ftp.catalogStats` usan esta función. La UI usa REST para no depender del router tRPC en producción.
- **Lógica:** recorre recursivamente el directorio configurado en `SONGS_PATH` (vía `fileService.list`), cuenta por tipo de extensión (video, audio), detecta “karaoke” en la ruta, suma tamaños y lista directorios de primer nivel como “géneros”.
- **Permisos:** el endpoint verifica JWT (usuario logueado). El procedimiento tRPC está en `isLoggedIn` en `backend/src/permissions/index.ts`.
- **Seguridad:** solo lectura; en caso de error devuelve respuesta segura (sin exponer rutas internas).

### Frontend
- **Ruta:** `/admin/catalogo`.
- **Componente:** `frontend/src/pages/Admin/CatalogStats/CatalogStats.tsx` (y `CatalogStats.scss`).
- **Comportamiento:** llama a `GET /api/catalog-stats` con el token en `Authorization`, muestra loading, números por tipo (videos, audios, karaokes, otros), géneros, GB y total de archivos; si falla, muestra el mensaje de error del backend (p. ej. “SONGS_PATH no configurado”).

### Sidebar Admin
- En `AsideNavbar` hay un enlace “Catálogo” (icono `faChartBar`) dentro de la sección Admin que lleva a `/admin/catalogo`.

### Variable de entorno (backend)
- `SONGS_PATH` – ruta en el servidor donde está el catálogo de canciones/archivos. Si no está configurada, el endpoint/procedimiento devuelve error controlado.

---

## 12. Deploy del backend (GitHub Actions, PM2, nginx)

### Objetivo
- Desplegar el backend en un servidor propio (VPS) al hacer push a `main`: build, reinicio del proceso y actualización del proxy nginx.

### Flujo
1. **GitHub Actions:** al hacer push a `main` se ejecuta el workflow `.github/workflows/backend-deploy.yml`.
2. **SSH:** la acción `appleboy/ssh-action` se conecta al servidor y ejecuta `cd bear-beat && bash ./deploy.sh`.
3. **deploy.sh:** hace `git reset --hard` + `git pull`, build del backend (`npm run build`), actualiza `PORT` en `.env`, reinicia el proceso PM2 correspondiente (blue o green) y actualiza `proxy_pass` en nginx para apuntar al puerto nuevo.

### Blue/green
- Dos procesos PM2: `bearbeat-blue` (puerto 5000) y `bearbeat-green` (puerto 6000). Nginx apunta a uno; cada deploy cambia al otro (5000↔6000) para cero-downtime.

### Archivos
- **Workflow:** `.github/workflows/backend-deploy.yml` – secretos: host, username, key SSH.
- **Script en servidor:** `deploy.sh` (en el repo, se actualiza con `git pull`). Requiere: git, npm, pm2, nginx, systemctl. La ruta de nginx se define en `NGINX_CONF` dentro del script.
- **Compatibilidad sed:** el servidor puede usar BSD sed (p. ej. macOS); en `deploy.sh` la actualización de `proxy_pass` usa dos `sed` separados (localhost y 127.0.0.1) con delimitador `#` para evitar errores con el carácter `|`.

### Cómo comprobar que el deploy funcionó
- En GitHub: pestaña **Actions** → último run de "Deploy backend" en verde (✓).
- En terminal: `gh run list --limit 1` debe mostrar `success` en la primera fila.

---

## 13. Archivos clave de referencia

| Qué | Dónde |
|-----|--------|
| Rutas y layout | `frontend/src/index.tsx` |
| Home público vs app | `frontend/src/functions/HomeOrLanding.tsx` |
| Landing | `frontend/src/pages/Landing/`, `frontend/src/pages/PublicHome/` |
| Estilos globales landing | `frontend/src/styles/landing-design.scss` |
| Estilos móvil app-like | `frontend/src/styles/_mobile-app.scss`, `_admin-tables-mobile.scss` |
| Variables de tema (claro/oscuro) | `frontend/src/styles/_variables-theme.scss` |
| Contexto de tema | `frontend/src/contexts/ThemeContext.tsx` |
| Facebook Pixel | `frontend/src/utils/facebookPixel.ts` |
| Build/deploy Netlify | `netlify.toml` (raíz), `frontend/public/_redirects` |
| Textos y planes | `frontend/src/utils/Constants.ts` |
| MainLayout (fondo/padding landing) | `frontend/src/layouts/MainLayout/` |
| Estadísticas catálogo (lógica + tRPC) | `backend/src/routers/file-actions/catalog-stats.ts` |
| Endpoint REST catálogo | `backend/src/endpoints/catalog-stats.endpoint.ts` |
| Permisos (incl. catalogStats) | `backend/src/permissions/index.ts` |
| Página Admin Catálogo | `frontend/src/pages/Admin/CatalogStats/` |
| Deploy backend (workflow + script) | `.github/workflows/backend-deploy.yml`, `deploy.sh` |

---

## 14. Cómo seguir trabajando

- **Local:** el código está en tu PC en la carpeta del proyecto; los pushes que hicimos dejaron `main` alineado con GitHub.
- **Deploy frontend (Netlify):** Netlify construye desde GitHub (rama `main`); al hacer push, se genera un nuevo deploy. No hace falta tocar redirects en el dashboard si `_redirects` y `netlify.toml` siguen así.
- **Deploy backend:** al hacer push a `main` se dispara el workflow de GitHub Actions que ejecuta `deploy.sh` en el servidor vía SSH. Comprobar en Actions que el run sea verde; o en terminal: `gh run list --limit 1`.
- **Tema:** la preferencia se guarda en `localStorage`; el script en `index.html` evita flash. Si añades páginas nuevas, usa las variables de `_variables-theme.scss`.
- **Catálogo:** si la página de estadísticas falla, revisar que `SONGS_PATH` esté configurado en el backend y que el usuario esté logueado. La UI usa `GET /api/catalog-stats` con JWT.
- **Si vuelve el 404 (frontend):** revisar que el último deploy en Netlify sea “Published” y que el build no falle (si falla, no se genera `build/` ni `_redirects`). No añadir `[[redirects]]` para SPA en `netlify.toml`; mantener solo `_redirects` en `frontend/public`.

Documentación actualizada: landing, diseño, responsive, móvil, temas, catálogo (REST), Netlify, deploy backend. Cualquier desarrollador puede seguir este doc para entender qué se hizo; conviene actualizarlo cuando se añadan cambios relevantes.
