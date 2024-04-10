import "./Home.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFolder,
  faPlay,
  faDownload,
  faArrowLeft,
  faChevronRight,
  faSearch,
} from "@fortawesome/free-solid-svg-icons";
import PreviewModal from "../../components/PreviewModal/PreviewModal";
import { useEffect, useState } from "react";
import trpc from "../../api";
import { IFiles } from "interfaces/Files";
import { downloadMP3, sortArrayByName } from "../../functions/functions";
import { Spinner } from "../../components/Spinner/Spinner";
import { useUserContext } from "../../contexts/UserContext";
import { ErrorModal } from "../../components/Modals/ErrorModal/ErrorModal";
import { useDownloadContext } from "../../contexts/DownloadContext";
import { ConditionModal } from "../../components/Modals/ConditionModal/ContitionModal";
import { of } from "await-of";

interface IAlbumData {
  name: string;
  type: string;
  path?: string;
  size: number;
  idx: number;
  gbSize: number;
}

interface QueryFolder {
  back?: boolean, 
  next?: string, 
  folder?: number
}

function Home() {
  const { fileChange, closeFile, userToken, currentUser } = useUserContext();
  const { setShowDownload, setCurrentFile, setFileData } = useDownloadContext();
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [showConditionModal, setShowConditionModal] = useState<boolean>(false);
  const [albumData, setAlbumData] = useState<IAlbumData>({} as IAlbumData);
  const [error, setError] = useState<boolean>(false);
  const [errMsg, setErrMsg] = useState<any>("");
  const [files, setfiles] = useState<IFiles[]>([]);
  const [pastFile, setPastFile] = useState<string[]>([]);
  const [loader, setLoader] = useState<boolean>(false);
  const [loadFile, setLoadFile] = useState<boolean>(false);
  const [loadDownload, setLoadDownload] = useState<boolean>(false);
  const [fileToShow, setFileToShow] = useState<any>(null);
  const [index, setIndex] = useState<number>(-1);
  const [show, setShow] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>("");
  const closeError = () => {
    setShow(false);
  };
  const handleError = () => {
    setError(!error);
  };
  const closeConditionModal = () => {
    setShowConditionModal(false);
  };
  const checkAlbumSize = (file: IFiles, idx: number) => {
    let gbSize = file.size / (1024 * 1024 * 1024);
    if (gbSize >= 1) {
      setAlbumData({ ...file, idx, gbSize });
      setShowConditionModal(true);
    } else {
      startAlbumDownload(file, idx);
    }
  };
  const getFiles = async () => {
    setLoader(true);
    let body = {
      path: "",
    };
    try {
      const files = await trpc.ftp.ls.query(body);
      setfiles(files);
      setLoader(false);
    } catch (error) {
      console.log(error);
      setLoader(false);
    }
  };

  const goToFolder = async (query: QueryFolder) => {
    setLoader(true);
    let fileStructure = pastFile;

    // Goes back one level
    if (query.back) {
      fileStructure.pop();
    }

    // Goes up one level
    if (query.next) {
      fileStructure.push(query.next);
    }

    // Goes to specific folder
    if (query.folder) {
      fileStructure = pastFile.slice(0, query.folder);
    }

    const [files, filesError] = await of(trpc.ftp.ls.query({
      path: fileStructure.join("/"),
    }));

    if (filesError && !files) {
      console.log(filesError);
      setLoader(false);
      return;
    }

    setPastFile(fileStructure);
    setfiles(files!);
    setLoader(false);
  }

  const playFile = async (file: IFiles, index: number) => {
    setLoadFile(true);
    setIndex(index);
    try {
      let path: any = "";
      if (!file.path) {
        path = "/" + pastFile.join("/") + "/" + file.name;
      } else {
        path = file.path;
      }
      const files_demo = await trpc.ftp.demo.query({ path: path });
      setFileToShow(encodeURI("https://thebearbeatapi.lat" + files_demo.demo));
      setIndex(-1);
      setLoadFile(false);
      setShowPreviewModal(true);
    } catch (error) {
      setIndex(-1);
      setLoadFile(false);
    }
  };
  const errorMethod = (message: string) => {
    setErrorMessage(message);
    setShow(true);
    setLoadDownload(false);
    setIndex(-1);
  };
  const downloadFile = async (file: any, index: number) => {
    console.log(file);
    setLoadDownload(true);
    setIndex(index);
    let name = file.name;
    if (file.path) {
      name = file.path;
    }
    if (currentUser?.hasActiveSubscription) {
      let path = pastFile.join("/") + "/" + name;
      //TEST
      // const url = "https://kale67.world/download?path=" + encodeURIComponent(path) + '&token=' + userToken;
      // DOMAIN
      const url =
        "https://thebearbeatapi.lat/download?path=" +
        encodeURIComponent(path) +
        "&token=" +
        userToken;
      await startDownload(url, name);
      console.log(url);
    } else {
      errorMethod("Para descargar se necesita de una suscripción");
    }
  };
  const startAlbumDownload = async (file: IFiles, index: number) => {
    setLoadDownload(true);
    setIndex(index);
    let name = file.name;
    if (file.path) {
      name = file.path;
    }
    if (currentUser?.hasActiveSubscription) {
      let path = pastFile.join("/") + "/" + name;
      //TEST
      // const url = "https://kale67.world/download-dir?path=" + encodeURIComponent(path) + '&token=' + userToken;
      // DOMAIN
      const url =
        "https://thebearbeatapi.lat/download-dir?path=" +
        encodeURIComponent(path) +
        "&token=" +
        userToken;
      await downloadAlbum(path, file, url);
      setLoadDownload(false);
      setIndex(-1);
    } else {
      errorMethod("Para descargar se necesita de una suscripción");
      setLoadDownload(false);
      setIndex(-1);
    }
  };
  const downloadAlbum = async (path: string, file: any, url: string) => {
    let body = {
      path: path,
    };
    try {
      setShowDownload(true);
      const album = await trpc.ftp.downloadDir.query(body);
      setCurrentFile(file);
      setFileData({
        path: url,
        name: file.name,
      });
    } catch (error: any) {
      setErrMsg(error.message);
      handleError();
    }
  };
  const startDownload = async (url: any, name: any) => {
    const a: any = document.createElement("a");
    try {
      const response = await fetch(url);
      if (response.ok) {
        a.href = url;
        a.download = name;
        a.click();
        window.URL.revokeObjectURL(url);
        setLoadDownload(false);
        setIndex(-1);
      } else {
        errorMethod("Para descargar se necesita tener gb disponibles");
      }
    } catch (error) {
      errorMethod("Para descargar se necesita tener gb disponibles");
    }
  };
  const startSearch = async (value: string) => {
    setPastFile([]);
    if (value === "") {
      return getFiles();
    }
    let body = {
      query: value,
      limit: 20,
    };
    try {
      const result: any = await trpc.ftp.search.query(body);
      let values: any = [];
      result.documents.map((val: any) => {
        if (val.value) {
          values.push(val.value);
        } else {
          values.push(val);
        }
      });
      setfiles(values);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    getFiles();
  }, []);
  useEffect(() => {
    if (fileChange) {
      closeFile();
      getFiles();
      setPastFile([]);
    }
  }, [fileChange]);
  return (
    <div className="home-main-container">
      <PreviewModal
        show={showPreviewModal}
        file={fileToShow}
        onHide={() => setShowPreviewModal(!showPreviewModal)}
      />
      <div className="header-contain">
        <h2>
          <FontAwesomeIcon icon={faFolder} /> Todos los archivos
        </h2>
        <div className="search-input">
          <input
            placeholder="Buscar"
            onChange={(e: any) => {
              startSearch(e.target.value);
            }}
          />
          <FontAwesomeIcon icon={faSearch} />
        </div>
      </div>
      {pastFile.length > 0 && (
        <>
          <div className="folder-structure-container">
            {pastFile.map((file: any, index) => {
              const isLastFolder = pastFile.length == index + 1
              if (isLastFolder) {
                return (
                  <p
                    key={`folder_${index}`}
                    className="last-folder"
                  >
                    {file}
                  </p>
                )
              }
              return (
                <div>
                  <p
                    key={`folder_${index}`}
                    onClick={() => { goToFolder({folder: index + 1}) }}
                  >
                    {file}
                  </p>
                  <FontAwesomeIcon icon={faChevronRight} />
                </div>
              )
            })}
          </div>
          <div className="btn-back">
            <button onClick={() => {goToFolder({back: true})}}>
              <FontAwesomeIcon icon={faArrowLeft} />
              Back
            </button>
          </div>
        </>
      )}
      <div className="folders-navigation-container">
        <div className="header">
          <div>Nombre</div>
          <div className="modified-column">Modificado</div>
        </div>
        <div className="folders-cards-container">
          {!loader ? (
            sortArrayByName(files).map((file: IFiles, idx: number) => {
              return (
                <div key={"files " + idx}>
                  {file.type === "d" && (
                    <div className="folder-card">
                      <div
                        className="name-container"
                        onClick={() => {goToFolder({next: file.name})}}
                      >
                        <FontAwesomeIcon icon={faFolder} />
                        <h3>{file.name}</h3>
                      </div>
                      <div className="modified-column">
                        <h4>
                          {new Date().toLocaleString("en-US", {
                            month: "short",
                            day: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </h4>
                      </div>

                      <div className="download-button">
                        {loadDownload && index === idx ? (
                          <Spinner size={2} width={0.2} color="black" />
                        ) : (
                          <FontAwesomeIcon
                            icon={faDownload}
                            onClick={() => checkAlbumSize(file, idx)}
                          />
                        )}
                      </div>
                    </div>
                  )}
                  {file.type === "-" && (
                    <div className="folder-card video-card">
                      {loadFile && index === idx ? (
                        <Spinner size={2} width={0.2} color="black" />
                      ) : (
                        <FontAwesomeIcon
                          icon={faPlay}
                          onClick={() => playFile(file, idx)}
                        />
                      )}

                      <div className="name-container">
                        <h3>{file.name}</h3>
                      </div>
                      {loadDownload && index === idx ? (
                        <Spinner size={2} width={0.2} color="black" />
                      ) : (
                        <FontAwesomeIcon
                          icon={faDownload}
                          onClick={() => downloadFile(file, idx)}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <Spinner size={4} width={0.4} color="#2c2c2c" />
          )}
        </div>
      </div>
      <ConditionModal
        show={showConditionModal}
        onHide={closeConditionModal}
        action={() => startAlbumDownload(albumData, albumData.idx)}
        title="Descarga de Archivos"
        message={`El siguiente archivo pesa ${albumData.gbSize && albumData.gbSize.toFixed(2)
          }GB, presiona confirmar para continuar con la descarga.`}
      />
      <ErrorModal
        show={show}
        onHide={closeError}
        message={errorMessage}
        user={currentUser}
      />
      <ErrorModal show={error} onHide={handleError} message={errMsg} />
    </div>
  );
}

export default Home;
