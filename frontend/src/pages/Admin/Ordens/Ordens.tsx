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
  });

  const startFilter = (key: string, value: string | number) => {
    const next = { ...filters, [key]: value };
    if (key !== "page") next.page = 0;
    setFilters(next);
    filterOrdens(next);
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
        status: ORDER_STATUS.PAID,
      };
      if (filt.startDate && filt.endDate) {
        body.date_order = { gte: new Date(filt.startDate), lte: new Date(filt.endDate) };
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
      status: ORDER_STATUS.PAID,
    };
    if (filters.startDate && filters.endDate) {
      body.date_order = { gte: new Date(filters.startDate), lte: new Date(filters.endDate) };
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
      Estado: o.status === 1 ? "Activa" : "No activa",
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por email o teléfono"
            value={filters.searchData}
            onChange={(e) => startFilter("searchData", e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-9 pr-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
        </div>
        <select
          value={filters.paymentMethod}
          onChange={(e) => startFilter("paymentMethod", e.target.value)}
          className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
        >
          <option value="">Todos</option>
          <option value="Paypal">Paypal</option>
          <option value="Stripe">Stripe</option>
          <option value="Conekta">Conekta OXXO</option>
          <option value="Admin">Admin</option>
        </select>
        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => startFilter("startDate", e.target.value)}
          className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
        />
        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => startFilter("endDate", e.target.value)}
          className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
        />
        <select
          value={filters.limit}
          onChange={(e) => startFilter("limit", +e.target.value)}
          className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
        >
          <option value={100}>100</option>
          <option value={200}>200</option>
          <option value={500}>500</option>
        </select>
      </div>
      <CsvDownloader
        filename="lista_de_ordenes"
        extension=".csv"
        separator=";"
        wrapColumnChar=""
        datas={transformOrdersToExport}
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
        <div className="hidden md:block rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr>
                  <th className="bg-slate-900 text-slate-400 p-4 sticky top-0 z-10 text-left font-medium">No. Orden</th>
                  <th className="bg-slate-900 text-slate-400 p-4 sticky top-0 z-10 text-left font-medium">Correo</th>
                  <th className="bg-slate-900 text-slate-400 p-4 sticky top-0 z-10 text-left font-medium hidden lg:table-cell">Teléfono</th>
                  <th className="bg-slate-900 text-slate-400 p-4 sticky top-0 z-10 text-left font-medium">Método</th>
                  <th className="bg-slate-900 text-slate-400 p-4 sticky top-0 z-10 text-left font-medium hidden xl:table-cell">Id suscripción</th>
                  <th className="bg-slate-900 text-slate-400 p-4 sticky top-0 z-10 text-left font-medium">Precio</th>
                  <th className="bg-slate-900 text-slate-400 p-4 sticky top-0 z-10 text-left font-medium">Fecha</th>
                  <th className="bg-slate-900 text-slate-400 p-4 sticky top-0 z-10 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="bg-slate-950 divide-y divide-slate-800">
                {!loader
                  ? ordens.map((orden, index) => (
                      <tr
                        key={`order_${index}`}
                        className="border-b border-slate-800 hover:bg-slate-900/50 transition-colors"
                      >
                        <td className="py-4 px-4 text-slate-300">{orden.id}</td>
                        <td className="py-4 px-4 text-slate-300">{orden.email}</td>
                        <td className="py-4 px-4 text-slate-300 hidden lg:table-cell">{orden.phone}</td>
                        <td className="py-4 px-4 text-slate-300">{orden.payment_method ?? "—"}</td>
                        <td className="py-4 px-4 text-slate-300 hidden xl:table-cell">{orden.txn_id}</td>
                        <td className="py-4 px-4 text-slate-300">{orden.total_price}</td>
                        <td className="py-4 px-4 text-slate-300">{orden.date_order.toLocaleDateString()}</td>
                        <td className="py-4 px-4">{statusBadge(orden.status)}</td>
                      </tr>
                    ))
                  : ARRAY_10.map((_, i) => (
                      <tr key={`skeleton_${i}`} className="border-b border-slate-800">
                        <td colSpan={8} className="py-4 px-4 animate-pulse bg-slate-800/50" />
                      </tr>
                    ))}
              </tbody>
              <tfoot className="bg-slate-900">
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
                <div
                  key={`m_${index}`}
                  className="bg-slate-900 p-4 rounded-lg border border-slate-800"
                  onClick={() => setDrawerOrder(orden)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setDrawerOrder(orden)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-200 truncate">{orden.email}</p>
                      <p className="text-xs text-slate-400">{orden.total_price} · {orden.date_order.toLocaleDateString()}</p>
                    </div>
                    {statusBadge(orden.status)}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDrawerOrder(orden); }}
                      className="p-2 text-slate-400 hover:text-cyan-400 rounded-lg flex-shrink-0"
                      aria-label="Ver más"
                    >
                      <MoreVertical size={20} />
                    </button>
                  </div>
                </div>
              ))
            : ARRAY_10.map((_, i) => (
                <div key={`s_${i}`} className="bg-slate-900 p-4 rounded-lg border border-slate-800 animate-pulse">
                  <div className="h-12 bg-slate-800/50 rounded" />
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
          <div className="space-y-2 text-sm text-slate-300">
            <p><span className="text-slate-500">Correo:</span> {drawerOrder.email}</p>
            <p><span className="text-slate-500">Teléfono:</span> {drawerOrder.phone}</p>
            <p><span className="text-slate-500">Método:</span> {drawerOrder.payment_method ?? "—"}</p>
            <p><span className="text-slate-500">Id suscripción:</span> {drawerOrder.txn_id}</p>
            <p><span className="text-slate-500">Precio:</span> {drawerOrder.total_price}</p>
            <p><span className="text-slate-500">Fecha:</span> {drawerOrder.date_order.toLocaleDateString()}</p>
            <p><span className="text-slate-500">Estado:</span> {getOrderStatusString(drawerOrder.status)}</p>
          </div>
        )}
      </AdminDrawer>
    </AdminPageLayout>
  );
};
