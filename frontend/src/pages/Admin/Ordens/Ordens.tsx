import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Pagination from "../../../components/Pagination/Pagination";
import trpc from "../../../api";
import { useUserContext } from "../../../contexts/UserContext";
import { ARRAY_10 } from "../../../utils/Constants";
import CsvDownloader from "react-csv-downloader";
import { Search, Download, MoreVertical } from "lucide-react";
import { IAdminOrders, ORDER_STATUS } from "../../../interfaces/admin";
import { of } from "await-of";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import { AdminDrawer } from "../../../components/AdminDrawer/AdminDrawer";

interface IAdminFilter {
  active: number;
  endDate: string;
  limit: number;
  page: number;
  paymentMethod: string;
  searchData: string;
  startDate: string;
  status: number | "";
}

function getOrderStatusString(status: number) {
  switch (status) {
    case ORDER_STATUS.PENDING: return "Pendiente";
    case ORDER_STATUS.PAID: return "Pagada";
    case ORDER_STATUS.FAILED: return "Fallida";
    case ORDER_STATUS.CANCELLED: return "Cancelada";
    case ORDER_STATUS.EXPIRED: return "Expirada";
    default: return "Desconocido";
  }
}

export const Ordens = () => {
  const { currentUser } = useUserContext();
  const navigate = useNavigate();
  const [ordens, setOrdens] = useState<IAdminOrders[]>([]);
  const [totalLoader, setTotalLoader] = useState<boolean>(false);
  const [totalOrdens, setTotalOrdens] = useState(0);
  const [loader, setLoader] = useState<boolean>(true);
  const [drawerOrder, setDrawerOrder] = useState<IAdminOrders | null>(null);
  const [filters, setFilters] = useState<IAdminFilter>({
    active: 1,
    endDate: "",
    limit: 100,
    page: 0,
    paymentMethod: "",
    searchData: "",
    startDate: "",
    status: ORDER_STATUS.PAID,
  });

  const buildDateRange = (start: string, end: string) => {
    const startVal = start ? `${start} 00:00:00` : "";
    const endVal = end ? `${end} 23:59:59` : "";
    if (!startVal && !endVal) return undefined;
    return {
      ...(startVal ? { gte: startVal } : {}),
      ...(endVal ? { lte: endVal } : {}),
    };
  };

  const startFilter = (key: string, value: string | number) => {
    const next = { ...filters, [key]: value };
    if (key !== "page") next.page = 0;
    setFilters(next);
  };

  const filterOrdens = async (filt: IAdminFilter) => {
    setLoader(true);
    setTotalLoader(true);
    try {
      const body: any = {
        take: filt.limit,
        skip: filt.page * filt.limit,
        email: filt.searchData,
        paymentMethod: filt.paymentMethod,
      };

      if (typeof filt.status === "number") {
        body.status = filt.status;
      }

      const dateRange = buildDateRange(filt.startDate, filt.endDate);
      if (dateRange) {
        body.date_order = dateRange;
      }
      const [res, err] = await of(trpc.orders.findManyOrdersWithUsers.query(body));
      if (err || !res) return;
      setOrdens(res.data);
      setTotalOrdens(res.count);
    } finally {
      setLoader(false);
      setTotalLoader(false);
    }
  };

  const transformOrdersToExport = async () => {
    const body: any = {
      take: 0,
      skip: 0,
      email: filters.searchData,
      paymentMethod: filters.paymentMethod,
    };
    if (typeof filters.status === "number") {
      body.status = filters.status;
    }
    const dateRange = buildDateRange(filters.startDate, filters.endDate);
    if (dateRange) {
      body.date_order = dateRange;
    }
    const [res, err] = await of(trpc.orders.findManyOrdersWithUsers.query(body));
    if (err || !res) return [];
    return res.data.map((o: any) => ({
      Orden: o.id,
      Correo: o.email,
      Telefono: o.phone,
      "Metodo de pago": o.payment_method,
      "Id de la suscripcion": o.txn_id,
      Precio: o.total_price,
      Fecha: o.date_order.toLocaleDateString(),
      Estado: getOrderStatusString(o.status),
    }));
  };

  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") navigate("/");
  }, [currentUser, navigate]);

  useEffect(() => {
    filterOrdens(filters);
  }, [filters]);

  const toolbar = (
    <>
      <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por email o teléfono"
            value={filters.searchData}
            onChange={(e) => startFilter("searchData", e.target.value)}
            className="w-full bg-bear-light-100 dark:bg-bear-dark-300 border border-gray-300 dark:border-bear-dark-100 rounded-lg py-2 pl-9 pr-3 text-gray-900 dark:text-white text-sm placeholder-gray-500 focus:outline-none focus:border-bear-cyan focus:ring-1 focus:ring-bear-cyan"
          />
        </div>
        <label className="inline-flex flex-col gap-1 text-xs font-semibold text-gray-600 dark:text-gray-400">
          Método
          <select
            value={filters.paymentMethod}
            onChange={(e) => startFilter("paymentMethod", e.target.value)}
            className="bg-bear-light-100 dark:bg-bear-dark-300 border border-gray-300 dark:border-bear-dark-100 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:border-bear-cyan focus:outline-none"
          >
            <option value="">Todos</option>
            <option value="Paypal">Paypal</option>
            <option value="Stripe">Stripe</option>
            <option value="Conekta">Conekta (SPEI/Efectivo/BBVA)</option>
            <option value="Admin">Admin</option>
          </select>
        </label>
        <label className="inline-flex flex-col gap-1 text-xs font-semibold text-gray-600 dark:text-gray-400">
          Estado
          <select
            value={filters.status}
            onChange={(e) =>
              startFilter("status", e.target.value === "" ? "" : Number(e.target.value))
            }
            className="bg-bear-light-100 dark:bg-bear-dark-300 border border-gray-300 dark:border-bear-dark-100 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:border-bear-cyan focus:outline-none"
          >
            <option value="">Todos</option>
            <option value={ORDER_STATUS.PAID}>Pagada</option>
            <option value={ORDER_STATUS.PENDING}>Pendiente</option>
            <option value={ORDER_STATUS.FAILED}>Fallida</option>
            <option value={ORDER_STATUS.CANCELLED}>Cancelada</option>
            <option value={ORDER_STATUS.EXPIRED}>Expirada</option>
          </select>
        </label>
        <label className="inline-flex flex-col gap-1 text-xs font-semibold text-gray-600 dark:text-gray-400">
          Desde
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => startFilter("startDate", e.target.value)}
            className="bg-bear-light-100 dark:bg-bear-dark-300 border border-gray-300 dark:border-bear-dark-100 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:border-bear-cyan focus:outline-none"
          />
        </label>
        <label className="inline-flex flex-col gap-1 text-xs font-semibold text-gray-600 dark:text-gray-400">
          Hasta
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => startFilter("endDate", e.target.value)}
            className="bg-bear-light-100 dark:bg-bear-dark-300 border border-gray-300 dark:border-bear-dark-100 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:border-bear-cyan focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, "0");
            const dd = String(today.getDate()).padStart(2, "0");
            const iso = `${yyyy}-${mm}-${dd}`;
            setFilters((prev) => ({ ...prev, startDate: iso, endDate: iso, page: 0 }));
          }}
          className="bg-bear-light-100 dark:bg-bear-dark-300 border border-gray-300 dark:border-bear-dark-100 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm hover:opacity-95 focus:border-bear-cyan focus:outline-none"
        >
          Hoy
        </button>
        <label className="inline-flex flex-col gap-1 text-xs font-semibold text-gray-600 dark:text-gray-400">
          Por página
          <select
            value={filters.limit}
            onChange={(e) => startFilter("limit", +e.target.value)}
            className="bg-bear-light-100 dark:bg-bear-dark-300 border border-gray-300 dark:border-bear-dark-100 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:border-bear-cyan focus:outline-none"
          >
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </select>
        </label>
      </div>
      <CsvDownloader
        filename="lista_de_ordenes"
        extension=".csv"
        separator=";"
        wrapColumnChar=""
        datas={transformOrdersToExport}
        text=""
      >
        <span className="inline-flex items-center gap-2 bg-bear-gradient text-bear-dark-500 hover:opacity-95 font-medium rounded-pill px-4 py-2 transition-colors">
          <Download size={18} aria-hidden />
          Exportar
        </span>
      </CsvDownloader>
    </>
  );

  const statusBadge = (status: number) => {
    const s = getOrderStatusString(status);
    const isPaid = status === ORDER_STATUS.PAID;
    return (
      <span
        className={`inline-flex text-xs px-2 py-1 rounded-full ${
          isPaid ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"
        }`}
      >
        {s}
      </span>
    );
  };

  return (
    <AdminPageLayout title="Órdenes" toolbar={toolbar}>
      <div className="w-full overflow-x-hidden">
        {/* Tabla desktop (patrón BEAR BEAT PRO) */}
        <div className="hidden md:block rounded-xl border border-gray-200 dark:border-bear-dark-100 overflow-hidden">
          <div
            className="overflow-x-auto max-h-[60vh] overflow-y-auto"
            tabIndex={0}
            role="region"
            aria-label="Tabla de órdenes (desliza para ver más columnas)"
            data-scroll-region
          >
            <table className="w-full text-left text-sm border-collapse table-fixed">
              <thead>
                <tr>
                  <th className="bg-bear-light-100 dark:bg-bear-dark-500 text-gray-600 dark:text-gray-400 p-4 sticky top-0 z-10 text-left font-medium border-b border-gray-200 dark:border-bear-dark-100 w-[90px]">No. Orden</th>
                  <th className="bg-bear-light-100 dark:bg-bear-dark-500 text-gray-600 dark:text-gray-400 p-4 sticky top-0 z-10 text-left font-medium border-b border-gray-200 dark:border-bear-dark-100 w-[220px]">Correo</th>
                  <th className="bg-bear-light-100 dark:bg-bear-dark-500 text-gray-600 dark:text-gray-400 p-4 sticky top-0 z-10 text-left font-medium hidden xl:table-cell border-b border-gray-200 dark:border-bear-dark-100 w-[160px]">Teléfono</th>
                  <th className="bg-bear-light-100 dark:bg-bear-dark-500 text-gray-600 dark:text-gray-400 p-4 sticky top-0 z-10 text-left font-medium border-b border-gray-200 dark:border-bear-dark-100 w-[120px]">Método</th>
                  <th className="bg-bear-light-100 dark:bg-bear-dark-500 text-gray-600 dark:text-gray-400 p-4 sticky top-0 z-10 text-left font-medium hidden 2xl:table-cell border-b border-gray-200 dark:border-bear-dark-100 w-[170px]">Id suscripción</th>
                  <th className="bg-bear-light-100 dark:bg-bear-dark-500 text-gray-600 dark:text-gray-400 p-4 sticky top-0 z-10 text-left font-medium border-b border-gray-200 dark:border-bear-dark-100 w-[110px]">Precio</th>
                  <th className="bg-bear-light-100 dark:bg-bear-dark-500 text-gray-600 dark:text-gray-400 p-4 sticky top-0 z-10 text-left font-medium border-b border-gray-200 dark:border-bear-dark-100 w-[120px]">Fecha</th>
                  <th className="bg-bear-light-100 dark:bg-bear-dark-500 text-gray-600 dark:text-gray-400 p-4 sticky top-0 z-10 text-left font-medium border-b border-gray-200 dark:border-bear-dark-100 w-[120px]">Estado</th>
                </tr>
              </thead>
              <tbody className="bg-bear-light-100 dark:bg-bear-dark-900 divide-y divide-gray-200 dark:divide-bear-dark-100">
                {!loader
                  ? ordens.map((orden, index) => (
                      <tr
                        key={`order_${index}`}
                        className="border-b border-gray-200 dark:border-bear-dark-100 hover:bg-gray-100 dark:hover:bg-bear-dark-500/50 transition-colors"
                      >
                        <td className="py-4 px-4 text-gray-700 dark:text-gray-300">{orden.id}</td>
                        <td className="py-4 px-4 text-gray-700 dark:text-gray-300 truncate" title={orden.email}>{orden.email}</td>
                        <td className="py-4 px-4 text-gray-700 dark:text-gray-300 hidden xl:table-cell truncate" title={orden.phone ?? ""}>{orden.phone}</td>
                        <td className="py-4 px-4 text-gray-700 dark:text-gray-300 truncate" title={orden.payment_method ?? "—"}>{orden.payment_method ?? "—"}</td>
                        <td className="py-4 px-4 text-gray-700 dark:text-gray-300 hidden 2xl:table-cell truncate" title={orden.txn_id ?? ""}>{orden.txn_id}</td>
                        <td className="py-4 px-4 text-gray-700 dark:text-gray-300">{orden.total_price}</td>
                        <td className="py-4 px-4 text-gray-700 dark:text-gray-300">{orden.date_order.toLocaleDateString()}</td>
                        <td className="py-4 px-4">{statusBadge(orden.status)}</td>
                      </tr>
                    ))
                  : ARRAY_10.map((_, i) => (
                      <tr key={`skeleton_${i}`} className="border-b border-gray-200 dark:border-bear-dark-100">
                        <td colSpan={8} className="py-4 px-4 animate-pulse bg-gray-200 dark:bg-bear-dark-100/50" />
                      </tr>
                    ))}
              </tbody>
              <tfoot className="bg-bear-light-100 dark:bg-bear-dark-500 border-t border-gray-200 dark:border-bear-dark-100">
                <tr>
                  <td colSpan={8} className="p-4">
                    <Pagination
                    totalLoader={totalLoader}
                    totalData={totalOrdens}
                    title="ordenes"
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
            ? ordens.map((orden, index) => (
                <button
                  key={`m_${index}`}
                  className="bg-bear-light-100 dark:bg-bear-dark-500 p-4 rounded-lg border border-gray-200 dark:border-bear-dark-100"
                  onClick={() => setDrawerOrder(orden)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-200 truncate">{orden.email}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{orden.total_price} · {orden.date_order.toLocaleDateString()}</p>
                    </div>
                    {statusBadge(orden.status)}
                    <span className="p-2 text-gray-500 dark:text-gray-400 flex-shrink-0" aria-hidden>
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
            totalData={totalOrdens}
            title="ordenes"
            startFilter={startFilter}
            currentPage={filters.page}
            limit={filters.limit}
          />
        </div>
      </div>

      <AdminDrawer
        open={drawerOrder !== null}
        onClose={() => setDrawerOrder(null)}
        title={drawerOrder ? `Orden #${drawerOrder.id}` : "Orden"}
        user={undefined}
      >
        {drawerOrder && (
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <p><span className="text-gray-500 dark:text-gray-500">Correo:</span> {drawerOrder.email}</p>
            <p><span className="text-gray-500 dark:text-gray-500">Teléfono:</span> {drawerOrder.phone}</p>
            <p><span className="text-gray-500 dark:text-gray-500">Método:</span> {drawerOrder.payment_method ?? "—"}</p>
            <p><span className="text-gray-500 dark:text-gray-500">Id suscripción:</span> {drawerOrder.txn_id}</p>
            <p><span className="text-gray-500 dark:text-gray-500">Precio:</span> {drawerOrder.total_price}</p>
            <p><span className="text-gray-500 dark:text-gray-500">Fecha:</span> {drawerOrder.date_order.toLocaleDateString()}</p>
            <p><span className="text-gray-500 dark:text-gray-500">Estado:</span> {getOrderStatusString(drawerOrder.status)}</p>
          </div>
        )}
      </AdminDrawer>
    </AdminPageLayout>
  );
};
