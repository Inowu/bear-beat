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
import { Plus, MoreVertical } from "src/icons";
import { Select } from "../../../components/ui";

interface IAdminFilter {
  page: number;
  limit: number;
}

const formatDownloadSize = (rawSize: bigint | number | string) => {
  const bytes = Number(rawSize ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0.00 GB";
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

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
    } catch {
      if (import.meta.env.DEV) {
        console.warn("[ADMIN][DOWNLOAD_HISTORY] Failed to load download history.");
      }
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
    } catch {
      if (import.meta.env.DEV) {
        console.warn("[ADMIN][DOWNLOAD_HISTORY] Failed to load config videoURL.");
      }
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
    <div className="downloads-history-toolbar" data-testid="downloads-history-toolbar">
      <label className="downloads-history-toolbar__field inline-flex flex-col gap-1 text-sm">
        <span className="downloads-history-toolbar__label">Por página</span>
        <Select
          className="downloads-history-toolbar__select"
          value={filters.limit}
          onChange={(e) => startFilter("limit", +e.target.value)}
        >
          <option value={100}>100</option>
          <option value={200}>200</option>
          <option value={500}>500</option>
        </Select>
      </label>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="downloads-history-toolbar__cta inline-flex items-center gap-2 bg-bear-gradient hover:opacity-95 text-bear-dark-500 font-medium rounded-lg px-4 py-2 transition-opacity"
      >
        <Plus size={18} />
        Añadir instrucciones
      </button>
    </div>
  );

  return (
    <AdminPageLayout
      title="Historial de descargas"
      subtitle="Monitorea qué se descarga, cuándo y por quién para resolver fricción operativa rápido."
      toolbar={toolbar}
    >
      <AddInstructionsModal showModal={showModal} onHideModal={() => setShowModal(false)} videoURL={videoURL} videoId={videoId} />

      <div className="admin-table-panel">
        <div
          className="overflow-x-auto max-h-[60vh] overflow-y-auto"
          tabIndex={0}
          role="region"
          aria-label="Historial de descargas (tabla desplazable)"
          data-scroll-region
        >
          <table className="w-full table-fixed">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4 w-[180px]">Email</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4 hidden xl:table-cell w-[150px]">Teléfono</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Nombre</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4 w-[110px]">Tamaño</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4 w-[120px]">Fecha</th>
                <th className="uppercase text-xs tracking-wider text-left py-3 px-4 w-[100px]">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {!loader
                ? history.length > 0
                  ? history.map((his, index) => {
                    const sizeLabel = formatDownloadSize(his.size);
                    return (
                      <tr key={`h_${index}`} className="border-b transition-colors">
                        <td className="py-3 px-4 text-sm truncate" title={his.email}>{his.email}</td>
                        <td className="py-3 px-4 text-sm hidden xl:table-cell truncate" title={his.phone ?? ""}>{his.phone}</td>
                        <td className="py-3 px-4 text-sm truncate" title={his.fileName}>{his.fileName}</td>
                        <td className="py-3 px-4 text-sm">{sizeLabel}</td>
                        <td className="py-3 px-4 text-sm">{his.date.toLocaleDateString()}</td>
                        <td className="py-3 px-4">
                          <span className="badge badge--tiny badge--neutral">
                            {his.isFolder ? "Carpeta" : "Archivo"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                  : (
                    <tr>
                      <td colSpan={6} className="py-10 px-4 text-center text-sm text-text-muted">
                        No hay descargas registradas para este rango.
                      </td>
                    </tr>
                  )
                : ARRAY_10.map((_, i) => (
                    <tr key={`s_${i}`} className="border-b">
                      <td colSpan={6} className="py-4 animate-pulse bg-bg-input" />
                    </tr>
                  ))}
            </tbody>
            <tfoot>
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

      <div className="admin-mobile-list">
        {!loader
          ? history.length > 0
            ? history.map((his, index) => {
              const sizeLabel = formatDownloadSize(his.size);
              return (
                <button
                  key={`m_${index}`}
                  className="admin-mobile-card"
                  onClick={() => setDrawerItem(his)}
                  type="button"
                >
                  <div className="admin-mobile-card__head">
                    <div className="admin-mobile-card__identity">
                      <div className="admin-mobile-card__avatar">{his.isFolder ? "F" : "A"}</div>
                      <div className="admin-mobile-card__copy">
                        <p className="admin-mobile-card__name">{his.fileName}</p>
                        <p className="admin-mobile-card__email">{his.email}</p>
                      </div>
                    </div>
                    <span className="admin-mobile-status is-active">
                      {his.isFolder ? "Carpeta" : "Archivo"}
                    </span>
                    <span className="admin-mobile-card__menu" aria-hidden>
                      <MoreVertical size={20} />
                    </span>
                  </div>
                  <div className="admin-mobile-card__foot">
                    <span>{sizeLabel}</span>
                    <span>{his.date.toLocaleDateString()}</span>
                    <span>{his.phone || "—"}</span>
                  </div>
                </button>
              );
            })
            : (
              <div className="downloads-history-mobile-empty px-4 py-6">
                <p className="text-sm">No hay descargas registradas.</p>
                <p className="text-xs">Cuando haya actividad, aparecerá aquí.</p>
              </div>
            )
          : ARRAY_10.map((_, i) => (
              <div key={`s_${i}`} className="admin-mobile-card admin-mobile-card--skeleton">
                <div className="admin-mobile-card__head">
                  <div className="admin-mobile-card__identity">
                    <div className="admin-mobile-card__avatar" />
                    <div className="admin-mobile-card__copy">
                      <p className="admin-mobile-card__name">—</p>
                      <p className="admin-mobile-card__email">—</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
      </div>

      <div className="admin-pagination-mobile">
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
          <div className="space-y-2 text-sm">
            <p><span className="text-text-muted">Email:</span> {drawerItem.email}</p>
            <p><span className="text-text-muted">Teléfono:</span> {drawerItem.phone}</p>
            <p><span className="text-text-muted">Tamaño:</span> {(Number(drawerItem.size) / (1024 * 1024 * 1024)).toFixed(2)} GB</p>
            <p><span className="text-text-muted">Fecha:</span> {drawerItem.date.toLocaleDateString()}</p>
            <p><span className="text-text-muted">Tipo:</span> {drawerItem.isFolder ? "Carpeta" : "Archivo"}</p>
          </div>
        )}
      </AdminDrawer>
    </AdminPageLayout>
  );
};
