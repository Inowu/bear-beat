import { ARRAY_10 } from "../../../utils/Constants";
import trpc from "../../../api";
import { useUserContext } from "../../../contexts/UserContext";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./HistoryCheckout.scss";
import Pagination from "../../../components/Pagination/Pagination";
import CsvDownloader from "react-csv-downloader";
import { exportPayments } from "../fuctions";
interface IAdminFilter {
  page: number;
  limit: number;
}
export const HistoryCheckout = () => {
  const { currentUser } = useUserContext();
  const navigate = useNavigate();
  const [history, setHistory] = useState<any>([]);
  const [totalLoader, setTotalLoader] = useState<boolean>(false);
  const [totalHistory, setTotalHistory] = useState(0);
  const [loader, setLoader] = useState<boolean>(true);
  const [filters, setFilters] = useState<IAdminFilter>({
    page: 0,
    limit: 100,
  });

  const startFilter = (key: string, value: string | number) => {
    let tempFilters: any = filters;
    tempFilters[key] = value;
    filterHistory(tempFilters);
    setFilters(tempFilters);
  };
  const filterHistory = async (filt: IAdminFilter) => {
    setLoader(true);
    setTotalLoader(true);
    try {
      let body: any = {
        take: filt.limit,
        skip: filt.page * filt.limit,
        orderBy: {
          last_checkout_date: "desc",
        },
      };
      let body2: any = {
        include: {
          id: true,
        },
      };
      const tempHistory: any =
        await trpc.checkoutLogs.getCheckoutLogs.query(body);
      setLoader(false);
      setHistory(tempHistory);
      const totalHistory: any =
        await trpc.checkoutLogs.getCheckoutLogs.query(body2);
      setTotalHistory(totalHistory.length);
      setTotalLoader(false);
    } catch (error) {
      console.log(error);
    }
  };
  const transformHistoryData = async () => {
    try {
      const tempHistory: any = await exportPayments();
      console.log('this is tempHistory', tempHistory);
      return tempHistory.map((his: any) => ({
        Usuario: his.users.username,
        Correo: his.users.email,
        Teléfono: his.users.phone,
        "Última Fecha de pago": his.last_checkout_date.toLocaleDateString(),
        Estado: his.users.active === 1 ? "Activo" : "No activo",
      }));
    } catch (error) {
      console.log(error);
    }
  };
  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") {
      navigate("/");
    }
  }, [currentUser]);
  useEffect(() => {
    filterHistory(filters);
  }, []);

  return (
    <div className="coupons-contain history-contain">
      <div className="header">
        <h1>Historial</h1>
        <CsvDownloader
          className="btn-addUsers"
          filename="lista_de_usuarios"
          extension=".csv"
          separator=";"
          wrapColumnChar=""
          datas={transformHistoryData()}
          text="Exportar Historial"
        />
      </div>
      <div className="select-input">
        <p>Cantidad de datos</p>
        <select
          defaultValue={filters.limit}
          onChange={(e) => startFilter("limit", +e.target.value)}
        >
          <option value={""} disabled>
            Numero de datos
          </option>
          <option value={100}>100</option>
          <option value={200}>200</option>
          <option value={500}>500</option>
        </select>
      </div>
      <div className="admin-table">
        <div className="table-contain">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Ultima Fecha de Pago</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {!loader
                ? history.map((his: any, index: number) => {
                  return (
                    <tr key={"admin_history_" + index}>
                      <td className="">{his.users.email}</td>
                      <td>{his.users.phone}</td>
                      <td>{his.last_checkout_date.toLocaleDateString()}</td>
                      <td>
                        {his.users.active === 1 ? "Activo" : "No activo"}
                      </td>
                    </tr>
                  );
                })
                : ARRAY_10.map((val: string, index: number) => {
                  return (
                    <tr key={"array_10" + index} className="tr-load">
                      <td />
                      <td />
                      <td />
                      <td />
                    </tr>
                  );
                })}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={4}>
                  <Pagination
                    totalLoader={totalLoader}
                    totalData={totalHistory}
                    title="Datos"
                    startFilter={startFilter}
                    currentPage={filters.page}
                    limit={filters.limit}
                  />
                </th>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
