# Reporte de Diseño y UX/UI por Rutas – Bear Beat

**Fecha:** 5 de febrero de 2026  
**Entorno:** Frontend en `http://localhost:3000`  
**Alcance:** Todas las rutas sin inicio de sesión; rutas con sesión documentadas según estructura del código (no probadas por falta de backend/credenciales en la sesión de prueba).

---

## 1. Metodología

- **Navegador:** Recorrido automático de todas las rutas públicas y protegidas (redirecciones observadas).
- **Capturas:** Se tomaron capturas de pantalla full-page en cada ruta sin sesión (archivos en sesión del navegador; para reporte formal conviene re-ejecutar en producción y guardar en `docs/screenshots/`).
- **Rutas con sesión:** No se pudo iniciar sesión (backend no disponible o sin credenciales de prueba). Se describe la experiencia esperada según el código y la estructura de la app.

---

## 2. Rutas visitadas SIN inicio de sesión

| # | Ruta | Título / Contenido observado | Layout |
|---|------|------------------------------|--------|
| 1 | `/` | Landing: "El Arsenal de 12.5 TB...", CTA "QUIERO BLINDAR MI LIBRERÍA", stats (195k+ archivos, 12.35 TB, etc.) | Navbar con Iniciar Sesión / Obtener Acceso, sin sidebar |
| 2 | `/auth` | "Bienvenido de nuevo, Colega.", formulario email/contraseña, INGRESAR, enlaces recuperar/registro | Auth (panel dividido, logo + formulario) |
| 3 | `/auth/registro` | "Estás a 60 segundos de tenerlo todo.", formulario registro (email, teléfono, nombre, contraseña), Turnstile, REGISTRARSE | Auth |
| 4 | `/auth/recuperar` | "CAMBIAR CONTRASEÑA", campo E-mail, ENVIAR LINK, Turnstile | Auth |
| 5 | `/instrucciones` | "Método de descarga", pasos 1–4 (FileZilla, Mi Cuenta, claves FTP, disco/carpeta) | MainLayout (navbar + sidebar + contenido) |
| 6 | `/micuenta` | Información general (Username, E-mail, Phone vacíos), tabla FTP, Últimas compras vacía, Tarjetas | MainLayout |
| 7 | `/descargas` | "Historial de descargas", columnas Nombre / Descargado (vacío) | MainLayout |
| 8 | `/planes` | "Planes y precios", Plan Oro $350 MXN, 500 GB FTP, botones Spei / COMPRAR CON TARJETA | MainLayout (Plans puede mostrarse antes de redirección por AuthRoute) |

**Nota:** En entorno de desarrollo apareció el overlay de React "Compiled with problems" (errores del backend); en producción no debería verse.

---

## 3. Hallazgos por ruta (Diseño y UX/UI)

### 3.1 `/` (Landing – PublicHome)

| Aspecto | Estado | Comentario |
|--------|--------|------------|
| **Jerarquía visual** | ✅ | H1 claro, subtítulo, CTA destacado, bloques de beneficios y comparativa DJ Amateur vs Bear Beat. |
| **Navegación** | ✅ | "Iniciar Sesión" y "Obtener Acceso" visibles; tema (sol/luna) presente. |
| **Responsive** | ⚠️ | No validado en esta sesión; revisar en móvil/tablet. |
| **Accesibilidad** | ⚠️ | Verificar contraste de textos y que los CTAs tengan nombres accesibles. |
| **Consistencia** | ✅ | Uso de variables de diseño (tipografía, colores) alineado con `DISENO-Y-ESTADO-ACTUAL.md`. |

**Recomendación:** Añadir `aria-label` en el botón de tema si solo muestra icono.

---

### 3.2 `/auth` (Login)

