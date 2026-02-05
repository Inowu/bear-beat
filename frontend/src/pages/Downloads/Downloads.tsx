import React, { useEffect, useState } from "react";
import { HiFolderArrowDown } from "react-icons/hi2";
import { FaMusic } from "react-icons/fa6";
import { IDownloads } from "interfaces/Files";
import trpc from "../../api";

function Downloads() {
  const [downloads, setDownloads] = useState<IDownloads[] | null>(null);

  const retrieveDownloads = async () => {
    try {
      const data = await trpc.dirDownloads.myDirDownloads.query();
      setDownloads(data);
    } catch (error: unknown) {
      console.error(error instanceof Error ? error.message : error);
    }
  };

  useEffect(() => {
    retrieveDownloads();
  }, []);

  return (
    <div className="w-full overflow-x-hidden">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <HiFolderArrowDown className="h-6 w-6 flex-shrink-0 text-bear-cyan" aria-hidden />
          <h2 className="text-base font-bold font-bear text-text-main">Historial de descargas</h2>
        </div>
      </header>

      {/* Vista Escritorio: tabla real */}
      <div className="hidden md:block rounded-xl border border-border overflow-hidden">
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
            {downloads !== null && downloads.length > 0 ? (
              downloads.map((download: IDownloads, index: number) => (
                <tr
                  key={`download-${index}`}
                  className="hover:bg-bear-cyan/10 transition-colors"
                >
                  <td className="py-4 px-4 text-sm text-text-main">
                    <span className="flex items-center gap-3 min-w-0">
                      <FaMusic className="h-5 w-5 flex-shrink-0 text-bear-cyan" aria-hidden />
                      <span className="truncate">{download.dirName}</span>
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm text-text-main whitespace-nowrap">
                    {download.date.toLocaleDateString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className="py-8 px-4 text-center text-sm text-text-muted">
                  {downloads === null ? "Cargando…" : "No hay descargas en tu historial."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Vista Móvil: tarjetas */}
      <div className="block md:hidden grid grid-cols-1 gap-4">
        {downloads !== null && downloads.length > 0 ? (
          downloads.map((download: IDownloads, index: number) => (
            <div
              key={`download-card-${index}`}
              className="bg-bg-card p-4 rounded-2xl border border-border shadow-lg"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <FaMusic className="h-5 w-5 flex-shrink-0 text-bear-cyan" aria-hidden />
                  <p className="text-sm text-text-main truncate">{download.dirName}</p>
                </div>
                <p className="text-sm text-text-muted flex-shrink-0">
                  {download.date.toLocaleDateString()}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-bg-card p-6 rounded-2xl border border-border shadow-lg text-center">
            <p className="text-sm text-text-muted">
              {downloads === null ? "Cargando…" : "No hay descargas en tu historial."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Downloads;
