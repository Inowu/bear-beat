import './../Modal.scss'
import './HistoryModal.scss'
import { ARRAY_10 } from "../../../utils/Constants";
import { IAdminDownloadHistory, IAdminUser } from "../../../interfaces/admin";
import { Modal } from 'react-bootstrap'
import { RiCloseCircleLine } from 'react-icons/ri'
import { useState, useEffect } from 'react'
import Pagination from "../../../components/Pagination/Pagination";
import trpc from "../../../api";

interface ICondition {
    show: boolean;
    onHide: () => void;
    user: IAdminUser;
}

interface IAdminFilter {
    page: number;
    limit: number;
}

export function HistoryModal(props: ICondition) {
    const { show, onHide, user } = props;
    const [loader, setLoader] = useState<boolean>(false);
    const [totalLoader, setTotalLoader] = useState<boolean>(false);
    const [history, setHistory] = useState<IAdminDownloadHistory[]>([]);
    const [totalHistory, setTotalHistory] = useState(0);
    const [filters, setFilters] = useState<IAdminFilter>({
        page: 0,
        limit: 20,
    });
    const [remainingGigas, setRemainingGigas] = useState<number>(0);

    const filterHistory = async (filt: IAdminFilter) => {
        setLoader(true);
        setTotalLoader(true);
        try {
            const body = {
                take: filt.limit,
                skip: filt.page * filt.limit,
                orderBy: {
                    date: "desc",
                },
                where: {
                    userId: user.id
                }
            }
            const tempHistory = await trpc.downloadHistory.getDownloadHistory.query(body);
            const tempGigas = await trpc.downloadHistory.getRemainingGigas.query({ userId: user.id });

            setLoader(false);
            setHistory(tempHistory.data);
            setTotalHistory(tempHistory.count);
            setRemainingGigas(tempGigas ? tempGigas / (1024 * 1024 * 1024) : tempGigas);

            setTotalLoader(false);
        } catch (error) {
            console.log(error);
        }
    };

    const startFilter = (key: string, value: string | number) => {
        let tempFilters: any = filters;
        tempFilters[key] = value;
        filterHistory(tempFilters);
        setFilters(tempFilters);
    };

    useEffect(() => {
        if (user) {
            filterHistory(filters);
        }
    }, [user]);

    return (
        <Modal show={show} onHide={onHide} centered>
            <div className='modal-container success-modal'>
                <div className='header'>
                    <p className='title'>Historial de descargas</p>
                    <RiCloseCircleLine className='icon' onClick={onHide} />
                </div>
                <div className='bottom'>
                    <p className='content'>
                        {remainingGigas.toFixed(2)} GB restantes.
                    </p>
                    <div className="table-contain">
                        <table>
                            <thead>
                                <tr>
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
        </Modal>
    )
}