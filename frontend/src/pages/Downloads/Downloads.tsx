import React, { useEffect, useState } from "react";
import "./Downloads.scss";
import { HiFolderArrowDown } from "react-icons/hi2";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { FaMusic } from "react-icons/fa6";
import { IDownloads } from "interfaces/Files";
import trpc from "../../api";

function Downloads() {
  const [downloads, setDownloads] = useState<any | null>(null);
  const retreiveDownloads = async () => {
    try {
      const downloads = await trpc.dirDownloads.myDirDownloads.query();
      setDownloads(downloads);
    } catch (error: any) {
      console.log(error.message);
    }
  };
  useEffect(() => { retreiveDownloads(); }, []);

  return (
    <div className="downloads-container w-full max-w-[100vw] overflow-x-hidden">
      <div className="header">
        <div className="left-side">
          <HiFolderArrowDown />
          <h2>Historial de descargas</h2>
        </div>
        {/* <div className="right-side">
          <div className="search-input">
            <input
              placeholder="Buscar"
               onChange={(e: any) => { startFilter('search', e.target.value) }}
            />
            <FontAwesomeIcon icon={faSearch} />
          </div>
        </div> */}
      </div>
      <div className="table-line">
        <p>Nombre</p>
        <p>Descargado</p>
      </div>
      <div className="card-container">
        {downloads !== null &&
          downloads.map((download: IDownloads, index: number) => {
            return (
              <div className="single-card" key={"downloads " + index}>
                <div className="left-side min-w-0 flex-1">
                  <FaMusic className="flex-shrink-0" />
                  <p className="truncate">{download.dirName}</p>
                </div>
                <p className="flex-shrink-0">{download.date.toLocaleDateString()}</p>
              </div>
            );
          })}
      </div>
    </div>
  );
}
export default Downloads;
