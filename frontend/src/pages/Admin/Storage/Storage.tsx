import { useEffect, useState } from "react";
import trpc from "../../../api";
import { getCompleted, transformBiteToGb } from "../../../functions/functions";
import { Spinner } from "../../../components/Spinner/Spinner";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import { Alert } from "../../../components/ui";

export const Storage = () => {
  const [storage, setStorage] = useState<any>({
    used_storage: 0,
    total_storage: 0,
    available_storage: 0,
    reserved_space: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const getStorage = async () => {
    try {
      let data = await trpc.ftp.storage.query();
      const reservedSpace = data.total_storage * 0.05;
      setStorage({ ...data, reserved_space: reservedSpace });
      setLoadError(data?.degraded ? "No pudimos obtener las métricas del servidor. Mostrando valores en 0 por ahora." : null);
    } catch (error) {
      setLoadError("No pudimos obtener las métricas del servidor. Mostrando valores en 0 por ahora.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getStorage();
  }, []);

  const pct = getCompleted(storage.used_storage, storage.total_storage);
  const barWidth = pct > 5 ? pct + "%" : "5%";

  return (
    <AdminPageLayout
      title="Almacenamiento del servidor"
      subtitle="Controla capacidad, reserva técnica y disponibilidad para evitar interrupciones operativas."
    >
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size={3} width={0.3} color="var(--app-accent)" />
        </div>
      ) : (
        <div className="rounded-xl border bg-bg-card p-6 max-w-2xl">
          {loadError && (
            <Alert tone="warning" title="Métricas degradadas" className="mb-4">
              {loadError}
            </Alert>
          )}
          <h2 className="font-bold text-lg mb-4 text-text-main">Espacio usado</h2>
          <p className="text-sm mb-4 text-text-muted">
            {transformBiteToGb(storage.used_storage)} GB de {transformBiteToGb(storage.total_storage)} GB
          </p>
          <div className="h-4 rounded-lg bg-bg-input overflow-hidden flex">
            <div
              className="shrink-0"
              style={{ width: "5%", minWidth: "5%", background: "var(--app-status-warning)" }}
              title="Reservado"
            />
            <div
              className="transition-all duration-500"
              style={{ width: barWidth, background: "var(--app-accent)" }}
            />
          </div>
          <div className="mt-4 space-y-2 text-sm text-text-muted">
            <p>
              Espacio reservado:{" "}
              <span className="text-text-main">{transformBiteToGb(storage.reserved_space)} GB</span>
            </p>
            <p>
              Espacio disponible:{" "}
              <span className="text-text-main">{transformBiteToGb(storage.available_storage)} GB</span>
            </p>
          </div>
        </div>
      )}
    </AdminPageLayout>
  );
};
