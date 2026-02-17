# Operación de Escalabilidad: DownloadHistory

Fecha: 2026-02-17

## Objetivo
Escalar `download_history` sin degradar consultas de Home/Admin ni crecer la tabla de forma no controlada.

El enfoque implementado es:
1. `rollup` diario para Top Downloads público.
2. `archive-first` para filas históricas.
3. `purge` por lotes para mantener la tabla activa pequeña.
4. particionado mensual operable (principalmente en `download_history_archive`).

## Cambios incluidos
1. Nueva tabla `download_history_archive` (migración Prisma):
- guarda copia de histórico con unicidad `sourceId + date` (idempotencia de archivado).
- índices para operación y consulta (`date`, `archivedAt`, `userId+date`, `isFolder+date`).

2. Script `backend/scripts/purgeDownloadHistory.ts` reforzado:
- modo por defecto: `archive-delete`.
- soporta `archive-only` y `delete-only`.
- dry-run por defecto.
- operación por lotes con `--batch`, `--sleep-ms`, `--max-batches`.

3. Script `backend/scripts/manageDownloadHistoryPartitions.ts`:
- planifica/aplica particiones mensuales RANGE por `date`.
- soporta bootstrap (`--bootstrap`) para tablas aún no particionadas.
- mantiene ventanas futuras (`--months-ahead`) y opcionalmente elimina particiones antiguas (`--drop-older-than-months`).

## Comandos
Desde `backend/`:

```bash
# 0) Aplicar migraciones primero (requerido)
npx prisma migrate deploy

# 1) Dry-run purge seguro (recomendado primero)
npm run downloadHistory:purge -- --keep-days 365 --batch 5000 --sleep-ms 50

# 2) Ejecutar archive + delete (producción)
npm run downloadHistory:purge -- --apply --keep-days 365 --batch 5000 --sleep-ms 50

# 3) Solo archivar (sin borrar)
npm run downloadHistory:purge -- --apply --mode archive-only --keep-days 365

# 4) Solo borrar (sin archivar; emergencia)
npm run downloadHistory:purge -- --apply --mode delete-only --keep-days 365

# 5) Plan de particiones (dry-run)
npm run downloadHistory:partitions -- --table download_history_archive --months-history 2 --months-ahead 6

# 6) Bootstrap de particiones (una sola vez por tabla)
npm run downloadHistory:partitions -- --apply --bootstrap --table download_history_archive --months-history 2 --months-ahead 6

# 7) Mantenimiento de particiones (agrega futuras)
npm run downloadHistory:partitions -- --apply --table download_history_archive --months-history 2 --months-ahead 6

# 8) Limpieza por partición (retener 18 meses en archivo)
npm run downloadHistory:partitions -- --apply --table download_history_archive --drop-older-than-months 18
```

## Calendario operativo recomendado
1. Diario (madrugada):
- `downloadHistory:purge -- --apply --keep-days 365 --batch 5000 --sleep-ms 50`

2. Semanal:
- `downloadHistory:partitions -- --apply --table download_history_archive --months-history 2 --months-ahead 6`

3. Mensual:
- `downloadHistory:partitions -- --apply --table download_history_archive --drop-older-than-months 18`

## Guardrails para producción
1. Ejecutar siempre dry-run primero y revisar conteos.
2. Usar `--max-batches` en ventanas cortas para limitar impacto:

```bash
npm run downloadHistory:purge -- --apply --keep-days 365 --batch 3000 --sleep-ms 75 --max-batches 200
```

3. Si la base va al límite, subir `sleep-ms` y bajar `batch`.
4. Evitar `delete-only` salvo incidentes puntuales.
5. `--bootstrap` de particiones puede tomar lock de tabla; ejecutar en ventana de bajo tráfico.

## Validaciones SQL rápidas
```sql
-- Filas viejas activas
SELECT COUNT(*)
FROM download_history
WHERE date < (UTC_TIMESTAMP() - INTERVAL 365 DAY);

-- Filas archivadas viejas
SELECT COUNT(*)
FROM download_history_archive
WHERE date < (UTC_TIMESTAMP() - INTERVAL 365 DAY);

-- Top crecimiento diario
SELECT DATE(date) AS day, COUNT(*) AS rows
FROM download_history
GROUP BY DATE(date)
ORDER BY day DESC
LIMIT 14;

-- Particiones actuales
SELECT PARTITION_NAME, PARTITION_DESCRIPTION
FROM information_schema.PARTITIONS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'download_history_archive'
ORDER BY PARTITION_ORDINAL_POSITION;
```

## Rollback operativo
1. Si falla particionado:
- correr script sin `--apply` para inspeccionar SQL.
- corregir y reintentar en ventana de bajo tráfico.

2. Si falla purge en mitad:
- reintentar; `archive-delete` es idempotente por llave única `sourceId + date`.
- no hay riesgo de duplicar filas en `download_history_archive`.

3. Si se requiere parar inmediatamente:
- detener cron/worker del script.
- no afecta rutas online del backend (solo mantenimiento DB).
