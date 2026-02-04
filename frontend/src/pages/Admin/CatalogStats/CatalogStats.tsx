import { useEffect, useState } from "react";
import "./CatalogStats.scss";
import { Spinner } from "../../../components/Spinner/Spinner";

const API_BASE =
  process.env.REACT_APP_ENVIRONMENT === "development"
    ? "http://localhost:5001"
    : "https://thebearbeatapi.lat";

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
            ...emptyData,
            error: msg
              ? msg === "No autorizado"
                ? "Inicia sesión para ver las estadísticas."
                : `Error: ${msg}`
              : "No se pudo cargar (revisa que estés logueado y que el servidor tenga SONGS_PATH configurado).",
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
          <p className="catalog-stats__number">{data.totalGenres.toLocaleString()}</p>
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

      {data.genresDetail.length > 0 && (
        <>
          <h2 className="catalog-stats__section-title">Por género (carpeta donde están los archivos)</h2>
          <p className="catalog-stats__hint">
            Cada género = nombre de la carpeta que contiene los archivos (ej. Bachata en /Videos/2026/Enero/4/Bachata).
          </p>
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
                {data.genresDetail.map((g) => (
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
