import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ARRAY_10 } from "../../../utils/Constants";
import trpc from "../../../api";
import { useUserContext } from "../../../contexts/UserContext";
import "./HistoryCheckout.scss";
import Pagination from "../../../components/Pagination/Pagination";
import CsvDownloader from "react-csv-downloader";
import { exportPayments } from "../fuctions";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import { AdminDrawer } from "../../../components/AdminDrawer/AdminDrawer";
import { Download, MoreVertical } from "lucide-react";

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
      <select
        value={filters.limit}
        onChange={(e) => startFilter("limit", +e.target.value)}
        className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
      >
        <option value={100}>100</option>
        <option value={200}>200</option>
        <option value={500}>500</option>
      </select>
      <CsvDownloader
        filename="lista_historial_checkout"
        extension=".csv"
        separator=";"
        wrapColumnChar=""
        datas={transformHistoryData}
        text=""
      >
        <button
          type="button"
          className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg px-4 py-2 transition-colors"
        >
          <Download size={18} />
          Exportar
        </button>
      </CsvDownloader>
    </>
  );

  return (
    <AdminPageLayout title="Historial checkout" toolbar={toolbar}>
      <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/50 hidden md:block">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full min-w-[500px]">
            <thead className="bg-slate-900 sticky top-0 z-10">
              <tr>
                <th className="text-slate-400 uppercase text-xs tracking-wider text-left py-3 px-4">Email</th>
                <th className="text-slate-400 uppercase text-xs tracking-wider text-left py-3 px-4 hidden lg:table-cell">Teléfono</th>
                <th className="text-slate-400 uppercase text-xs tracking-wider text-left py-3 px-4">Última fecha de pago</th>
                <th className="text-slate-400 uppercase text-xs tracking-wider text-left py-3 px-4">Estado</th>
              </tr>
            </thead>
            <tbody className="bg-slate-950">
              {!loader
                ? history.map((his, index) => (
                    <tr key={`ch_${index}`} className="border-b border-slate-800 hover:bg-slate-900/60 transition-colors">
                      <td className="py-3 px-4 text-sm text-slate-300">{his.users?.email}</td>
                      <td className="py-3 px-4 text-sm text-slate-300 hidden lg:table-cell">{his.users?.phone}</td>
                      <td className="py-3 px-4 text-sm text-slate-300">{his.last_checkout_date?.toLocaleDateString?.()}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex text-xs px-2 py-1 rounded-full ${
                            his.users?.active === 1 ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"
                          }`}
                        >
                          {his.users?.active === 1 ? "Activo" : "No activo"}
                        </span>
                      </td>
                    </tr>
                  ))
                : ARRAY_10.map((_, i) => (
                    <tr key={`s_${i}`} className="border-b border-slate-800">
                      <td colSpan={4} className="py-4 animate-pulse bg-slate-800/50" />
                    </tr>
                  ))}
            </tbody>
            <tfoot className="bg-slate-900">
              <tr>
                <td colSpan={4} className="py-3 px-4">
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

      <div className="md:hidden flex flex-col rounded-xl border border-slate-800 overflow-hidden bg-slate-900/50">
        {!loader
          ? history.map((his, index) => (
              <div
                key={`m_${index}`}
                className="flex items-center justify-between gap-3 min-h-[64px] px-4 py-3 border-b border-slate-800 hover:bg-slate-900/60 active:bg-slate-800"
                onClick={() => setDrawerItem(his)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setDrawerItem(his)}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white text-sm truncate">{his.users?.email}</p>
                  <p className="text-slate-400 text-xs">{his.last_checkout_date?.toLocaleDateString?.()}</p>
                </div>
                <span
                  className={`shrink-0 text-xs px-2 py-1 rounded-full ${
                    his.users?.active === 1 ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"
                  }`}
                >
                  {his.users?.active === 1 ? "Activo" : "Inactivo"}
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDrawerItem(his); }}
                  className="p-2 text-slate-400 hover:text-cyan-400 rounded-lg"
                  aria-label="Ver más"
                >
                  <MoreVertical size={20} />
                </button>
              </div>
            ))
          : ARRAY_10.map((_, i) => (
              <div key={`s_${i}`} className="min-h-[64px] px-4 py-3 border-b border-slate-800 animate-pulse bg-slate-800/30" />
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

      <AdminDrawer open={drawerItem !== null} onClose={() => setDrawerItem(null)} title={drawerItem?.users?.email ?? "Registro"} user={undefined}>
        {drawerItem && (
          <div className="space-y-2 text-sm text-slate-300">
            <p><span className="text-slate-500">Email:</span> {drawerItem.users?.email}</p>
            <p><span className="text-slate-500">Teléfono:</span> {drawerItem.users?.phone}</p>
            <p><span className="text-slate-500">Última fecha de pago:</span> {drawerItem.last_checkout_date?.toLocaleDateString?.()}</p>
            <p><span className="text-slate-500">Estado:</span> {drawerItem.users?.active === 1 ? "Activo" : "No activo"}</p>
          </div>
        )}
      </AdminDrawer>
    </AdminPageLayout>
  );
};
