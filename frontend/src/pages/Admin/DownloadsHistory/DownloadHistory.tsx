import { ARRAY_10 } from "../../../utils/Constants";
import trpc from "../../../api";
import { useUserContext } from "../../../contexts/UserContext";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./DownloadHistory.scss";
import Pagination from "../../../components/Pagination/Pagination";
import CsvDownloader from "react-csv-downloader";
import { exportPayments } from "../fuctions";
import { IAdminDownloadHistory } from "../../../interfaces/admin";

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
      const body: any = {
        take: filt.limit,
        skip: filt.page * filt.limit,
        orderBy: {
          date: "desc",
        },
      };
      const tempHistory =
        await trpc.downloadHistory.getDownloadHistory.query(body);

      setLoader(false);
      setHistory(tempHistory.data);
      setTotalHistory(tempHistory.count);
      setTotalLoader(false);
    } catch (error) {
      console.log(error);
    }
  };
  const transformHistoryData = async () => {
    try {
      const tempHistory: any = await exportPayments();
      return tempHistory.map((his: any) => ({
        Usuario: his.users.first_name,
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
        <h1>Historial de Descargas</h1>
        {/* <CsvDownloader
          className="btn-addUsers"
          filename="lista_de_usuarios"
          extension=".csv"
          separator=";"
          wrapColumnChar="'"
          datas={transformHistoryData()}
          text="Exportar Historial"
        /> */}
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
                <th>Nombre de la descarga</th>
                <th>Tamaño</th>
                <th>Fecha de descarga</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {!loader
                ? history.map((his: any, index: number) => {
                  const downloadSize = Number(his.size);
                  let gbSize = downloadSize / (1024 * 1024 * 1024);
                  return (
                    <tr key={"admin_history_" + index}>
                      <td>{his.email}</td>
                      <td>{his.phone}</td>
                      <td>{his.fileName}</td>
                      <td>{gbSize.toFixed(2)} GB</td>
                      <td>{his.date.toLocaleDateString()}</td>
                      <td>
                        {his.isFolder ? "Carpeta" : "Archivo"}
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
                      <td />
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
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
  );
};
