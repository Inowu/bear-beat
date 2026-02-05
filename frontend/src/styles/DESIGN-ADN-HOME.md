# ADN del Home (Golden Standard) — Estándar de oro visual

## Tipografía
- **H1**: `var(--app-font-size-h1)` = `clamp(1.75rem, 6vw, 2.75rem)`, weight 800 (heading-strong).
- **H2**: `var(--app-font-size-h2)` = `clamp(1.5rem, 5.5vw, 2.25rem)`, weight 700.
- **H3**: `var(--app-font-size-h3)` = `clamp(1.35rem, 4.5vw, 1.75rem)`.
- **H4**: `var(--app-font-size-h4)` = `clamp(1.2rem, 4vw, 1.5rem)`.
- **Body**: `var(--app-font-size-body)` = `clamp(1.05rem, 3.5vw, 1.9rem)`, weight 500.
- **Fuente**: `Poppins, sans-serif` en encabezados y body (definido en `body`).

## Colores (variables CSS, cambian con tema)
- **Fondo app**: `var(--app-bg)` — light: #f8fafc / dark: #020617 (slate-950).
- **Fondo cards**: `var(--app-bg-card)`.
- **Texto título**: `var(--app-text-heading)`.
- **Texto cuerpo**: `var(--app-text-body)`.
- **Texto muted**: `var(--app-text-muted)`.
- **Acento (cyan)**: `var(--app-accent)`, `var(--app-accent-bright)`.
- **Bordes**: `var(--app-border)` — light: #e2e8f0 / dark: #1e293b.

## Modo oscuro / claro
- Controlado por `data-theme="light"` o `data-theme="dark"` en `<html>` (ThemeContext).
- Todas las páginas deben usar variables CSS (--app-*, --ad-*, --ma-*, --fb-*) y **nunca** fondos fijos `bg-white` sin contraparte `dark:` o variable.

## Espaciado y contenedor
- **Padding página**: Estandarizado en MainLayout: móvil 1rem (16px), desktop 1.5rem (24px).
- **Máximo ancho contenido**: 1320px, centrado.

## Móvil
- Tablas: no romper ancho; `overflow-x-auto` o lista compacta.
- Touch targets: mínimo 44px de altura en botones/enlaces.
- Bordes: usar `var(--app-border)` / `--ad-border` (nunca `border-gray-200` fijo).

## Admin
- Usa `--ad-bg`, `--ad-card`, `--ad-border`, `--ad-title`, `--ad-text`, `--ad-accent` (ya tienen variante light y dark en _variables-theme.scss).
- Títulos de sección: mismo impacto que Home → `var(--app-font-size-h1)` o h2.
