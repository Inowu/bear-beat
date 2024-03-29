import React, { useEffect, useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import { HiOutlineMusicalNote } from "react-icons/hi2";
import { Spinner } from "../../components/Spinner/Spinner";
import "./FileLoader.scss";
import { useUserContext } from "../../contexts/UserContext";
import { useDownloadContext } from "../../contexts/DownloadContext";
import { useSSE } from "react-hooks-sse";
import trpc from "../../api";

export const FileLoader = () => {
  const { currentUser, userToken } = useUserContext();
  const { currentFile, fileData, setShowDownload } = useDownloadContext();
  const startDownloadAlbum = async (url: string) => {
    const a: any = document.createElement("a");
    try {
      const response = await fetch(url);
      setShowDownload(false);
      if (response.ok) {
        a.href = url;
        a.download = fileData.name;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
      }
    } catch (error: any) {
      setShowDownload(false);
      console.log(error.message);
    }
  };
  const stopDownloadAlbum = async () => {
    try {
      let jobID: any = downloading.jobId;
      const response = await trpc.ftp.cancelDirDownload.mutate({
        jobId: jobID,
      });
      setShowDownload(false);
    } catch (error: any) {
      console.log(error.message);
    }
  };
  const downloading = useSSE(`compression:progress:${currentUser?.id}`, {
    jobId: null,
    progress: 0,
  });
  const completed = useSSE(`compression:completed:${currentUser?.id}`, {
    jobId: null,
    url: "",
  });
  useEffect(() => {
    if (completed.url !== "") {
      const url = completed.url + "&token=" + userToken;
      startDownloadAlbum(url);
    }
  }, [completed]);
  return (
    <div className="file-loader-contain">
      <div className="header">
        <p className="title">Descargas</p>
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
              <button onClick={stopDownloadAlbum}>Cancelar</button>
              <p>{downloading.progress}% </p>
              <Spinner size={3} width={0.5} color="#00e2f7" />
            </div>
          </div>
        }
      </div>
    </div>
  );
};
