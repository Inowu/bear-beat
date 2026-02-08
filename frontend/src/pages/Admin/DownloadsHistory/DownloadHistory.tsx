import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./DownloadHistory.scss";
import { AddInstructionsModal } from "../../../components/Modals";
import { ARRAY_10 } from "../../../utils/Constants";
import { IAdminDownloadHistory } from "../../../interfaces/admin";
import Pagination from "../../../components/Pagination/Pagination";
import trpc from "../../../api";
import { useUserContext } from "../../../contexts/UserContext";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import { AdminDrawer } from "../../../components/AdminDrawer/AdminDrawer";
import { Plus, MoreVertical } from "lucide-react";

interface IAdminFilter {
  page: number;
  limit: number;
}

export const DownloadHistory = () => {
  const { currentUser } = useUserContext();
  const navigate = useNavigate();
  const [history, setHistory] = useState<IAdminDownloadHistory[]>([]);
  const [totalLoader, setTotalLoader] = useState<boolean>(false);
  const [totalHistory, setTotalHistory] = useState(0);
  const [loader, setLoader] = useState<boolean>(true);
  const [filters, setFilters] = useState<IAdminFilter>({ page: 0, limit: 100 });
  const [showModal, setShowModal] = useState<boolean>(false);
  const [videoURL, setVideoURL] = useState<string>("");
  const [videoId, setVideoId] = useState<number>(0);
  const [drawerItem, setDrawerItem] = useState<IAdminDownloadHistory | null>(null);

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
      const res = await trpc.downloadHistory.getDownloadHistory.query({
        take: filt.limit,
        skip: filt.page * filt.limit,
        orderBy: { date: "desc" },
      });
      setHistory(res.data);
      setTotalHistory(res.count);
    } catch (error) {
      console.log(error);
    } finally {
      setLoader(false);
      setTotalLoader(false);
    }
  };

  const getConfig = async () => {
    try {
      const c = await trpc.config.findFirstConfig.query({ where: { name: "videoURL" } });
      if (c) {
        setVideoURL(c.value);
        setVideoId(c.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") navigate("/");
  }, [currentUser, navigate]);

  useEffect(() => {
    filterHistory(filters);
  }, [filters]);

  useEffect(() => {
    getConfig();
  }, []);

  const toolbar = (
    <>
      <select
        value={filters.limit}
        onChange={(e) => startFilter("limit", +e.target.value)}
        className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:border-bear-cyan focus:outline-none"
      >
        <option value={100}>100</option>
        <option value={200}>200</option>
        <option value={500}>500</option>
      </select>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-2 bg-bear-gradient hover:opacity-95 text-bear-dark-500 font-medium rounded-lg px-4 py-2 transition-opacity"
      >
        <Plus size={18} />
        Añadir instrucciones
      </button>
    </>
  );

  return (
    <AdminPageLayout title="Historial de descargas" toolbar={toolbar}>
      <AddInstructionsModal showModal={showModal} onHideModal={() => setShowModal(false)} videoURL={videoURL} videoId={videoId} />

      <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/50 hidden md:block">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full table-fixed">
            <thead className="bg-slate-900 sticky top-0 z-10">
              <tr>
                <th className="text-slate-400 uppercase text-xs tracking-wider text-left py-3 px-4 w-[180px]">Email</th>
                <th className="text-slate-400 uppercase text-xs tracking-wider text-left py-3 px-4 hidden xl:table-cell w-[150px]">Teléfono</th>
                <th className="text-slate-400 uppercase text-xs tracking-wider text-left py-3 px-4">Nombre</th>
                <th className="text-slate-400 uppercase text-xs tracking-wider text-left py-3 px-4 w-[110px]">Tamaño</th>
                <th className="text-slate-400 uppercase text-xs tracking-wider text-left py-3 px-4 w-[120px]">Fecha</th>
                <th className="text-slate-400 uppercase text-xs tracking-wider text-left py-3 px-4 w-[100px]">Tipo</th>
              </tr>
            </thead>
            <tbody className="bg-slate-950">
              {!loader
                ? history.map((his, index) => {
                    const gb = Number(his.size) / (1024 * 1024 * 1024);
                    return (
                      <tr key={`h_${index}`} className="border-b border-slate-800 hover:bg-slate-900/60 transition-colors">
                        <td className="py-3 px-4 text-sm text-slate-300 truncate" title={his.email}>{his.email}</td>
                        <td className="py-3 px-4 text-sm text-slate-300 hidden xl:table-cell truncate" title={his.phone ?? ""}>{his.phone}</td>
                        <td className="py-3 px-4 text-sm text-slate-300 truncate" title={his.fileName}>{his.fileName}</td>
                        <td className="py-3 px-4 text-sm text-slate-300">{gb.toFixed(2)} GB</td>
                        <td className="py-3 px-4 text-sm text-slate-300">{his.date.toLocaleDateString()}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex text-xs px-2 py-1 rounded-full bg-slate-500/10 text-slate-400">
                            {his.isFolder ? "Carpeta" : "Archivo"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                : ARRAY_10.map((_, i) => (
                    <tr key={`s_${i}`} className="border-b border-slate-800">
                      <td colSpan={6} className="py-4 animate-pulse bg-slate-800/50" />
                    </tr>
                  ))}
            </tbody>
            <tfoot className="bg-slate-900">
              <tr>
                <td colSpan={6} className="py-3 px-4">
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
          ? history.map((his, index) => {
              const gb = Number(his.size) / (1024 * 1024 * 1024);
              return (
                <div
                  key={`m_${index}`}
                  className="flex items-center justify-between gap-3 min-h-[64px] px-4 py-3 border-b border-slate-800 hover:bg-slate-900/60 active:bg-slate-800"
                  onClick={() => setDrawerItem(his)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setDrawerItem(his)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white text-sm truncate">{his.fileName}</p>
                    <p className="text-slate-400 text-xs">{his.email} · {gb.toFixed(2)} GB</p>
                  </div>
                  <span className="shrink-0 text-xs px-2 py-1 rounded-full bg-slate-500/10 text-slate-400">
                    {his.isFolder ? "Carpeta" : "Archivo"}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDrawerItem(his); }}
                    className="p-2 text-slate-400 hover:text-bear-cyan rounded-lg"
                    aria-label="Ver más"
                  >
                    <MoreVertical size={20} />
                  </button>
                </div>
              );
            })
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

      <AdminDrawer open={drawerItem !== null} onClose={() => setDrawerItem(null)} title={drawerItem?.fileName ?? "Descarga"} user={undefined}>
        {drawerItem && (
          <div className="space-y-2 text-sm text-slate-300">
            <p><span className="text-slate-500">Email:</span> {drawerItem.email}</p>
            <p><span className="text-slate-500">Teléfono:</span> {drawerItem.phone}</p>
            <p><span className="text-slate-500">Tamaño:</span> {(Number(drawerItem.size) / (1024 * 1024 * 1024)).toFixed(2)} GB</p>
            <p><span className="text-slate-500">Fecha:</span> {drawerItem.date.toLocaleDateString()}</p>
            <p><span className="text-slate-500">Tipo:</span> {drawerItem.isFolder ? "Carpeta" : "Archivo"}</p>
          </div>
        )}
      </AdminDrawer>
    </AdminPageLayout>
  );
};
