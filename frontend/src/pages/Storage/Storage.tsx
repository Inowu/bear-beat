import trpc from "api";
import { getCompleted, transformBiteToGb } from "../../functions/functions";
import "./Storage.scss";

export const Storage = () => {

    const getStorage = async () => {
        try {
            // await trpc.
            // console.log(body);
        }
        catch (error) {
            console.log(error)
        }
    }


    return (
        <div className="storage">
            <div className="storage-card">
                <h2 className="title">
                    Almacenamiento del Servidor:
                </h2>
                <h3>
                    {/* <span>{transformBiteToGb(used)}GB</span> de {transformBiteToGb(available)}GB */}
                </h3>
                <div className="progress-bar-container">
                    <div className="progress-bar" />
                </div>
            </div>
        </div>
    )
}