| Aspecto | Estado | Comentario |
|--------|--------|------------|
| **Claridad** | ✅ | Título "Bienvenido de nuevo, Colega." y subtítulo orientan bien. |
| **Formulario** | ✅ | Campos "Correo electrónico" y "Contraseña", enlace "¿Olvidaste tu contraseña?", botón INGRESAR, link "Registrarme". |
| **Chat** | ✅ | Elemento CHAT visible (soporte). |
| **Panel lateral** | ✅ | Mensaje de valor "Música y videos exclusivos para DJs · Todo organizado por géneros". |
| **Errores** | ⚠️ | Asegurar que errores de API (credenciales inválidas) se muestren de forma visible y en español. |

**Recomendación:** Mantener mensajes de error debajo del botón o en banner, sin modales agresivos.

---

### 3.3 `/auth/registro`

| Aspecto | Estado | Comentario |
|--------|--------|------------|
| **Valor** | ✅ | Lista de beneficios (60 segundos, 12.5 TB, FTP, cancelación). |
| **Formulario** | ✅ | Email, teléfono (selector país), nombre, contraseña, repetir contraseña; Turnstile; REGISTRARSE. |
| **Turnstile** | ⚠️ | Mensaje "Turnstile no configurado" en dev; en producción debe estar configurado o oculto. |
| **Navegación** | ✅ | "Ya tengo cuenta" con enlace a `/auth`. |

**Recomendación:** En producción ocultar o reemplazar el texto "Turnstile no configurado" por un placeholder o estado de carga.

---

### 3.4 `/auth/recuperar`

| Aspecto | Estado | Comentario |
|--------|--------|------------|
| **Claridad** | ✅ | "CAMBIAR CONTRASEÑA", campo E-mail, ENVIAR LINK. |
| **Turnstile** | ⚠️ | Igual que registro. |
| **Regreso** | ✅ | "Ya tengo cuenta" a `/auth`. |

---

### 3.5 `/instrucciones`

| Aspecto | Estado | Comentario |
|--------|--------|------------|
| **Estructura** | ✅ | Pasos 1–4 con títulos y descripciones; enlace a FileZilla. |
| **Navegación** | ✅ | Tabs o lista "Paso 1", "Paso 2", etc. para saltar entre secciones. |
| **Layout** | ✅ | MainLayout con sidebar (Contenido: Todos los archivos, Planes, Mi cuenta, Instrucciones, Soporte). |
| **Legibilidad** | ✅ | Texto corrido legible; considerar listas cortas si crece el contenido. |

---

### 3.6 `/micuenta` (sin sesión)

| Aspecto | Estado | Comentario |
|--------|--------|------------|
| **Riesgo UX** | ⚠️ | La ruta es accesible sin login y muestra estructura vacía (Username, E-mail, Phone en blanco; tablas FTP y compras vacías). |
| **Seguridad / Claridad** | ⚠️ | Si no hay redirección al login, el usuario puede no entender que debe iniciar sesión. Recomendación: redirigir a `/auth` con `returnUrl=/micuenta` si no hay token. |
| **Diseño** | ✅ | Secciones claras: Información general, MI USUARIO FTP ACTIVO, Últimas compras, Tarjetas. |

**Recomendación:** Proteger `/micuenta` con `AuthRoute` o mostrar un estado explícito "Inicia sesión para ver tu cuenta" con CTA a `/auth`.

---

### 3.7 `/descargas` (sin sesión)

| Aspecto | Estado | Comentario |
|--------|--------|------------|
| **Riesgo UX** | ⚠️ | Igual que Mi cuenta: accesible sin sesión con tabla vacía. |
| **Contenido** | ✅ | "Historial de descargas", columnas Nombre / Descargado. |
| **Recomendación** | ⚠️ | Misma que micuenta: proteger con AuthRoute o mensaje claro "Inicia sesión para ver tu historial". |

---

### 3.8 `/planes`

| Aspecto | Estado | Comentario |
|--------|--------|------------|
| **Contenido** | ✅ | Plan Oro, precio, beneficios, botones Spei y COMPRAR CON TARJETA. |
| **Protección** | ⚠️ | Según router, `Plans` está dentro de `AuthRoute`; si en la prueba se mostró sin login, puede ser un flash antes de redirección. Confirmar que sin token se redirige a `/auth` con returnUrl. |
| **Diseño** | ✅ | Tarjeta de plan legible; botones de pago visibles. |

