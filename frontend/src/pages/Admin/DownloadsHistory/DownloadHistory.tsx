import "./DownloadHistory.scss";
import { AddInstructionsModal } from "../../../components/Modals";
import { ARRAY_10 } from "../../../utils/Constants";
import { IAdminDownloadHistory } from "../../../interfaces/admin";
import { of } from "await-of";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserContext } from "../../../contexts/UserContext";
import Pagination from "../../../components/Pagination/Pagination";
import trpc from "../../../api";

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
  const [showModal, setShowModal] = useState<boolean>(false);
  const [videoURL, setVideoURL] = useState<string>("");
  const [videoId, setVideoId] = useState<number>(0);

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
      const tempHistory =
        await trpc.downloadHistory.getDownloadHistory.query({
          take: filt.limit,
          skip: filt.page * filt.limit,
          orderBy: {
            date: "desc",
          },
        });

      setLoader(false);
      setHistory(tempHistory.data);
      setTotalHistory(tempHistory.count);
      setTotalLoader(false);
    } catch (error) {
      console.log(error);
    }
  };

  const getConfig = async () => {
    const [videoConfig, errorVideoConfig] = await of(trpc.config.findFirstConfig.query({ where: { name: 'videoURL' } }));

    console.log(videoConfig)
    if (!videoConfig) {
      console.error(errorVideoConfig);
      return;
    }

    setVideoURL(videoConfig.value);
    setVideoId(videoConfig.id);
  }

  const onHideModal = () => {
    setShowModal(false);
  }

  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") {
      navigate("/");
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    filterHistory(filters);
  }, [filters]);

  useEffect(() => {
    getConfig();
  }, []);

  return (
    <div className="coupons-contain history-contain">
      <div className="header">
        <h1>Historial de Descargas</h1>
        <button className="btn-addUsers" onClick={() => setShowModal(true)}>
          Añadir instrucciones
        </button>
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
                      <td data-label="Email">{his.email}</td>
                      <td data-label="Teléfono">{his.phone}</td>
                      <td data-label="Nombre descarga">{his.fileName}</td>
                      <td data-label="Tamaño">{gbSize.toFixed(2)} GB</td>
                      <td data-label="Fecha">{his.date.toLocaleDateString()}</td>
                      <td data-label="Tipo">
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
            <tfoot>
              <tr>
                <th colSpan={8}>
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
      <AddInstructionsModal
        showModal={showModal}
        onHideModal={onHideModal}
        videoURL={videoURL}
        videoId={videoId}
      />
    </div>
  );
};
