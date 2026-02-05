import { useEffect, useState } from "react";
import trpc from "../../../api";
import { getCompleted, transformBiteToGb } from "../../../functions/functions";
import "./Storage.scss";
import { Spinner } from "../../../components/Spinner/Spinner";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";

export const Storage = () => {
  const [storage, setStorage] = useState<any>({
    used_storage: 0,
    total_storage: 0,
    available_storage: 0,
    reserved_space: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const getStorage = async () => {
    try {
      let data = await trpc.ftp.storage.query();
      const reservedSpace = data.total_storage * 0.05;
      setStorage({ ...data, reserved_space: reservedSpace });
    } catch (error) {
      console.log(error);
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
    <AdminPageLayout title="Almacenamiento del servidor">
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size={3} width={0.3} color="var(--app-accent)" />
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-bear-dark-100 bg-bear-light-100 dark:bg-bear-dark-500/80 p-6 max-w-2xl">
          <h2 className="text-bear-dark-900 dark:text-white font-bold text-lg mb-4 font-poppins">
            Espacio usado
          </h2>
          <p className="text-gray-700 dark:text-gray-300 text-sm mb-4">
            {transformBiteToGb(storage.used_storage)} GB de {transformBiteToGb(storage.total_storage)} GB
          </p>
          <div className="h-4 rounded-lg bg-gray-200 dark:bg-bear-dark-100 overflow-hidden flex">
            <div
              className="bg-gray-400 dark:bg-bear-dark-300 shrink-0"
              style={{ width: "5%", minWidth: "5%" }}
              title="Reservado"
            />
            <div
              className="bg-bear-cyan transition-all duration-500"
              style={{ width: barWidth }}
            />
          </div>
          <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>Espacio reservado: <span className="text-gray-700 dark:text-gray-300">{transformBiteToGb(storage.reserved_space)} GB</span></p>
            <p>Espacio disponible: <span className="text-gray-700 dark:text-gray-300">{transformBiteToGb(storage.available_storage)} GB</span></p>
          </div>
        </div>
      )}
    </AdminPageLayout>
  );
};
