import trpc from "../../api";
import { useEffect, useState } from "react";
import { getCompleted, transformBiteToGb } from "../../functions/functions";
import "./Storage.scss";

export const Storage = () => {

    const [storage, setStorage] = useState({
        used_storage: 0,
        total_storage: 0,
        available_storage: 0
    });
    const styles = {
        width: getCompleted(storage.used_storage, storage.total_storage) > 5 ? getCompleted(storage.used_storage, storage.total_storage) + "%" : "5%"
    }

    const getStorage = async () => {
        try {
            const data = await trpc.ftp.storage.query();
            setStorage(data);
            console.log(storage);
        }
        catch (error) {
            console.log(error)
        }
    }

    useEffect(() => {
        getStorage();
    }, [])



    return (
        <div className="storage">
            <div className="storage-card">
                <h2 className="title">
                    Almacenamiento del Servidor:
                </h2>
                <h3>
                    Espacio Usado: 
                    <span> {transformBiteToGb(storage.used_storage)}GB de {transformBiteToGb(storage.total_storage)}GB</span>
                </h3>
                <div className="progress-bar-container">
                    <div className="progress-bar" style={styles} />
                </div>
                <h3>Espacio Disponible: <span>{transformBiteToGb(storage.available_storage)}GB</span></h3> 
            </div>
        </div>
    )
}
