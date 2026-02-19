import { useEffect, useState, useCallback } from "react";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import { Alert } from "../../../components/ui/Alert/Alert";
import { SkeletonRow, SkeletonTable, Button } from "../../../components/ui";
import { getAccessToken } from "../../../utils/authStorage";

const API_BASE =
  process.env.REACT_APP_ENVIRONMENT === "development"
    ? "http://localhost:5001"
    : "https://thebearbeatapi.lat";

const CACHE_KEY = "catalog-stats-cache";
const PAGE_SIZE = 50;

interface GenreStats {
  name: string;
  files: number;
  gb: number;
}

interface CatalogStatsData {
  error?: string;
  totalFiles: number;
  totalGB: number;
  videos: number;
  audios: number;
  karaokes: number;
  other: number;
  gbVideos: number;
  gbAudios: number;
  gbKaraokes: number;
  totalGenres: number;
  genresDetail: GenreStats[];
}

const emptyData: CatalogStatsData = {
  totalFiles: 0,
  totalGB: 0,
  videos: 0,
  audios: 0,
  karaokes: 0,
  other: 0,
  gbVideos: 0,
  gbAudios: 0,
  gbKaraokes: 0,
  totalGenres: 0,
  genresDetail: [],
};

function normalizeCatalogResponse(res: Record<string, unknown>): CatalogStatsData {
  const genresDetail = Array.isArray(res.genresDetail)
    ? (res.genresDetail as GenreStats[])
    : Array.isArray(res.genres)
      ? (res.genres as string[]).map((name: string) => ({ name, files: 0, gb: 0 }))
      : [];
  const totalGenres = typeof res.totalGenres === "number" ? res.totalGenres : genresDetail.length;
  return {
    error: typeof res.error === "string" ? res.error : undefined,
    totalFiles: Number(res.totalFiles) || 0,
    totalGB: Number(res.totalGB) || 0,
    videos: Number(res.videos) || 0,
    audios: Number(res.audios) || 0,
    karaokes: Number(res.karaokes) || 0,
    other: Number(res.other) || 0,
    gbVideos: Number(res.gbVideos) || 0,
    gbAudios: Number(res.gbAudios) || 0,
    gbKaraokes: Number(res.gbKaraokes) || 0,
    totalGenres,
    genresDetail,
  };
}

function loadFromCache(): { data: CatalogStatsData; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: Record<string, unknown>; savedAt: number };
    return { data: normalizeCatalogResponse(parsed.data), savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

function saveToCache(data: CatalogStatsData) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // ignore
  }
}

