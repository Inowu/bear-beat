import trpc from "../api";
import { FileLoader } from "../components/FileLoader/FileLoader";
import { createContext, useContext, useEffect, useState } from "react";

interface IDownloadContext {
  showDownload: boolean;
  setShowDownload: any;
  currentFile: null | any;
  setCurrentFile: any;
  viewDownload: any;
  setViewDownload: any;
  setPath: any;
  path: string;
}

export const DownloadContext = createContext<IDownloadContext>({
  showDownload: false,
  setShowDownload: () => {},
  currentFile: null,
  setCurrentFile: () => {},
  viewDownload: false,
  setViewDownload: () => {},
  path: "",
  setPath: () => {},
});
export function useDownloadContext() {
  return useContext(DownloadContext);
}
const DownloadContextProvider = (props: any) => {
  const [showDownload, setShowDownload] = useState<boolean>(false);
  const [currentFile, setCurrentFile] = useState<any>(null);
  const [path, setPath] = useState<string>("");
  const [viewDownload, setViewDownload] = useState({
    jobId: null,
    progress: 0,
  });

  const values = {
    showDownload,
    setShowDownload,
    setCurrentFile,
    currentFile,
    viewDownload,
    setViewDownload,
    path,
    setPath,
  };
  //   if (loader) return <FileLoader />;

  return (
    <DownloadContext.Provider value={values}>
      {props.children}
    </DownloadContext.Provider>
  );
};

export default DownloadContextProvider;
