import trpc from "../../../api";
import { useEffect, useState } from "react";
import "./CatalogStats.scss";
import { Spinner } from "../../../components/Spinner/Spinner";

interface CatalogStatsData {
  error?: string;
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
    trpc.ftp.catalogStats
      .query()
      .then((res) => {
        if (!cancelled) {
          setData(res as CatalogStatsData);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData({
            error: "No se pudo cargar. ¿Tienes sesión de admin?",
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
        <p className="catalog-stats__error">{data.error}</p>
      )}
      <div className="catalog-stats__grid">
        <div className="catalog-stats__card">
          <h2>Géneros</h2>
          <p className="catalog-stats__number">{data.genres.length}</p>
          <ul className="catalog-stats__genres">
            {data.genres.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
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
