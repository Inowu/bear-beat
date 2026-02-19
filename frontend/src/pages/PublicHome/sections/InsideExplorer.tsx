import { useMemo, useState } from "react";
import { Input } from "src/components/ui";
import { inferTrackMetadata } from "../../../utils/fileMetadata";

export type PublicExplorerPreviewFile = {
  path: string;
  name: string;
};

export type PublicExplorerPreviewSnapshot = {
  generatedAt: string;
  sourceFolderPath: string | null;
  sourceFolderName: string | null;
  explorerPath: string[];
  files: PublicExplorerPreviewFile[];
  stale: boolean;
};

const FALLBACK_EXPLORER_PATH = ["Audios", "2026", "Febrero", "Semana 1", "Reggaeton"];

const FALLBACK_EXPLORER_FILES: PublicExplorerPreviewFile[] = [
  {
    path: "Audios/2026/Febrero/Semana 1/Reggaeton/Bellakath ft. Gotay - Si te digo que si (7A - 87 BPM).mp3",
    name: "Bellakath ft. Gotay - Si te digo que si (7A - 87 BPM).mp3",
  },
  {
    path: "Audios/2026/Febrero/Semana 1/Reggaeton/Blessd x J Alvarez - Fanatico (6A - 98 BPM).mp3",
    name: "Blessd x J Alvarez - Fanatico (6A - 98 BPM).mp3",
  },
  {
    path: "Audios/2026/Febrero/Semana 1/Reggaeton/Cael Roldan - Gafas Prada (3A - 102 BPM).mp3",
    name: "Cael Roldan - Gafas Prada (3A - 102 BPM).mp3",
  },
];

function normalizeText(value: string): string {
  return `${value ?? ""}`.trim().toLowerCase();
}

function inferExplorerPath(snapshot: PublicExplorerPreviewSnapshot | null): string[] {
  const explicit = Array.isArray(snapshot?.explorerPath)
    ? snapshot.explorerPath.filter((segment) => `${segment ?? ""}`.trim())
    : [];
  if (explicit.length > 0) return explicit;

  const firstPath = `${snapshot?.files?.[0]?.path ?? ""}`
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
  if (!firstPath) return [];

  const parts = firstPath.split("/").filter(Boolean);
  if (parts.length <= 1) return [];
  return parts.slice(0, -1);
}

export default function InsideExplorer(props: {
  snapshot: PublicExplorerPreviewSnapshot | null;
  loading: boolean;
}) {
  const { snapshot, loading } = props;
  const [query, setQuery] = useState("");

  const explorerPath = useMemo(() => {
    const inferred = inferExplorerPath(snapshot);
    return inferred.length > 0 ? inferred : FALLBACK_EXPLORER_PATH;
  }, [snapshot]);

  const sourceRows = useMemo(() => {
    const source = Array.isArray(snapshot?.files) ? snapshot.files : [];
    if (source.length > 0) return source;
    return FALLBACK_EXPLORER_FILES;
  }, [snapshot?.files]);

  const rows = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return sourceRows
      .filter((row) => {
        if (!normalizedQuery) return true;
        const haystack = normalizeText(`${row.name} ${row.path}`);
        return haystack.includes(normalizedQuery);
      })
      .map((row) => {
        const metadata = inferTrackMetadata(row.name);
        return {
          ...row,
          bpm: metadata.bpm,
          camelot: metadata.camelot,
        };
      });
  }, [query, sourceRows]);

  const hasData = rows.length > 0;

  return (
    <section id="inside-explorer" className="inside-explorer" aria-label="Así se ve por dentro">
      <div className="ph__container">
        <div className="inside-explorer__head">
          <h2 className="home-h2" tabIndex={-1}>
            Así se ve tu librería lista para cabina
          </h2>
          <p className="home-sub">
            Carpetas por año/mes/semana y nombres con BPM + Key para mezclar en segundos.
          </p>
        </div>

        <div className="inside-explorer__card bb-market-surface">
          <div className="inside-explorer__toolbar" aria-hidden>
            <span>Explorador Bear Beat</span>
            {snapshot?.stale && <span className="inside-explorer__stale">Sincronizando…</span>}
          </div>

          <div className="inside-explorer__path" aria-label="Ruta actual del explorador">
            {explorerPath.map((segment, index) => (
              <span
                key={`${segment}-${index}`}
                className={`inside-explorer__path-segment ${
                  index === explorerPath.length - 1 ? "is-current" : ""
                }`}
              >
                {segment}
              </span>
            ))}
          </div>

          <label className="inside-explorer__search" htmlFor="inside-explorer-search">
            <Input
              id="inside-explorer-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filtrar por canción o artista"
              className="inside-explorer__search-input"
              aria-label="Filtrar archivos del explorador"
            />
          </label>

          {loading ? (
            <p className="inside-explorer__empty">Cargando snapshot real del catálogo…</p>
          ) : hasData ? (
            <ul className="inside-explorer__rows" aria-label="Archivos del explorador">
              {rows.map((row) => (
                <li key={row.path} className="inside-explorer__row">
                  <span className="inside-explorer__name" title={row.name}>
                    {row.name}
                  </span>
                  <span className="inside-explorer__meta">
                    {row.camelot && <span>{row.camelot}</span>}
                    {row.bpm && <span>{row.bpm} BPM</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="inside-explorer__empty">
              No hay coincidencias con ese filtro. Prueba por artista, track o género.
            </p>
          )}
        </div>

        <p className="inside-explorer__proof">
          BPM y Key ya incluidos en el nombre. Arrástralos a <strong>Serato</strong>,{" "}
          <strong>Rekordbox</strong> o <strong>Virtual DJ</strong> sin preparar nada.
        </p>
      </div>
    </section>
  );
}
