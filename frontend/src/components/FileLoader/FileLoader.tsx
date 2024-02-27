import React, { useEffect, useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import { HiOutlineMusicalNote } from "react-icons/hi2";
import { Spinner } from "../../components/Spinner/Spinner";
import "./FileLoader.scss";
import { useUserContext } from "../../contexts/UserContext";
import { useDownloadContext } from "../../contexts/DownloadContext";

export const FileLoader = () => {
  const { currentFile, setShowDownload, viewDownload, fileData } =
    useDownloadContext();
  const startDownload = async () => {
    console.log(fileData.path);
    const a: any = document.createElement("a");
    try {
      const response = await fetch(fileData.path);
      if (response.ok) {
        a.href = fileData.path;
        a.download = fileData.name;
        a.click();
        window.URL.revokeObjectURL(fileData.path);
      } else {
        // errorMethod("Para descargar se necesita tener gb disponibles");
      }
    } catch (error: any) {
      //   errorMethod("Para descargar se necesita tener gb disponibles");
      console.log(error.message);
    }
  };
  useEffect(() => {
    console.log(viewDownload);
    if (viewDownload.progress === 100) {
      startDownload();
      setShowDownload(false);
    }
  }, [viewDownload]);
  console.log(viewDownload);
  return (
    <div className="file-loader-contain">
      <div className="header">
        <p className="title">Descargas</p>
      </div>
      <div className="loader">
        <p>{viewDownload.progress}% cargado</p>
        {/* <button>Cancelar Todo</button> */}
      </div>
      <div className="files-list">
        {
          <div className="file-contain">
            <div className="left-side">
              <HiOutlineMusicalNote />
              <div className="title-contain">
                <p>{currentFile && currentFile.name}</p>
                <p>
                  {currentFile &&
                    (currentFile.size / (1024 * 1024 * 1024)).toFixed(2)}{" "}
                  GB
                </p>
              </div>
            </div>
            <div className="right-side">
              {/* <button>Cancelar</button> */}
              <Spinner size={3} width={0.5} color="#00e2f7" />
            </div>
          </div>
        }
      </div>
    </div>
  );
};
