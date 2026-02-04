import { useEffect, useState, useCallback } from "react";
import "./CatalogStats.scss";
import { Spinner } from "../../../components/Spinner/Spinner";

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

/** Normaliza la respuesta del API (soporta formato nuevo y antiguo) para no romper con e.genres.length */
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
    const token = localStorage.getItem("token") ?? "";
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
      <div className="catalog-stats catalog-stats--empty">
        <h1 className="catalog-stats__title">Estadísticas del catálogo</h1>
        <p className="catalog-stats__empty-msg">No hay datos guardados. Haz clic en Actualizar para cargar las estadísticas (puede tardar unos segundos).</p>
        <button type="button" className="catalog-stats__btn-refresh" onClick={() => fetchStats(true)}>
          Actualizar estadísticas
        </button>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="catalog-stats catalog-stats--loading">
        <Spinner size={3} width={0.3} color="#00e2f7" />
        <p>Calculando estadísticas del catálogo… puede tardar unos segundos.</p>
      </div>
    );
  }

  if (!data) return null;

  const genres = data.genresDetail ?? [];
  const totalPages = Math.max(1, Math.ceil(genres.length / PAGE_SIZE));
  const page = Math.min(genrePage, totalPages - 1);
  const pageGenres = genres.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const from = page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, genres.length);

  return (
    <div className="catalog-stats">
      <div className="catalog-stats__header-row">
        <h1 className="catalog-stats__title">Estadísticas del catálogo</h1>
        <div className="catalog-stats__actions">
          {savedAt && (
            <span className="catalog-stats__saved-at">
              Datos del {new Date(savedAt).toLocaleString("es")}
            </span>
          )}
          <button
            type="button"
            className="catalog-stats__btn-refresh"
            onClick={() => fetchStats(true)}
            disabled={loading}
          >
            {loading ? "Cargando…" : "Actualizar estadísticas"}
          </button>
          <button type="button" className="catalog-stats__btn-export" onClick={handleExportCsv}>
            Exportar CSV
          </button>
        </div>
      </div>

      {data.error && (
        <div className="catalog-stats__error-wrap">
          <p className="catalog-stats__error">{data.error}</p>
          {data.totalFiles === 0 && (
            <p className="catalog-stats__error-hint">
              Si todo está en 0, en el servidor falta configurar SONGS_PATH o el backend no tiene acceso al catálogo FTP.
            </p>
          )}
        </div>
      )}

      <div className="catalog-stats__grid">
        <div className="catalog-stats__card">
          <h2>Archivos totales</h2>
          <p className="catalog-stats__number">{data.totalFiles.toLocaleString()}</p>
        </div>
        <div className="catalog-stats__card">
          <h2>GB totales</h2>
          <p className="catalog-stats__number">{data.totalGB.toLocaleString()}</p>
        </div>
        <div className="catalog-stats__card">
          <h2>Géneros únicos</h2>
          <p className="catalog-stats__number">{(data.totalGenres ?? 0).toLocaleString()}</p>
        </div>
      </div>

      <h2 className="catalog-stats__section-title">Por tipo (archivos y GB)</h2>
      <div className="catalog-stats__grid">
        <div className="catalog-stats__card">
          <h3>Videos</h3>
          <p className="catalog-stats__number">{data.videos.toLocaleString()} archivos</p>
          <p className="catalog-stats__sub">{data.gbVideos.toLocaleString()} GB</p>
        </div>
        <div className="catalog-stats__card">
          <h3>Audios</h3>
          <p className="catalog-stats__number">{data.audios.toLocaleString()} archivos</p>
          <p className="catalog-stats__sub">{data.gbAudios.toLocaleString()} GB</p>
        </div>
        <div className="catalog-stats__card">
          <h3>Karaokes</h3>
          <p className="catalog-stats__number">{data.karaokes.toLocaleString()} archivos</p>
          <p className="catalog-stats__sub">{data.gbKaraokes.toLocaleString()} GB</p>
        </div>
        <div className="catalog-stats__card">
          <h3>Otros</h3>
          <p className="catalog-stats__number">{data.other.toLocaleString()} archivos</p>
        </div>
      </div>

      {genres.length > 0 && (
        <>
          <h2 className="catalog-stats__section-title">Por género (carpeta donde están los archivos)</h2>
          <p className="catalog-stats__hint">
            Cada género = nombre de la carpeta que contiene los archivos (ej. Bachata en /Videos/2026/Enero/4/Bachata).
          </p>
          <div className="catalog-stats__pagination">
            <span className="catalog-stats__pagination-info">
              Mostrando {from}-{to} de {genres.length}
            </span>
            <div className="catalog-stats__pagination-btns">
              <button
                type="button"
                disabled={page <= 0}
                onClick={() => setGenrePage((p) => Math.max(0, p - 1))}
              >
                Anterior
              </button>
              <span>
                Página {page + 1} de {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setGenrePage((p) => Math.min(totalPages - 1, p + 1))}
              >
                Siguiente
              </button>
            </div>
          </div>
          <div className="catalog-stats__table-wrap">
            <table className="catalog-stats__table">
              <thead>
                <tr>
                  <th>Género</th>
                  <th>Archivos</th>
                  <th>GB</th>
                </tr>
              </thead>
              <tbody>
                {pageGenres.map((g) => (
                  <tr key={g.name}>
                    <td>{g.name}</td>
                    <td>{g.files.toLocaleString()}</td>
                    <td>{g.gb.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
