# Diseño unificado y estado actual de la web – Bear Beat

Documento de referencia para que cualquier desarrollador (o la IA) entienda el sistema de diseño, las páginas, las funciones y el estado actual del frontend. **Actualizar este doc cuando se añadan páginas, modales o se cambie el diseño.**

---

## 1. Sistema de diseño (tipografía y colores)

### Objetivo
Toda la app (Home público, Auth, Admin, modales, alertas) usa **el mismo tamaño de texto y estilo visual** que la página principal (PublicHome): escala tipográfica con `clamp()`, colores y sombras unificados.

### Variables CSS (origen)

| Archivo | Qué define |
|--------|------------|
| `frontend/src/styles/_variables-theme.scss` | Variables `--app-*` y `--ph-*` (PublicHome). Se aplican según `[data-theme="light"]` o `[data-theme="dark"]` en `<html>`. |

### Variables de tipografía (`--app-*`)

- **Body / texto general:** `--app-font-size-body` = `clamp(1.05rem, 3.5vw, 1.9rem)`
- **Body grande:** `--app-font-size-body-lg`
- **Títulos:** `--app-font-size-h4` … `--app-font-size-h1` (escala con `clamp`)
- **Pesos:** `--app-font-weight-body` (500), `--app-font-weight-heading` (700), `--app-font-weight-heading-strong` (800)

### Variables de color y superficie

- **Texto:** `--app-text-heading`, `--app-text-body`, `--app-text-muted`
- **Fondos:** `--app-bg`, `--app-bg-soft`, `--app-bg-card`
- **Bordes y sombras:** `--app-border`, `--app-shadow`, `--app-shadow-card`
- **Botones y acentos:** `--app-btn-bg`, `--app-btn-text`, `--app-accent`, `--app-accent-bright`

### Dónde se aplica el sistema

| Archivo | Qué hace |
|--------|-----------|
| `frontend/src/styles/index.scss` | Aplica a `body`, `h1`–`h4`, `label`, `p`, `a`, `button`, `form`: `font-size: var(--app-font-size-body)` (o h1–h4), colores y pesos. Es la base global. |
| `frontend/src/styles/landing-design.scss` | Define variables SCSS (`$text-primary`, `$card-glass`, etc.) que **mapean** a `var(--app-*)`; clases `.landing-card`, `.landing-input`, `.landing-btn-primary` usan el sistema. |
| `frontend/src/components/Modals/Modal.scss` | Todos los modales: títulos, contenido, botones, inputs y tablas usan `var(--app-font-size-*)` y `var(--app-text-*)`. |
| `frontend/src/components/Auth/*.scss` | Login, Registro, Recuperar contraseña: títulos, subtítulos, inputs, enlaces y botones usan `var(--app-font-size-body)` y `var(--app-font-size-h1)`. |
| Páginas (Admin, Home, Auth, Instructions, etc.) | Usan variables `--app-*` o importan `landing-design.scss` para mantener el mismo estilo. |

### Regla para nuevos componentes
- **No usar** `font-size` en `px` o `rem` fijos.
- Usar siempre: `font-size: var(--app-font-size-body)` (o `-body-lg`, `-h4`, `-h3`, `-h2`, `-h1` según jerarquía).
- Colores: `color: var(--app-text-heading)` / `var(--app-text-body)` / `var(--app-text-muted)`; fondos `var(--app-bg-card)` etc.

---

## 2. Rutas y páginas (estado actual)

### Estructura de rutas (`frontend/src/index.tsx`)

