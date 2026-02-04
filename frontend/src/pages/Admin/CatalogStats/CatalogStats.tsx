import { useEffect, useState } from "react";
import "./CatalogStats.scss";
import { Spinner } from "../../../components/Spinner/Spinner";

const API_BASE =
  process.env.REACT_APP_ENVIRONMENT === "development"
    ? "http://localhost:5001"
    : "https://thebearbeatapi.lat";

interface CatalogStatsData {
  error?: string;
  rootFolders?: string[];
  genresByType?: Record<string, string[]>;
  genres: string[];
  totalFiles: number;
  totalGB: number;
  videos: number;
  audios: number;
  karaokes: number;
  other: number;
}

export function CatalogStats() {
  const [data, setData] = useState<CatalogStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token") ?? "";
    fetch(`${API_BASE}/api/catalog-stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 401 ? "No autorizado" : `Error ${res.status}`);
        return res.json();
      })
      .then((res) => {
        if (!cancelled) setData(res as CatalogStatsData);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = (err as { message?: string })?.message;
          setData({
            error: msg
              ? msg === "No autorizado"
                ? "Inicia sesión para ver las estadísticas."
                : `Error: ${msg}`
              : "No se pudo cargar (revisa que estés logueado y que el servidor tenga SONGS_PATH configurado).",
            rootFolders: [],
            genresByType: {},
            genres: [],
            totalFiles: 0,
            totalGB: 0,
            videos: 0,
            audios: 0,
            karaokes: 0,
            other: 0,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="catalog-stats catalog-stats--loading">
        <Spinner size={3} width={0.3} color="#00e2f7" />
        <p>Calculando estadísticas del catálogo… puede tardar unos segundos.</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="catalog-stats">
      <h1 className="catalog-stats__title">Estadísticas del catálogo</h1>
      {data.error && (
        <div className="catalog-stats__error-wrap">
          <p className="catalog-stats__error">{data.error}</p>
          {data.totalFiles === 0 && data.genres.length === 0 && (
            <p className="catalog-stats__error-hint">
              Si todo está en 0, en el servidor falta configurar SONGS_PATH o el backend no tiene acceso al catálogo FTP.
            </p>
          )}
        </div>
      )}
      {(data.rootFolders?.length ?? 0) > 0 && (
        <div className="catalog-stats__structure">
          <h2>Carpetas en la raíz</h2>
          <p className="catalog-stats__number">{data.rootFolders!.length}</p>
          <ul className="catalog-stats__root-folders">
            {data.rootFolders!.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <h3>Géneros (subcarpetas dentro de cada tipo)</h3>
          <ul className="catalog-stats__genres-by-type">
            {data.rootFolders!.map((folder) => {
              const genresList = data.genresByType?.[folder] ?? [];
              return (
                <li key={folder} className="catalog-stats__type-block">
                  <span className="catalog-stats__type-name">[{folder}]</span>
                  <span className="catalog-stats__type-count">({genresList.length} géneros)</span>
                  <ul className="catalog-stats__genres-inline">
                    {genresList.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="catalog-stats__grid">
        <div className="catalog-stats__card">
          <h2>Géneros (total único)</h2>
          <p className="catalog-stats__number">{data.genres.length}</p>
        </div>
        <div className="catalog-stats__card">
          <h2>Archivos totales</h2>
          <p className="catalog-stats__number">{data.totalFiles.toLocaleString()}</p>
        </div>
        <div className="catalog-stats__card">
          <h2>GB totales</h2>
          <p className="catalog-stats__number">{data.totalGB.toLocaleString()}</p>
        </div>
        <div className="catalog-stats__card">
          <h2>Videos</h2>
          <p className="catalog-stats__number">{data.videos.toLocaleString()}</p>
        </div>
        <div className="catalog-stats__card">
          <h2>Audios</h2>
          <p className="catalog-stats__number">{data.audios.toLocaleString()}</p>
        </div>
        <div className="catalog-stats__card">
          <h2>Karaokes</h2>
          <p className="catalog-stats__number">{data.karaokes.toLocaleString()}</p>
        </div>
        <div className="catalog-stats__card">
          <h2>Otros</h2>
          <p className="catalog-stats__number">{data.other.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
