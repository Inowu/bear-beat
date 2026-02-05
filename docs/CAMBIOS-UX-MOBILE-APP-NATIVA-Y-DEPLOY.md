# Documentación: UX/UI, app nativa móvil y deploy a producción

Este documento describe **todos los cambios** realizados para: (1) auditoría y mejora de UX/UI en todas las secciones, (2) sensación de **app móvil nativa** en toda la app, y (3) proceso de **deploy a producción** en Netlify. Cualquier desarrollador puede usarlo para entender el estado actual y mantener consistencia.

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Estilos globales y variables](#2-estilos-globales-y-variables)
3. [Experiencia móvil tipo app nativa](#3-experiencia-móvil-tipo-app-nativa)
4. [Secciones auditadas (UX/UI)](#4-secciones-auditadas-uxui)
5. [Modales y formularios](#5-modales-y-formularios)
6. [Deploy a producción (Netlify)](#6-deploy-a-producción-netlify)
7. [Archivos modificados (referencia rápida)](#7-archivos-modificados-referencia-rápida)

---

## 1. Resumen ejecutivo

| Objetivo | Qué se hizo |
|----------|-------------|
| **UX/UI consistente** | Tipografía unificada (Poppins, variables `--app-font-size-*`), colores por tema (`--app-*`, `--theme-*`), controles con área táctil mínima 44–48px en todas las secciones. |
| **App nativa móvil** | Viewport `100dvh`, safe areas (notch, barra de gestos), scroll suave, feedback táctil (`:active`), modales tipo bottom sheet en móvil, contenedores tipo “pantalla” (`.app-screen`). |
| **Mensajes de error** | Clase global `.error-formik` unificada; mensajes en modales con flujo correcto (no solapados). |
| **Spinners** | Color unificado a `var(--app-accent)`. |
| **Deploy** | Netlify con `netlify.toml` en raíz; deploy manual con `--filter=thebearbeat` por tener dos sitios en el repo. |

**Secciones afectadas:** Home, Instrucciones, Mi cuenta, Descargas, Planes, Checkout, Actualizar planes, Auth (Login, Registro, Recuperar, Reset), Admin y subpáginas, NotFound, Pagination, modales globales.

---

## 2. Estilos globales y variables

### Dónde está

- **Variables de tema (light/dark):** `frontend/src/styles/_variables-theme.scss`
- **Estilos globales:** `frontend/src/styles/index.scss`
- **Patrones móvil/app nativa:** `frontend/src/styles/_mobile-app.scss` (importado en `index.scss`)

### Qué se estandarizó

- **Tipografía:** `--app-font-size-body`, `--app-font-size-h1` … `--app-font-size-h4`, `--app-font-weight-body`, `--app-font-weight-heading`. Nada por debajo de 1rem para legibilidad.
- **Colores:** `--app-bg`, `--app-bg-card`, `--app-text-heading`, `--app-text-body`, `--app-text-muted`, `--app-accent`, `--app-accent-bright`, `--app-border`, `--app-shadow`, `--app-shadow-card`, `--app-btn-bg`, `--app-btn-text`.
- **Controles:** En `index.scss`, botones e inputs principales tienen `min-height: 44px` para área táctil tipo app.
- **Focus accesible:** `button:focus-visible`, `a:focus-visible`, etc. con `outline: 2px solid var(--app-accent)`.
- **Loader global:** `.global-loader` centrado (flex) para estados de carga.
- **Error de formulario:** `.error-formik` con color `var(--ph-pain-bad)`, `display: block`, `margin-top: 6px`, tipografía `--app-*`.

### Layout principal

- **`frontend/src/layouts/MainLayout.scss`**
  - `.content-container`: scroll vertical, `-webkit-overflow-scrolling: touch`, `overscroll-behavior-y: contain`.
  - `.content-container-inner`: padding lateral y inferior con **safe areas**:  
    `padding-left: max(1rem, env(safe-area-inset-left))`, igual para right y bottom (`env(safe-area-inset-bottom) + 1.5rem`).

---

## 3. Experiencia móvil tipo app nativa

### 3.1 Meta y viewport (`public/index.html`)

- `viewport-fit=cover` para usar toda la pantalla (notch, isla).
- `mobile-web-app-capable`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title` para que se pueda “añadir a la pantalla de inicio” y se comporte como app.

### 3.2 Base en `index.scss`

- `html`, `#root`: `min-height: 100dvh`, `overflow: hidden`.
- `body`: `min-height: 100dvh`, `overflow: hidden`, padding con `env(safe-area-inset-*)`.
- Scroll suave: `-webkit-overflow-scrolling: touch`, `overscroll-behavior-y: none`.
- Controles: `touch-action: manipulation`, `-webkit-tap-highlight-color: transparent` para respuesta táctil rápida y sin zoom en doble toque.

### 3.3 Archivo `_mobile-app.scss`

Incluye:

- **Contenedores tipo pantalla (`.app-screen` y contenedores principales):**  
  `width: 100%`, `max-width: 100vw`, `overflow-x: hidden`, `min-height: 100%` (o `100dvh` en Auth). Aplica a: Home, Instrucciones, Mi cuenta, Descargas, Planes, Checkout, PlanUpgrade, Admin, Auth, NotFound.
- **Feedback táctil:** `button:active`, `a:active`, etc. con `opacity: 0.9`.
- **Móvil/tablet:** inputs/select/textarea a **16px** para evitar zoom automático en iOS; botones `min-height: 48px` y padding generoso.

### 3.4 Auth como pantalla completa

- `.auth-main-container.auth-page`: `min-height: 100dvh`, padding con safe areas (`max(16px, env(safe-area-inset-left))`, etc.) y `padding-bottom` que incluye `env(safe-area-inset-bottom)`.

### 3.5 Modales en móvil (bottom sheet)

En **`frontend/src/components/Modals/Modal.scss`**, dentro de `@media (max-width: 576px)`:

- `.modal`: `align-items: flex-end`, `padding: 0` para pegar el contenido al borde inferior.
- `.modal-dialog`: sin margen lateral, `max-width: 100%`, `max-height: 92vh`.
- `.modal-content` y `.modal-container`: solo bordes redondeados arriba (`20px 20px 0 0`), `max-height: 92vh`, scroll con `-webkit-overflow-scrolling: touch`.
- Header y `.bottom` del modal con padding que usa `env(safe-area-inset-left/right/bottom)` para que los botones no queden bajo la barra de gestos.

### 3.6 NotFound

- El contenedor principal tiene clase **`app-screen`** para ancho, overflow y min-height coherentes con el resto de la app.
- Botón “Volver al inicio” usa la clase **`.btn-back-home`** (definida en `index.scss`) con transición, hover y `:active` para feedback táctil.

---

## 4. Secciones auditadas (UX/UI)

Cada sección usa variables `--app-*` (o las propias de sección como `--ma-*`, `--ad-*`, `--auth-*`) y controles con min-height 44–48px.

| Sección | Archivos principales | Notas |
|---------|----------------------|--------|
| **Home** (explorador) | `Home/Home.scss`, `Home.tsx` | Texto del explorador más grande; iconos carpeta/archivo/play/descarga; botón Descargar tipo pill. |
| **Instrucciones** | `Instructions/Instructions.scss` | Tipografía `--app-*`, CTAs e inputs 48px, stepper y terminal legibles. |
| **Mi cuenta** | `MyAccount/MyAccount.scss` | Variables `--ma-*` y `--app-*`; botones 48px; cards y tabla coherentes con el tema. |
| **Descargas** | `Downloads/Downloads.scss` | Tipografía y colores `--app-*`; cards con sombra y borde de tema. |
| **Planes** | `Plans/Plans.scss` | Contenedor con `--app-text-heading` y espaciado responsive. |
| **Checkout** | `Checkout/Checkout.scss`, `CheckoutForm/CheckoutForm.scss` | Todo con `--app-*`; resumen y formulario de pago con min-heights correctos. |
| **Actualizar planes** | `PlanUpgrade/PlanUpgrade.scss` | Mismo estándar que Planes. |
| **Auth** (Login, Registro, Recuperar, Reset) | `Auth/Auth.scss`, `LoginForm/`, `SignUpForm/`, `ForgotPasswordForm/`, `ResetPassword/` | Inputs 48–52px; variables `--auth-*` y `--app-*`; errores con `.error-formik`. |
| **Admin** | `Admin/Admin.scss`, `AdminPageLayout/AdminPageLayout.scss` | Tema `--ad-*`; botones e inputs 48px; tabla y lista móvil; paginación con `--app-font-size-body`. |
| **NotFound** | `NotFound/NotFound.tsx` | Variables `--app-*`, botón con `.btn-back-home` y `app-screen`. |
| **Pagination** | `Pagination/Pagination.scss` | Tipografía `--app-*`, controles 44px. |
| **Modales** | `Modals/Modal.scss`, `ErrorModal/ErrorModal.scss` | Botones 48px; header/bottom con padding y safe areas en móvil. |

---

## 5. Modales y formularios

- **Modal base (`Modal.scss`):** bordes, sombra y colores con `--app-*`; botones con `min-height: 48px`; en móvil, comportamiento bottom sheet y safe areas (ver [3.5](#35-modales-en-móvil-bottom-sheet)).
- **ErrorModal:** título y contenido con tipografía y color coherentes; botones 48px; espaciado en `.bottom` sin solapamientos.
- **Mensajes de error en formularios:** clase global `.error-formik`; en modales (ej. AddUsers, EditPlan, ForgotPassword) los errores se muestran en bloque con `margin-top` para no tapar otros elementos.

---

## 6. Deploy a producción (Netlify)

### Configuración en repo

- **`netlify.toml`** (en la raíz del monorepo):
  - `[build]`: `base = "."`, `command = "npm run build"`, `publish = "frontend/build"`.
  - `[build.environment]`: `CI = "false"` para que el build no falle por warnings de CRA/ESLint.

- **Sitio actual:** el proyecto está vinculado al sitio que sirve **https://thebearbeat.com** (ID en `.netlify/state.json`).

### Por qué falla `netlify deploy --prod` sin filtro

En este repositorio hay **dos sitios** de Netlify detectados (bear-beat y thebearbeat). La CLI pide elegir proyecto; si no se especifica, devuelve error: *"Projects detected: bear-beat, thebearbeat. Configure the project..."*.

### Comando correcto para desplegar

Desde la **raíz del repo**:

```bash
npm run build
npx netlify deploy --prod --dir=frontend/build --filter=thebearbeat
```

- `npm run build`: construye el frontend (workspace `frontend`) y deja el resultado en `frontend/build`.
- `--dir=frontend/build`: sube esa carpeta (opcional si Netlify hace el build en CI; **necesario** cuando se hace build local y deploy manual).
- `--filter=thebearbeat`: indica qué sitio usar (thebearbeat.com).

### Deploy desde la UI de Netlify

Si el sitio está conectado por Git, los push a la rama configurada (p. ej. `main`) disparan el build en Netlify. En ese caso no hace falta `--filter`; la configuración del sitio en Netlify ya define base, comando y publish.

### Resumen

| Acción | Comando o lugar |
|--------|------------------|
| Build local | `npm run build` (desde raíz) |
| Deploy manual a producción | `npx netlify deploy --prod --dir=frontend/build --filter=thebearbeat` |
| Ver sitio vinculado | `npx netlify status` |
| URL producción | https://thebearbeat.com |

---

## 7. Archivos modificados (referencia rápida)

### Estilos

- `frontend/src/styles/index.scss` – Import de `_mobile-app.scss`; `.btn-back-home`; `.error-formik`; focus visible; global loader.
- `frontend/src/styles/_mobile-app.scss` – Contenedores app-screen, feedback `:active`, Auth safe areas, reglas móvil (16px inputs, 48px botones).
- `frontend/src/styles/_variables-theme.scss` – Variables `--app-*` (tipografía, colores) para light/dark.
- `frontend/src/layouts/MainLayout.scss` – Content container con scroll y safe areas en `content-container-inner`.

### Páginas

- `frontend/src/pages/NotFound/NotFound.tsx` – Clases `app-screen` y `btn-back-home`.
- `frontend/src/pages/Home/Home.scss` – Tamaños de texto e iconos del explorador.
- `frontend/src/pages/Instructions/Instructions.scss` – Tipografía y CTAs.
- `frontend/src/pages/Downloads/Downloads.scss` – Tipografía y cards.
- `frontend/src/pages/MyAccount/MyAccount.scss` – Variables y botones.
- `frontend/src/pages/Plans/Plans.scss`, `PlanUpgrade/PlanUpgrade.scss` – Contenedores y tema.
- `frontend/src/pages/Checkout/Checkout.scss` – Estilos de checkout.
- `frontend/src/pages/Auth/Auth.scss` – Layout y formularios Auth.
- `frontend/src/pages/Admin/Admin.scss` – Tema Admin.

### Componentes

- `frontend/src/components/Modals/Modal.scss` – Bottom sheet y safe areas en móvil.
- `frontend/src/components/Modals/ErrorModal/ErrorModal.scss` – Espaciado y tipografía.
- `frontend/src/components/CheckoutForm/CheckoutForm.scss` – Import `_variables-theme.scss`.
- `frontend/src/components/AdminPageLayout/AdminPageLayout.scss` – Import `_variables-theme.scss`.
- `frontend/src/components/Pagination/Pagination.scss` – Tipografía `--app-*`.
- `frontend/src/components/Auth/*` – Inputs y errores (LoginForm, SignUpForm, ForgotPasswordForm, etc.).

### Configuración

- `netlify.toml` – base, command, publish, CI=false.
- `public/index.html` – viewport y meta de app móvil (sin cambios recientes en este ciclo; ya existían).

---

## Referencias cruzadas

- **Diseño y variables:** [DISENO-Y-ESTADO-ACTUAL.md](./DISENO-Y-ESTADO-ACTUAL.md)
- **Resumen general de cambios:** [DOCUMENTACION_CAMBIOS.md](./DOCUMENTACION_CAMBIOS.md)
- **Changelog anterior (menú, scroll, Netlify):** [CHANGELOG-UX-DEPLOY-RECIENTE.md](./CHANGELOG-UX-DEPLOY-RECIENTE.md)