export function CatalogStats() {
  const [data, setData] = useState<CatalogStatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [genrePage, setGenrePage] = useState(0);

  const fetchStats = useCallback((refresh = false) => {
    setLoading(true);
    const token = getAccessToken() ?? "";
    const url = `${API_BASE}/api/catalog-stats${refresh ? "?refresh=1" : ""}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 401 ? "No autorizado" : `Error ${res.status}`);
        return res.json();
      })
      .then((res) => {
        const normalized = normalizeCatalogResponse(res);
        setData(normalized);
        setSavedAt(Date.now());
        saveToCache(normalized);
        setGenrePage(0);
      })
      .catch((err: unknown) => {
        const msg = (err as { message?: string })?.message;
        setData({
          ...emptyData,
          error: msg
            ? msg === "No autorizado"
              ? "Inicia sesión para ver las estadísticas."
              : `Error: ${msg}`
            : "No se pudo cargar (revisa que estés logueado y que el servidor tenga SONGS_PATH configurado).",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const cached = loadFromCache();
    if (cached) {
      setData(cached.data);
      setSavedAt(cached.savedAt);
    } else {
      setData(null);
      setSavedAt(null);
    }
  }, []);

  const handleExportCsv = useCallback(() => {
    if (!data) return;
    const rows: string[] = [
      "Sección;Valor",
      "Archivos totales;" + data.totalFiles,
      "GB totales;" + data.totalGB,
      "Videos (archivos);" + data.videos,
      "Videos (GB);" + data.gbVideos,
      "Audios (archivos);" + data.audios,
      "Audios (GB);" + data.gbAudios,
      "Karaokes (archivos);" + data.karaokes,
      "Karaokes (GB);" + data.gbKaraokes,
      "Otros;" + data.other,
      "Géneros únicos;" + data.totalGenres,
      "",
      "Género;Archivos;GB",
      ...(data.genresDetail ?? []).map((g) => `${g.name};${g.files};${g.gb}`),
    ];
    const csv = rows.join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `catalog-stats-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [data]);

  if (data === null && !loading) {
    return (
      <AdminPageLayout
        title="Estadísticas del catálogo"
        subtitle="Visualiza volumen real por tipo y género para decidir qué contenido impulsar cada semana."
        toolbar={
          <Button unstyled
            type="button"
            onClick={() => fetchStats(true)}
            className="bg-bear-gradient hover:opacity-95 text-bear-dark-500 font-medium rounded-lg px-4 py-2 transition-opacity"
          >
            Actualizar estadísticas
          </Button>
        }
      >
        <p className="text-text-muted py-8">No hay datos guardados. Haz clic en Actualizar para cargar (puede tardar unos segundos).</p>
      </AdminPageLayout>
    );
  }

  if (loading && !data) {
    return (
      <AdminPageLayout
        title="Estadísticas del catálogo"
        subtitle="Visualiza volumen real por tipo y género para decidir qué contenido impulsar cada semana."
      >
        <div className="flex flex-col items-center justify-center py-12 gap-4" role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">Actualizando estadísticas del catálogo</span>
          <div className="w-full max-w-[760px]">
            <SkeletonTable />
          </div>
        </div>
      </AdminPageLayout>
    );
  }

  if (!data) return null;

  const genres = data.genresDetail ?? [];
  const totalPages = Math.max(1, Math.ceil(genres.length / PAGE_SIZE));
  const page = Math.min(genrePage, totalPages - 1);
  const pageGenres = genres.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const from = page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, genres.length);

  const toolbar = (
    <div className="flex flex-wrap items-center gap-3">
      {savedAt && (
        <span className="text-text-muted text-sm">Datos del {new Date(savedAt).toLocaleString("es")}</span>
      )}
      <Button unstyled
        type="button"
        onClick={() => fetchStats(true)}
        disabled={loading}
        aria-label={loading ? "Actualizando estadísticas del catálogo" : undefined}
        className="bg-bear-gradient hover:opacity-95 text-bear-dark-500 font-medium rounded-lg px-4 py-2 transition-opacity disabled:opacity-50"
      >
        {loading ? <SkeletonRow width="86px" height="14px" /> : "Actualizar"}
      </Button>
      <Button unstyled
        type="button"
        onClick={handleExportCsv}
        className="bg-bg-card hover:bg-bg-input text-text-main font-medium rounded-lg px-4 py-2 border border-border transition-colors"
      >
        Exportar CSV
      </Button>
    </div>
  );

  return (
    <AdminPageLayout
      title="Estadísticas del catálogo"
      subtitle="Visualiza volumen real por tipo y género para decidir qué contenido impulsar cada semana."
      toolbar={toolbar}
    >
      <div className="bb-skeleton-fade-in">
        {data.error && (
          <Alert tone="warning" className="mb-6">
            <p className="text-sm">{data.error}</p>
            {data.totalFiles === 0 && (
              <p className="text-text-muted text-xs mt-2">
                Configura SONGS_PATH en el servidor o revisa el acceso al catálogo FTP.
              </p>
            )}
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl border border-border bg-bg-card p-4">
            <h2 className="text-text-muted text-xs uppercase tracking-wider mb-1">Archivos totales</h2>
            <p className="text-text-main text-2xl font-bold">{data.totalFiles.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-border bg-bg-card p-4">
            <h2 className="text-text-muted text-xs uppercase tracking-wider mb-1">GB totales</h2>
            <p className="text-text-main text-2xl font-bold">{data.totalGB.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-border bg-bg-card p-4">
            <h2 className="text-text-muted text-xs uppercase tracking-wider mb-1">Géneros únicos</h2>
            <p className="text-text-main text-2xl font-bold">{(data.totalGenres ?? 0).toLocaleString()}</p>
          </div>
        </div>

        <h2 className="text-text-main font-bold text-lg mb-4 font-ui">Por tipo</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-border bg-bg-card p-4">
            <h3 className="text-text-muted text-sm mb-1">Videos</h3>
            <p className="text-text-main text-sm">{data.videos.toLocaleString()} archivos · {data.gbVideos.toLocaleString()} GB</p>
          </div>
          <div className="rounded-xl border border-border bg-bg-card p-4">
            <h3 className="text-text-muted text-sm mb-1">Audios</h3>
            <p className="text-text-main text-sm">{data.audios.toLocaleString()} archivos · {data.gbAudios.toLocaleString()} GB</p>
          </div>
          <div className="rounded-xl border border-border bg-bg-card p-4">
            <h3 className="text-text-muted text-sm mb-1">Karaokes</h3>
            <p className="text-text-main text-sm">{data.karaokes.toLocaleString()} archivos · {data.gbKaraokes.toLocaleString()} GB</p>
          </div>
          <div className="rounded-xl border border-border bg-bg-card p-4">
            <h3 className="text-text-muted text-sm mb-1">Otros</h3>
            <p className="text-text-main text-sm">{data.other.toLocaleString()} archivos</p>
          </div>
        </div>

        {genres.length > 0 && (
          <>
            <h2 className="text-text-main font-bold text-lg mb-2 font-ui">Por género</h2>
            <p className="text-text-muted text-sm mb-4">Cada género = nombre de la carpeta (ej. Bachata).</p>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <span className="text-text-muted text-sm">Mostrando {from}-{to} de {genres.length}</span>
              <div className="flex items-center gap-2">
                <Button unstyled
                  type="button"
                  disabled={page <= 0}
                  onClick={() => setGenrePage((p) => Math.max(0, p - 1))}
                  className="bg-bg-card hover:bg-bg-input disabled:opacity-50 text-text-main text-sm rounded-lg px-3 py-1.5 border border-border transition-colors"
                >
                  Anterior
                </Button>
                <span className="text-text-muted text-sm">Página {page + 1} de {totalPages}</span>
                <Button unstyled
                  type="button"
                  disabled={page >= totalPages - 1}
                  onClick={() => setGenrePage((p) => Math.min(totalPages - 1, p + 1))}
                  className="bg-bg-card hover:bg-bg-input disabled:opacity-50 text-text-main text-sm rounded-lg px-3 py-1.5 border border-border transition-colors"
                >
                  Siguiente
                </Button>
              </div>
            </div>
            <div className="admin-table-panel">
              <div
                className="overflow-x-auto max-h-[50vh] overflow-y-auto"
                tabIndex={0}
                role="region"
                aria-label="Tabla de catálogo por género (desliza para ver más)"
                data-scroll-region
              >
                <table className="w-full">
                  <thead className="sticky top-0">
                    <tr>
                      <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Género</th>
                      <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Archivos</th>
                      <th className="uppercase text-xs tracking-wider text-left py-3 px-4">GB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageGenres.map((g) => (
                      <tr key={g.name} className="border-b transition-colors">
                        <td className="py-3 px-4 text-sm">{g.name}</td>
                        <td className="py-3 px-4 text-sm">{g.files.toLocaleString()}</td>
                        <td className="py-3 px-4 text-sm">{g.gb.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminPageLayout>
  );
}
