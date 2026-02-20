import React, { useEffect, useMemo, useRef } from "react";
import { Music } from "src/icons";
import { Spinner } from "../../components/Spinner/Spinner";
import "./FileLoader.scss";
import { useUserContext } from "../../contexts/UserContext";
import { useDownloadContext } from "../../contexts/DownloadContext";
import trpc from "../../api";
import { useSafeSSE } from "../../utils/sse";
import { formatBytes } from "../../utils/format";
import { Button } from "src/components/ui";
import { apiBaseUrl } from "../../utils/runtimeConfig";

const appendTokenToUrl = (url: string, token: string): string => {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("token", token);
    return parsed.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}token=${encodeURIComponent(token)}`;
  }
};

export const FileLoader = () => {
  const { currentUser, userToken } = useUserContext();
  const { currentFile, fileData, setShowDownload } = useDownloadContext();
  const startedDownloadRef = useRef(false);
  const startDownloadAlbum = (url: string) => {
    if (!url || startedDownloadRef.current) return;
    startedDownloadRef.current = true;
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
      const jobID = `${activeJobId ?? ""}`.trim();
      if (!jobID) {
        setShowDownload(false);
        return;
      }
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
  const activeJobId = useMemo(() => {
    const fromProgress = `${downloading.jobId ?? ""}`.trim();
    const fromQueued = `${queued.jobId ?? ""}`.trim();
    const fromFileData = `${fileData.jobId ?? ""}`.trim();
    return fromProgress || fromQueued || fromFileData;
  }, [downloading.jobId, queued.jobId, fileData.jobId]);
  const fallbackDirName = useMemo(() => {
    const provided = `${fileData.dirName ?? ""}`.trim();
    if (provided) return provided;
    if (!activeJobId || !currentUser?.id) return "";
    const safeBase = `${fileData.name ?? ""}`.trim().replace(/[\\/]+/g, "-");
    if (!safeBase) return "";
    return `${safeBase}-${currentUser.id}-${activeJobId}.zip`;
  }, [fileData.dirName, fileData.name, activeJobId, currentUser?.id]);
  const progress = Math.max(0, Number(downloading.progress || 0));
  const hasSseSignal =
    Boolean(queued.jobId) ||
    Boolean(downloading.jobId) ||
    Boolean(completed.url) ||
    progress > 0;
  const isQueued = Boolean(queued.jobId) && progress === 0;
  const queueDepth = Number(queued.queueDepth || 0);
  const statusMessage = isQueued
    ? queueDepth > 1
      ? `En cola (${queueDepth} activas/en espera)`
      : "En cola"
    : "Comprimiendo";
  const progressLabel = isQueued
    ? statusMessage
    : progress > 0
      ? `${progress}%`
      : activeJobId && !hasSseSignal
        ? "Preparando archivo..."
        : "0%";

  useEffect(() => {
    startedDownloadRef.current = false;
  }, [activeJobId, fallbackDirName]);

  useEffect(() => {
    if (completed.url !== "") {
      startDownloadAlbum(appendTokenToUrl(completed.url, userToken));
    }
  }, [completed.url, userToken]);

  useEffect(() => {
    if (!activeJobId || !fallbackDirName || !userToken || startedDownloadRef.current) {
      return;
    }

    const downloadUrl = `${apiBaseUrl}/download-dir?dirName=${encodeURIComponent(
      fallbackDirName,
    )}&jobId=${encodeURIComponent(activeJobId)}&token=${encodeURIComponent(
      userToken,
    )}`;

    let cancelled = false;

    const probeDownloadReadiness = async () => {
      if (cancelled || startedDownloadRef.current) return;
      try {
        const response = await fetch(downloadUrl, { method: "HEAD" });
        if (response.ok) {
          startDownloadAlbum(downloadUrl);
          return;
        }
        if (response.status === 401 || response.status === 403) {
          setShowDownload(false);
        }
      } catch {
        // Best effort fallback when SSE is unavailable.
      }
    };

    void probeDownloadReadiness();
    const interval = window.setInterval(() => {
      void probeDownloadReadiness();
    }, 7000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeJobId, fallbackDirName, userToken, setShowDownload]);

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
              <p>{progressLabel}</p>
              <Spinner size={3} width={0.5} color="var(--app-accent)" />
            </div>
          </div>
        }
      </div>
    </div>
  );
};
