# Workflow de Ramas y Releases (vigente)

Última actualización: **2026-02-17 (EST)**.

## Objetivo

Definir una forma única y simple de trabajar para que cualquier dev o auditor entienda:

- Qué rama representa producción.
- Cómo entra código nuevo.
- Qué validaciones son obligatorias.
- Cómo se limpia el repositorio sin riesgo.

## Estado real hoy

- Rama base y deploy de producción: **`main`**.
- `origin/main` está sincronizada con local (`ahead:0`, `behind:0`).
- La rama `staging` existe pero está **403 commits detrás** de `origin/main`; hoy no sirve como rama de promoción.

## Flujo oficial (de ahora en adelante)

1. Crear rama corta desde `main`:
   - Recomendado: `codex/<scope-corto>` o `fix/<scope-corto>`.
2. Hacer cambios pequeños y enfocados.
3. Ejecutar validaciones locales mínimas:
   - `npm run test:local`
   - `npm test --workspace=frontend`
4. Abrir PR hacia `main` con evidencia de pruebas (comando + resultado).
5. Esperar CI en verde:
   - `.github/workflows/ci.yml`
   - `.github/workflows/gitleaks.yml`
6. Merge a `main`.
7. Deploy:
   - Frontend en Netlify (build desde `main`).
   - Backend por GitHub Actions (`backend-deploy.yml`) en push a `main` cuando hay cambios de backend/deploy.

## Convenciones de ramas

- Long-lived:
  - `main`: producción.
  - `staging`: reservada; no usar para promover hasta re-sincronizar.
- Short-lived:
  - `codex/*`, `fix/*`, `feat/*`, `chore/*`.
- Evitar ramas huérfanas sin upstream y ramas locales antiguas sin uso.

## Política de limpieza (semanal)

1. Borrar ramas ya mergeadas a `main` y sin trabajo pendiente.
2. Revisar ramas remotas legacy (por ejemplo de 2024) antes de conservarlas.
3. Mantener `branch-audit.md` actualizado con fecha/hora y conteos reales.

Comandos útiles:

```bash
# ramas locales mergeadas a main
git branch --merged main

# ramas remotas (sin HEAD)
git for-each-ref --format='%(refname:short)' refs/remotes/origin | grep -v 'origin/HEAD'

# diferencia de staging contra main
git rev-list --left-right --count origin/staging...origin/main
```

## Regla de oro para auditores

Si hay discrepancia entre documentos históricos y estado actual de GitHub, la verdad operativa es:

1. `origin/main`
2. workflows en `.github/workflows/`
3. snapshot en `docs/branch-audit.md`
