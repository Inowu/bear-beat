import trpc from "../../../api";
import { useEffect, useState } from "react";
import { getCompleted, transformBiteToGb } from "../../../functions/functions";
import "./Storage.scss";
import { Spinner } from "../../../components/Spinner/Spinner";

export const Storage = () => {

    const [storage, setStorage] = useState<any>({
        used_storage: 0,
        total_storage: 0,
        available_storage: 0
    });
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const styles = {
        width: getCompleted(storage.used_storage, storage.total_storage) > 5 ? getCompleted(storage.used_storage, storage.total_storage) + "%" : "5%"
    }

    const getStorage = async () => {
        try {
            let data = await trpc.ftp.storage.query();
            const reservedSpace = data.total_storage * 0.05;
            data = {...data, reserved_space: reservedSpace};
            
            setStorage(data);
            setIsLoading(false);
        }
        catch (error) {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        getStorage();
    }, [])

    return (
        <div className="storage">
            {!isLoading ? <div className="storage-card">
                <h2 className="title">
                    Almacenamiento del Servidor:
                </h2>
                <h3>
                    Espacio Usado:
                    <span> {transformBiteToGb(storage.used_storage)}GB de {transformBiteToGb(storage.total_storage)}GB</span>
                </h3>
                <div className="progress-bar-container">
                    <div className="progress-bar reserved-space-bar" />
                    <div className="progress-bar" style={styles} />
                </div>
                <h3>Espacio Reservado: <span>{transformBiteToGb(storage.reserved_space)}GB</span></h3>
                <h3>Espacio Disponible: <span>{transformBiteToGb(storage.available_storage)}GB</span></h3>
            </div> :
                <Spinner size={3} width={.3} color="#00e2f7" />}
        </div>
    )
}
