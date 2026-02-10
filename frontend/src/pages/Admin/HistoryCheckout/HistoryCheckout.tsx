import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ARRAY_10 } from "../../../utils/Constants";
import trpc from "../../../api";
import { useUserContext } from "../../../contexts/UserContext";
import Pagination from "../../../components/Pagination/Pagination";
import CsvDownloader from "react-csv-downloader";
import { exportPayments } from "../fuctions";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import { AdminDrawer } from "../../../components/AdminDrawer/AdminDrawer";
import { Download, MoreVertical } from "lucide-react";
import { Select } from "../../../components/ui";

interface IAdminFilter {
  page: number;
  limit: number;
}

export const HistoryCheckout = () => {
  const { currentUser } = useUserContext();
  const navigate = useNavigate();
  const [history, setHistory] = useState<any[]>([]);
  const [totalLoader, setTotalLoader] = useState<boolean>(false);
  const [totalHistory, setTotalHistory] = useState(0);
  const [loader, setLoader] = useState<boolean>(true);
  const [filters, setFilters] = useState<IAdminFilter>({ page: 0, limit: 100 });
  const [drawerItem, setDrawerItem] = useState<any | null>(null);

  const startFilter = (key: string, value: string | number) => {
    const next = { ...filters, [key]: value };
    if (key !== "page") next.page = 0;
    setFilters(next);
    filterHistory(next);
  };

  const filterHistory = async (filt: IAdminFilter) => {
    setLoader(true);
    setTotalLoader(true);
    try {
      const tempHistory: any = await trpc.checkoutLogs.getCheckoutLogs.query({
        take: filt.limit,
        skip: filt.page * filt.limit,
        orderBy: { last_checkout_date: "desc" },
      });
      setHistory(tempHistory);
      const countRes: any = await trpc.checkoutLogs.getCheckoutLogs.query({ include: { id: true } });
      setTotalHistory(Array.isArray(countRes) ? countRes.length : 0);
    } catch (error) {
      console.log(error);
    } finally {
      setLoader(false);
      setTotalLoader(false);
    }
  };

  const transformHistoryData = async () => {
    try {
      const tempHistory: any = await exportPayments();
      return (tempHistory || []).map((his: any) => ({
        Usuario: his.users?.username,
        Correo: his.users?.email,
        Teléfono: his.users?.phone,
        "Última Fecha de pago": his.last_checkout_date?.toLocaleDateString?.(),
        Estado: his.users?.active === 1 ? "Activo" : "No activo",
      }));
    } catch (error) {
      console.log(error);
      return [];
    }
  };

  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") navigate("/");
  }, [currentUser, navigate]);

  useEffect(() => {
    filterHistory(filters);
  }, []);

  const toolbar = (
    <>
      <label className="inline-flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
        Por página
        <Select
          value={filters.limit}
          onChange={(e) => startFilter("limit", +e.target.value)}
        >
          <option value={100}>100</option>
          <option value={200}>200</option>
          <option value={500}>500</option>
        </Select>
      </label>
      <CsvDownloader
        filename="lista_historial_checkout"
        extension=".csv"
        separator=";"
        wrapColumnChar=""
        datas={transformHistoryData}
        text=""
      >
        <span className="inline-flex items-center gap-2 bg-bear-gradient text-bear-dark-500 hover:opacity-95 font-medium rounded-pill px-4 py-2 transition-colors">
          <Download size={18} aria-hidden />
          Exportar
        </span>
      </CsvDownloader>
    </>
  );

  return (
    <AdminPageLayout title="Historial checkout" toolbar={toolbar}>
        <div className="w-full overflow-x-hidden">
          {/* Tabla desktop (patrón BEAR BEAT PRO) */}
          <div className="hidden md:block rounded-xl border border-gray-200 dark:border-bear-dark-100 overflow-hidden">
          <div
            className="overflow-x-auto max-h-[60vh] overflow-y-auto"
            tabIndex={0}
            role="region"
            aria-label="Historial de checkout (tabla desplazable)"
            data-scroll-region
          >
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr>
                  <th className="bg-bear-light-100 dark:bg-bear-dark-500 text-gray-600 dark:text-gray-400 p-4 sticky top-0 z-10 text-left font-medium border-b border-gray-200 dark:border-bear-dark-100">Email</th>
                  <th className="bg-bear-light-100 dark:bg-bear-dark-500 text-gray-600 dark:text-gray-400 p-4 sticky top-0 z-10 text-left font-medium hidden lg:table-cell border-b border-gray-200 dark:border-bear-dark-100">Teléfono</th>
                  <th className="bg-bear-light-100 dark:bg-bear-dark-500 text-gray-600 dark:text-gray-400 p-4 sticky top-0 z-10 text-left font-medium border-b border-gray-200 dark:border-bear-dark-100">Última fecha de pago</th>
                  <th className="bg-bear-light-100 dark:bg-bear-dark-500 text-gray-600 dark:text-gray-400 p-4 sticky top-0 z-10 text-left font-medium border-b border-gray-200 dark:border-bear-dark-100">Estado</th>
                </tr>
              </thead>
              <tbody className="bg-bear-light-100 dark:bg-bear-dark-900 divide-y divide-gray-200 dark:divide-bear-dark-100">
                {!loader
                  ? history.map((his, index) => (
                      <tr key={`ch_${index}`} className="border-b border-gray-200 dark:border-bear-dark-100 hover:bg-gray-100 dark:hover:bg-bear-dark-500/50 transition-colors">
                        <td className="py-4 px-4 text-gray-700 dark:text-gray-300">{his.users?.email}</td>
                        <td className="py-4 px-4 text-gray-700 dark:text-gray-300 hidden lg:table-cell">{his.users?.phone}</td>
                        <td className="py-4 px-4 text-gray-700 dark:text-gray-300">{his.last_checkout_date?.toLocaleDateString?.()}</td>
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex text-xs px-2 py-1 rounded-full ${
                              his.users?.active === 1 ? "bg-emerald-500/10 text-emerald-400" : "bg-gray-500/10 text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            {his.users?.active === 1 ? "Activo" : "No activo"}
                          </span>
                        </td>
                      </tr>
                    ))
                  : ARRAY_10.map((_, i) => (
                      <tr key={`s_${i}`} className="border-b border-gray-200 dark:border-bear-dark-100">
                        <td colSpan={4} className="py-4 px-4 animate-pulse bg-gray-200 dark:bg-bear-dark-100/50" />
                      </tr>
                    ))}
              </tbody>
              <tfoot className="bg-bear-light-100 dark:bg-bear-dark-500 border-t border-gray-200 dark:border-bear-dark-100">
                <tr>
                  <td colSpan={4} className="p-4">
                    <Pagination
                    totalLoader={totalLoader}
                    totalData={totalHistory}
                    title="Datos"
                    startFilter={startFilter}
                    currentPage={filters.page}
                    limit={filters.limit}
                  />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

        {/* Cards móvil (patrón BEAR BEAT PRO) */}
        <div className="block md:hidden grid grid-cols-1 gap-4 w-full">
          {!loader
            ? history.map((his, index) => (
                <button
                  key={`m_${index}`}
                  className="bg-bear-light-100 dark:bg-bear-dark-500 p-4 rounded-lg border border-gray-200 dark:border-bear-dark-100"
                  onClick={() => setDrawerItem(his)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-200 truncate">{his.users?.email}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{his.last_checkout_date?.toLocaleDateString?.()}</p>
                    </div>
                    <span
                      className={`flex-shrink-0 text-xs px-2 py-1 rounded-full ${
                        his.users?.active === 1 ? "bg-emerald-500/10 text-emerald-400" : "bg-gray-500/10 text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {his.users?.active === 1 ? "Activo" : "Inactivo"}
                    </span>
                    <span className="flex-shrink-0 text-gray-500 dark:text-gray-400" aria-hidden>
                      <MoreVertical size={20} />
                    </span>
                  </div>
                </button>
              ))
            : ARRAY_10.map((_, i) => (
                <div key={`s_${i}`} className="bg-bear-light-100 dark:bg-bear-dark-500 p-4 rounded-lg border border-gray-200 dark:border-bear-dark-100 animate-pulse">
                  <div className="h-12 bg-gray-200 dark:bg-bear-dark-100/50 rounded" />
                </div>
              ))}
        </div>

        <div className="md:hidden mt-4">
          <Pagination
          totalLoader={totalLoader}
          totalData={totalHistory}
          title="Datos"
          startFilter={startFilter}
          currentPage={filters.page}
          limit={filters.limit}
        />
        </div>
      </div>

      <AdminDrawer open={drawerItem !== null} onClose={() => setDrawerItem(null)} title={drawerItem?.users?.email ?? "Registro"} user={undefined}>
        {drawerItem && (
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <p><span className="text-gray-500">Email:</span> {drawerItem.users?.email}</p>
            <p><span className="text-gray-500">Teléfono:</span> {drawerItem.users?.phone}</p>
            <p><span className="text-gray-500">Última fecha de pago:</span> {drawerItem.last_checkout_date?.toLocaleDateString?.()}</p>
            <p><span className="text-gray-500">Estado:</span> {drawerItem.users?.active === 1 ? "Activo" : "No activo"}</p>
          </div>
        )}
      </AdminDrawer>
    </AdminPageLayout>
  );
};
