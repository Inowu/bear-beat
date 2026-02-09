import React, { useEffect } from "react";
import { Music } from "lucide-react";
import { Spinner } from "../../components/Spinner/Spinner";
import "./FileLoader.scss";
import { useUserContext } from "../../contexts/UserContext";
import { useDownloadContext } from "../../contexts/DownloadContext";
import trpc from "../../api";
import { useSafeSSE } from "../../utils/sse";
import { formatBytes } from "../../utils/format";

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
    } catch {
      setShowDownload(false);
    }
  };
  const stopDownloadAlbum = async () => {
    try {
      let jobID: any = downloading.jobId;
      await trpc.ftp.cancelDirDownload.mutate({
        jobId: jobID,
      });
      setShowDownload(false);
    } catch {
      setShowDownload(false);
    }
  };
  const downloading = useSafeSSE(`compression:progress:${currentUser?.id}`, {
    jobId: null,
    progress: 0,
  });
  const completed = useSafeSSE(`compression:completed:${currentUser?.id}`, {
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
      <div className="header">
        <p className="subtitle">No cierres ni actualices el navegador hasta que termine la descarga.</p>
      </div>
      <div className="files-list">
        {
            <div className="file-contain">
            <div className="left-side">
              <Music aria-hidden />
              <div className="title-contain">
                <p>{currentFile && currentFile.name}</p>
                <p>
                  {currentFile ? formatBytes(currentFile.size) : "—"}
                </p>
              </div>
            </div>
            <div className="right-side">
              <button onClick={stopDownloadAlbum}>Cancelar</button>
              <p>{downloading.progress}% </p>
              <Spinner size={3} width={0.5} color="var(--app-accent)" />
            </div>
          </div>
        }
      </div>
    </div>
  );
};
