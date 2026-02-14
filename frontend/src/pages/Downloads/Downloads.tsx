import React, { useEffect, useState } from "react";
import { FolderDown, Music } from "src/icons";
import { IDownloads } from "interfaces/Files";
import trpc from "../../api";
import { Spinner } from "../../components/Spinner/Spinner";
import { Button, EmptyState } from "../../components/ui";
import { RefreshCw, AlertTriangle } from "src/icons";

function Downloads() {
  const [downloads, setDownloads] = useState<IDownloads[] | null>(null);
  const [loadError, setLoadError] = useState<string>("");

  const retrieveDownloads = async () => {
    try {
      setLoadError("");
      const data = await trpc.dirDownloads.myDirDownloads.query();
      setDownloads(data);
    } catch (error: unknown) {
      setDownloads(null);
      setLoadError("No pudimos cargar tu historial de descargas. Intenta de nuevo.");
    }
  };

  useEffect(() => {
    retrieveDownloads();
  }, []);

  const isError = Boolean(loadError);
  const isLoading = downloads === null && !isError;
  const isEmpty = downloads !== null && downloads.length === 0 && !isError;

  return (
    <div className="w-full bb-surface">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <FolderDown className="h-6 w-6 flex-shrink-0 text-bear-cyan" aria-hidden />
          <h1 className="text-text-main font-bold">Historial de descargas</h1>
        </div>
      </header>

      {isError && (
        <div className="min-h-[240px] flex items-center justify-center">
          <EmptyState
            tone="danger"
            icon={<AlertTriangle size={22} />}
            title="No se pudo cargar"
            description={loadError}
            action={
              <Button variant="secondary" leftIcon={<RefreshCw size={18} />} onClick={() => void retrieveDownloads()}>
                Reintentar
              </Button>
            }
          />
        </div>
      )}

      {(isLoading || isEmpty) && (
        <div className="min-h-[260px] flex items-center justify-center">
          <div
            className={`app-state-panel ${isLoading ? "is-loading" : "is-empty"}`}
            role={isLoading ? "status" : "note"}
            aria-live={isLoading ? "polite" : undefined}
          >
            <span className="app-state-icon" aria-hidden>
              {isLoading ? (
                <Spinner size={2.6} width={0.25} color="var(--app-accent)" />
              ) : (
                <Music />
              )}
            </span>
            <h2 className="app-state-title">
              {isLoading ? "Cargando descargas" : "Aún no hay descargas"}
            </h2>
            <p className="app-state-copy">
              {isLoading
                ? "Estamos preparando tu historial."
                : "Cuando descargues carpetas o archivos, aparecerán aquí."}
            </p>
          </div>
        </div>
      )}

      {/* Vista Escritorio: tabla real */}
      <div
        className={`hidden md:block rounded-xl border border-border overflow-hidden ${
          isLoading || isEmpty || isError ? "hidden" : ""
        }`}
      >
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="bg-bg-input text-text-muted text-xs uppercase tracking-wider p-4 text-left font-medium border-b border-border">
                Nombre
              </th>
              <th className="bg-bg-input text-text-muted text-xs uppercase tracking-wider p-4 text-left font-medium border-b border-border">
                Descargado
              </th>
            </tr>
          </thead>
          <tbody className="bg-bg-card divide-y divide-border">
            {downloads !== null && downloads.length > 0 &&
              downloads.map((download: IDownloads, index: number) => (
                <tr
                  key={`download-${index}`}
                  className="transition-colors"
                >
                  <td className="py-4 px-4 text-sm text-text-main">
                    <span className="flex items-center gap-3 min-w-0">
                      <Music className="h-5 w-5 flex-shrink-0 text-bear-cyan" aria-hidden />
                      <span className="truncate">{download.dirName}</span>
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm text-text-main whitespace-nowrap">
                    {download.date.toLocaleDateString()}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Vista Móvil: tarjetas */}
      <div className={`block md:hidden grid grid-cols-1 gap-4 ${isLoading || isEmpty || isError ? "hidden" : ""}`}>
        {downloads !== null && downloads.length > 0 &&
          downloads.map((download: IDownloads, index: number) => (
            <div
              key={`download-card-${index}`}
              className="bg-bg-card p-4 rounded-2xl border border-border shadow-none"
              style={{ boxShadow: "var(--app-shadow)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Music className="h-5 w-5 flex-shrink-0 text-bear-cyan" aria-hidden />
                  <p className="text-sm text-text-main truncate">{download.dirName}</p>
                </div>
                <p className="text-sm text-text-muted flex-shrink-0">
                  {download.date.toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

export default Downloads;
