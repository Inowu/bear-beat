import trpc from "../api";
import { FileLoader } from "../components/FileLoader/FileLoader";
import { createContext, useContext, useEffect, useState } from "react";

interface IDownloadContext {
  showDownload: boolean;
  setShowDownload: any;
  currentFile: null | any;
  setCurrentFile: any;
  fileData: {
    path: string;
    name: string;
    jobId: string;
    dirName: string;
  };
  setFileData: any;
}

export const DownloadContext = createContext<IDownloadContext>({
  showDownload: false,
  setShowDownload: () => {},
  currentFile: null,
  setCurrentFile: () => {},
  fileData: {
    path: "",
    name: "",
    jobId: "",
    dirName: "",
  },
  setFileData: () => {},
});
export function useDownloadContext() {
  return useContext(DownloadContext);
}
const DownloadContextProvider = (props: any) => {
  const [showDownload, setShowDownload] = useState<boolean>(false);
  const [currentFile, setCurrentFile] = useState<any>(null);
  const [fileData, setFileData] = useState({
    path: "",
    name: "",
    jobId: "",
    dirName: "",
  });

  const values = {
    showDownload,
    setShowDownload,
    setCurrentFile,
    currentFile,
    fileData,
    setFileData,
  };
  //   if (loader) return <FileLoader />;

  return (
    <DownloadContext.Provider value={values}>
      {props.children}
    </DownloadContext.Provider>
  );
};

export default DownloadContextProvider;
