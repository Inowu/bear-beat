import React, { useEffect } from "react";
import { Music } from "src/icons";
import { Spinner } from "../../components/Spinner/Spinner";
import "./FileLoader.scss";
import { useUserContext } from "../../contexts/UserContext";
import { useDownloadContext } from "../../contexts/DownloadContext";
import trpc from "../../api";
import { useSafeSSE } from "../../utils/sse";
import { formatBytes } from "../../utils/format";
import { Button } from "src/components/ui";
export const FileLoader = () => {
  const { currentUser, userToken } = useUserContext();
  const { currentFile, fileData, setShowDownload } = useDownloadContext();
  const startDownloadAlbum = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileData.name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setShowDownload(false);
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
  const queued = useSafeSSE(`compression:queued:${currentUser?.id}`, {
    jobId: null,
    progress: 0,
    queueDepth: 0,
  });
  const completed = useSafeSSE(`compression:completed:${currentUser?.id}`, {
    jobId: null,
    url: "",
  });
  const isQueued = Boolean(queued.jobId) && Number(downloading.progress) === 0;
  const queueDepth = Number(queued.queueDepth || 0);
  const statusMessage = isQueued
    ? queueDepth > 1
      ? `En cola (${queueDepth} activas/en espera)`
      : "En cola"
    : "Comprimiendo";
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
              <Button unstyled onClick={stopDownloadAlbum}>Cancelar</Button>
              <p>{isQueued ? statusMessage : `${downloading.progress}%`}</p>
              <Spinner size={3} width={0.5} color="var(--app-accent)" />
            </div>
          </div>
        }
      </div>
    </div>
  );
};