| Ruta | Componente | Requiere login | Descripción |
|------|------------|----------------|-------------|
| `/` | `HomeOrLanding` | No | Muestra **PublicHome** (no logueado) o **Home** (logueado). |
| `/instrucciones` | `Instructions` | No* | Cómo usar la app / descargar. |
| `/micuenta` | `MyAccount` | Sí | Datos del usuario, cuenta. |
| `/descargas` | `Downloads` | Sí | Historial/gestión de descargas. |
| `/planes` | `Plans` | Sí | Ver/contratar planes. Si ya tiene plan activo, puede redirigir a Home. |
| `/comprar` | `Checkout` | Sí | Checkout de compra. |
| `/actualizar-planes` | `PlanUpgrade` | Sí | Cambio de plan. |
| `/admin` | Redirige a `/admin/usuarios` | Sí | Panel admin. |
| `/admin/usuarios` | `Admin` | Sí | Gestión de usuarios. |
| `/admin/planesAdmin` | `PlanAdmin` | Sí | Gestión de planes. |
| `/admin/almacenamiento` | `Storage` | Sí | Almacenamiento. |
| `/admin/catalogo` | `CatalogStats` | Sí | Estadísticas del catálogo (REST, caché, CSV). |
| `/admin/historial-descargas` | `DownloadHistory` | Sí | Historial de descargas. |
| `/admin/cupones` | `Coupons` | Sí | Cupones. |
| `/admin/ordenes` | `Ordens` | Sí | Órdenes. |
| `/admin/historialCheckout` | `HistoryCheckout` | Sí | Historial de checkout. |
| `/admin/dominios-bloqueados` | `BlockedEmailDomains` | Sí | Dominios de email bloqueados. |
| `/admin/telefonos-bloqueados` | `BlockedPhoneNumbers` | Sí | Teléfonos bloqueados. |
| `/auth` | `LoginForm` | No (solo no logueados) | Login. |
| `/auth/registro` | `SignUpForm` | No | Registro. |
| `/auth/recuperar` | `ForgotPasswordForm` | No | Recuperar contraseña. |
| `/auth/reset-password` | `ResetPassword` | No | Reset de contraseña (enlace del correo). |
| Cualquier otra | `Navigate to "/"` | — | 404 → redirige a `/`. |

\* Las rutas bajo `LandingOrAuthRoute` pueden tener lógica que redirige si no hay sesión (según `AuthRoute` en hijos).

### Funciones de ruteo

| Archivo | Función |
|--------|---------|
| `frontend/src/functions/HomeOrLanding.tsx` | Elige entre `PublicHome` (sin token) y `Home` (con token) en `/`. |
| `frontend/src/functions/AuthRoute.tsx` | Protege rutas: si no hay sesión, redirige a login o vista pública. |
| `frontend/src/functions/NotAuthRoute.tsx` | Para `/auth`: si ya hay sesión, puede redirigir fuera del auth. |
| `frontend/src/functions/LandingOrAuthRoute.tsx` | Envuelve rutas que pueden ser públicas o con auth. |

---

## 3. Páginas principales y qué hacen

| Página | Ruta(s) | Función principal |
|--------|---------|--------------------|
| **PublicHome** | `/` (sin sesión) | Landing/home público: hero, precios, CTAs, ticker de géneros, tema claro/oscuro. |
| **Home** | `/` (con sesión) | App principal: explorador de archivos (música/videos), descargas. |
| **Auth (Login)** | `/auth` | Inicio de sesión (email/contraseña). |
| **Auth (Registro)** | `/auth/registro` | Registro (email, contraseña, WhatsApp con selector de país). Turnstile. |
| **Auth (Recuperar)** | `/auth/recuperar` | Envío de enlace para recuperar contraseña. Turnstile. |
| **Auth (Reset)** | `/auth/reset-password` | Formulario de nueva contraseña tras enlace del correo. |
| **Instructions** | `/instrucciones` | Instrucciones de uso / descarga. |
| **Plans** | `/planes` | Listado de planes; si el usuario tiene plan activo puede redirigir a Home. |
| **Checkout** | `/comprar` | Checkout (Stripe, PayPal, OXXO, SPEI, etc.). |
| **PlanUpgrade** | `/actualizar-planes` | Cambio de plan. |
| **MyAccount** | `/micuenta` | Datos de la cuenta del usuario. |
| **Downloads** | `/descargas` | Descargas del usuario. |
| **Admin** | `/admin/usuarios` | CRUD usuarios. |
| **PlanAdmin** | `/admin/planesAdmin` | Gestión de planes (admin). |
| **Storage** | `/admin/almacenamiento` | Almacenamiento (admin). |
| **CatalogStats** | `/admin/catalogo` | Estadísticas del catálogo (totales, géneros, CSV). |
| **DownloadHistory** | `/admin/historial-descargas` | Historial de descargas (admin). |
| **Coupons** | `/admin/cupones` | Cupones (admin). |
| **Ordens** | `/admin/ordenes` | Órdenes (admin). |
| **HistoryCheckout** | `/admin/historialCheckout` | Historial de checkout (admin). |
| **BlockedEmailDomains** | `/admin/dominios-bloqueados` | Dominios bloqueados. |
| **BlockedPhoneNumbers** | `/admin/telefonos-bloqueados` | Teléfonos bloqueados. |

---

## 4. Modales y alertas

Todos los modales comparten la base en `frontend/src/components/Modals/Modal.scss` y usan el **mismo sistema de diseño** (tipografía y colores del Home).