---

## 4. Rutas CON inicio de sesión (esperado según código)

No se probaron por falta de backend/credenciales. Resumen de lo que debería verse:

| Ruta | Esperado |
|------|----------|
| `/` | **Home** (explorador de archivos): sidebar con Contenido, tabla "Todos los archivos", buscador, carpetas Audios/Karaoke/Videos, botón Descargar según plan. |
| `/instrucciones` | Igual que sin sesión, con navbar mostrando Mi cuenta / Cerrar sesión y tema. |
| `/micuenta` | Datos del usuario, tabla FTP con host/user/password/port/expiración, últimas compras, tarjetas. |
| `/descargas` | Lista de descargas del usuario. |
| `/planes` | Planes disponibles; si ya tiene plan activo puede mostrarse "Actualiza tu plan" en sidebar. |
| `/comprar` | Checkout del plan elegido (Stripe/SPEI). |
| `/comprar/success` | Confirmación de compra. |
| `/actualizar-planes` | Cambio de plan. |
| `/admin/*` | Panel admin (usuarios, planes, almacenamiento, catálogo, historial descargas, cupones, órdenes, historial checkout, dominios bloqueados, teléfonos bloqueados). Solo para rol admin. |

**Recomendación:** Ejecutar una segunda pasada de capturas en entorno de staging/producción con un usuario de prueba para validar diseño y flujos con sesión.

---

## 5. Resumen de problemas y recomendaciones

### 5.1 Prioridad alta

1. **Protección de rutas:** `/micuenta` y `/descargas` accesibles sin sesión con contenido vacío. Redirigir a `/auth` cuando no haya token o mostrar estado claro "Inicia sesión".
2. **Turnstile:** Evitar que se muestre "Turnstile no configurado" en producción (configurar o ocultar).

### 5.2 Prioridad media

3. **Consistencia de redirección:** Asegurar que `/planes`, `/comprar`, `/comprar/success`, `/actualizar-planes` redirijan siempre a `/auth` si no hay sesión, sin flash de contenido.
4. **Mensajes de error en login:** Errores de API visibles, en español y accesibles.
5. **Capturas para reporte:** Guardar capturas en `docs/screenshots/` (o similar) desde producción/staging para futuros reportes.

### 5.3 Prioridad baja

6. **Accesibilidad:** Revisar contraste (WCAG) y `aria-label` en botones solo con icono (tema, chat).
7. **Responsive:** Revisar todas las rutas en móvil y tablet (sidebar/drawer, tablas, formularios).

---

## 6. Capturas de esta sesión

Las capturas se generaron con los siguientes nombres (en la sesión del navegador):

- `01-landing-sin-sesion.png`
- `02-auth-login-sin-sesion.png`
- `03-auth-registro-sin-sesion.png`
- `04-auth-recuperar-sin-sesion.png`
- `05-instrucciones-sin-sesion.png`
- `06-micuenta-sin-sesion.png`
- `07-descargas-sin-sesion.png`
- `08-planes-sin-sesion.png`

Para un reporte formal con imágenes embebidas, ejecutar de nuevo el flujo en **producción** (o staging sin overlay de errores), guardar las capturas en el repo (por ejemplo `docs/screenshots/YYYY-MM-DD/`) y referenciarlas en este documento.

---

## 7. Referencias

- **Sistema de diseño:** `docs/DISENO-Y-ESTADO-ACTUAL.md`
- **Rutas y componentes:** `frontend/src/index.tsx`
- **Layout principal:** `frontend/src/layouts/MainLayout.tsx`
- **Protección de rutas:** `frontend/src/functions/AuthRoute.tsx`, `LandingOrAuthRoute.tsx`, `NotAuthRoute.tsx`
