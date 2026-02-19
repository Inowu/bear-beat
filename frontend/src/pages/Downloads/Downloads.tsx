import React, { useEffect, useState } from "react";
import { FolderDown, Music, RefreshCw } from "src/icons";
import { IDownloads } from "interfaces/Files";
import trpc from "../../api";
import { Button, EmptyState, SkeletonCard, SkeletonTable } from "../../components/ui";

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
    <div className="w-full bb-surface bb-app-page">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <FolderDown className="h-6 w-6 flex-shrink-0 text-bear-cyan" aria-hidden />
          <h1 className="text-text-main font-bold">Historial de descargas</h1>
        </div>
      </header>

      {isError && (
        <div className="min-h-[240px] flex items-center justify-center">
          <EmptyState
            variant="connection-error"
            description={loadError}
            action={
              <Button variant="secondary" leftIcon={<RefreshCw size={18} />} onClick={() => void retrieveDownloads()}>
                Reintentar
              </Button>
            }
          />
        </div>
      )}

      {isLoading && (
        <div className="grid gap-4" role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">Actualizando historial de descargas</span>
          <div className="hidden md:block rounded-xl border border-border overflow-hidden p-4 bg-bg-card">
            <SkeletonTable />
          </div>
          <div className="grid md:hidden gap-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <SkeletonCard key={`dl-sk-${idx}`} />
            ))}
          </div>
        </div>
      )}

      {isEmpty && (
        <div className="min-h-[260px] flex items-center justify-center">
          <EmptyState variant="downloads-empty" />
        </div>
      )}

      {/* Vista Escritorio: tabla real */}
      <div
        className={`hidden md:block rounded-xl border border-border overflow-hidden ${
          isLoading || isEmpty || isError ? "hidden" : ""
        } bb-skeleton-fade-in`}
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
      <div
        className={`block md:hidden grid grid-cols-1 gap-4 ${
          isLoading || isEmpty || isError ? "hidden" : ""
        } bb-skeleton-fade-in`}
      >
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