| Modal / componente | Archivo SCSS | Uso típico |
|-------------------|--------------|------------|
| **Base (contenedor)** | `Modal.scss` | Estructura común: `.modal-container`, `.header`, `.bottom`, botones (cancel, retry, option-1…5), inputs (`.card-input`), `.modal-addusers`, `.modal-UHREMIX`. |
| **ErrorModal** | `ErrorModal/ErrorModal.scss` | Alertas de error (mensaje + Cerrar). Título "Error", contenido y botón con tipografía app. |
| **SuccessModal** | `SuccessModal/SuccessModal.scss` | Confirmación de éxito (título + mensaje + Aceptar). |
| **OptionModal** | `OptionModal/OptionModal.scss` | Opciones (plan-options, botones con estilo option). |
| **HistoryModal** | `HistoryModal/HistoryModal.scss` | Tabla de historial (tipografía y colores app en tabla). |
| **PlansModal** | `PlansModal/Plans.scss` | Planes en modal (`.go-back`, `.add-card`, botones). |
| **AddExtraStorageModal** | `AddExtraStorageModal/AddExtraStorageModal.scss` | Modal de almacenamiento extra. |
| **VerifyPhoneModal** | `VerifyPhoneModal/VerifyPhoneModal.scss` | Verificación de teléfono. |
| **VerifyUpdatePhoneModal** | `VerifyUpdatePhoneModal/VerifyUpdatePhoneModal.scss` | Verificación al actualizar teléfono. |

Otros modales (AddCouponModal, EditCouponModal, AddPlanModal, EditPlanModal, DeleteUserModal, OxxoModal, SpeiModal, PaymentMethodModal, etc.) usan la misma estructura `.modal-container` y heredan los estilos de `Modal.scss`, por lo que ya tienen tipografía y diseño unificados.

### Cómo mantener consistencia en modales nuevos
- Usar la estructura existente (`.modal-container`, `.header`, `.bottom`, `.content`, `.title`).
- No definir `font-size` en px/rem; usar `var(--app-font-size-body)` o `var(--app-font-size-h1)` según corresponda.
- Colores: `var(--app-text-heading)`, `var(--app-text-body)`, `var(--app-bg-card)`, etc.

---

## 5. Archivos clave (referencia rápida)

| Qué | Dónde |
|-----|--------|
| Variables de tema y app (tipografía, colores) | `frontend/src/styles/_variables-theme.scss` |
| Estilos base (body, títulos, botones) | `frontend/src/styles/index.scss` |
| Variables SCSS que mapean a --app-* | `frontend/src/styles/landing-design.scss` |
| Base de todos los modales | `frontend/src/components/Modals/Modal.scss` |
| Auth: Login, Registro, Recuperar | `frontend/src/components/Auth/LoginForm/`, `SignUpForm/`, `ForgotPasswordForm/` |
| Rutas y árbol de componentes | `frontend/src/index.tsx` |
| Home público vs Home app | `frontend/src/functions/HomeOrLanding.tsx` |
| Página principal pública | `frontend/src/pages/PublicHome/PublicHome.tsx` + `PublicHome.scss` |
| Layout (navbar, fondo, tema) | `frontend/src/layouts/MainLayout.tsx` + `MainLayout.scss` |
| Contexto de tema (claro/oscuro) | `frontend/src/contexts/ThemeContext.tsx` |
| Textos y planes (Constants) | `frontend/src/utils/Constants.ts` |

---

## 6. Resumen para desarrolladores

- **Tipografía y colores:** Definidos en `_variables-theme.scss` (`--app-*`). Aplicados globalmente en `index.scss` y en componentes (Auth, Modals, páginas). No usar tamaños fijos; usar siempre las variables.
- **Rutas:** Definidas en `index.tsx`; protección con `AuthRoute` / `NotAuthRoute` / `LandingOrAuthRoute`.
- **Modales:** Base en `Modal.scss`; Error y Success con SCSS propio que refuerza tipografía/color. Cualquier modal que use `.modal-container` hereda el diseño.
- **Estado actual:** Una sola SPA; raíz `/` muestra PublicHome o Home según sesión; resto de páginas y admin como en las tablas anteriores.

Cuando añadas una **nueva página**, **nuevo modal** o **cambio de diseño**, actualiza este documento (rutas, tabla de páginas o sección de modales) y, si tocas tipografía/colores, mantén el uso de `var(--app-*)`.
