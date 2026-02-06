import './Home.scss';
import {
  FolderOpen,
  ArrowLeft,
  ChevronRight,
  Search,
  Play,
  Download,
} from 'lucide-react';
import PreviewModal from '../../components/PreviewModal/PreviewModal';
import { useEffect, useState } from 'react';
import trpc from '../../api';
import { IFiles } from 'interfaces/Files';
import { sortArrayByName } from '../../functions/functions';
import { Spinner } from '../../components/Spinner/Spinner';
import { useUserContext } from '../../contexts/UserContext';
import { ErrorModal } from '../../components/Modals/ErrorModal/ErrorModal';
import { useDownloadContext } from '../../contexts/DownloadContext';
import { ConditionModal } from '../../components/Modals/ConditionModal/ContitionModal';
import { of } from 'await-of';
import Pagination from '../../components/Pagination/Pagination';
import { UsersUHModal } from '../../components/Modals/UsersUHModal/UsersUHModal';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

interface IAlbumData {
  name: string;
  type: string;
  path?: string;
  size: number;
  idx: number;
  gbSize: number;
}

interface QueryFolder {
  back?: boolean;
  next?: string;
  folder?: number;
}

const stripeKey =
  process.env.REACT_APP_ENVIRONMENT === 'development'
    ? (process.env.REACT_APP_STRIPE_TEST_KEY as string)
    : (process.env.REACT_APP_STRIPE_KEY as string);

const stripePromise = loadStripe(stripeKey);

function Home() {
  const { fileChange, closeFile, userToken, currentUser } = useUserContext();
  const { setShowDownload, setCurrentFile, setFileData } = useDownloadContext();
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showConditionModal, setShowConditionModal] = useState<boolean>(false);
  const [albumData, setAlbumData] = useState<IAlbumData>({} as IAlbumData);
  const [error, setError] = useState<boolean>(false);
  const [errMsg, setErrMsg] = useState<any>('');
  const [files, setfiles] = useState<IFiles[]>([]);
  const [pastFile, setPastFile] = useState<string[]>([]);
  const [loader, setLoader] = useState<boolean>(false);
  const [loadFile, setLoadFile] = useState<boolean>(false);
  const [loadDownload, setLoadDownload] = useState<boolean>(false);
  const [fileToShow, setFileToShow] = useState<any>(null);
  const [index, setIndex] = useState<number>(-1);
  const [show, setShow] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>('');
  const [paginationLoader, setPaginationLoader] = useState(false);
  const [showPagination, setShowPagination] = useState(false);
  const [totalSearch, setTotalSearch] = useState(0);
  const [filters, setFilters] = useState<{ limit: number; page: number }>({
    limit: 20,
    page: 0,
  });
  const [searchValue, setSearchValue] = useState<string>('');

  const closeError = () => {
    setShow(false);
  };
  const goToRoot = async () => {
    setLoader(true);
    setShowPagination(false);
    setSearchValue('');
    setFilters((prev) => ({ ...prev, page: 0 }));
    const [rootFiles, filesError] = await of(
      trpc.ftp.ls.query({
        path: '',
      })
    );
    if (filesError && !rootFiles) {
      setLoader(false);
      return;
    }
    setPastFile([]);
    setfiles(rootFiles!);
    setLoader(false);
  };
  const clearSearch = async () => {
    setSearchValue('');
    setShowPagination(false);
    setFilters((prev) => ({ ...prev, page: 0 }));
    await goToFolder({});
  };
  const handleError = () => {
    setError(!error);
  };
  const closeConditionModal = () => {
    setShowConditionModal(false);
  };
  const closeModalAdd = () => {
    window.location.reload();
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
      path: '',
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

  const checkUHUser = async () => {
    if (!currentUser) return;
    let body = {
      email: currentUser.email,
    };
    try {
      const userUH = await trpc.migration.checkUHSubscriber.query(body);
      if (
        userUH &&
        userUH.subscriptionEmail &&
        !currentUser.hasActiveSubscription
      ) {
        setShowModal(true);
      }
    } catch (error) {
      console.log(error);
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

    const [files, filesError] = await of(
      trpc.ftp.ls.query({
        path: fileStructure.join('/'),
      })
    );

    if (filesError && !files) {
      setLoader(false);
      return;
    }

    setPastFile(fileStructure);
    setfiles(files!);
    setLoader(false);
  };

  const playFile = async (file: IFiles, index: number) => {
    setLoadFile(true);
    setIndex(index);
    try {
      let path: any = '';
      if (!file.path) {
        path = '/' + pastFile.join('/') + '/' + file.name;
      } else {
        path = file.path;
      }
      const files_demo = await trpc.ftp.demo.query({ path: path });
      setFileToShow(encodeURI('https://thebearbeatapi.lat' + files_demo.demo));
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
    setLoadDownload(true);
    setIndex(index);
    let name = file.name;
    if (file.path) {
      name = file.path;
    }

    if (currentUser?.hasActiveSubscription) {
      // If search is active, the path is different and name contains the whole path.
      let path = showPagination ? name : pastFile.join('/') + '/' + name;
      const domain =
        process.env.REACT_APP_ENVIRONMENT === 'development'
          ? 'http://localhost:5001'
          : 'https://thebearbeatapi.lat';
      const url =
        domain +
        '/download?path=' +
        encodeURIComponent(path) +
        '&token=' +
        userToken;
      await startDownload(url, name);
    } else {
      errorMethod('Para descargar se necesita de una suscripción');
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
      let path = pastFile.join('/') + '/' + name;
      const domain =
        process.env.REACT_APP_ENVIRONMENT === 'development'
          ? 'http://localhost:5001'
          : 'https://thebearbeatapi.lat';
      const url =
        domain +
        '/download-dir?path=' +
        encodeURIComponent(path) +
        '&token=' +
        userToken;
      await downloadAlbum(path, file, url);
      setLoadDownload(false);
      setIndex(-1);
    } else {
      errorMethod('Para descargar se necesita de una suscripción');
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
      await trpc.ftp.downloadDir.query(body);
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
    const a: any = document.createElement('a');
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
        errorMethod('Para descargar se necesita tener gb disponibles');
      }
    } catch (error) {
      errorMethod('Para descargar se necesita tener gb disponibles');
    }
  };
  const startSearch = async (value: string) => {
    setShowPagination(true);
    setPaginationLoader(true);
    // setPastFile([]);
    setSearchValue(value);
    if (value === '') {
      setShowPagination(false);
      setPaginationLoader(false);
      await goToFolder({});
      return;
    }
    let body = {
      query: value,
      limit: filters.limit,
      offset: filters.page * filters.limit,
    };
    try {
      const result = await trpc.ftp.search.query(body);
      let values: any = [];
      result.documents.forEach((val: any) => {
        if (val.value) {
          values.push(val.value);
        } else {
          values.push(val);
        }
      });
      setfiles(values);
      setTotalSearch(result.total);
      setPaginationLoader(false);
    } catch (error) {
      console.log(error);
    }
  };

  const nextPage = (key: string, value: string | number) => {
    let tempFilters: any = filters;
    if (key !== 'page') {
      tempFilters.page = 0;
    }

    tempFilters[key] = value;
    setFilters(tempFilters);
    startSearch(searchValue);
  };

  useEffect(() => {
    getFiles();
  }, []);
  useEffect(() => {
    checkUHUser();
  }, [currentUser]);
  useEffect(() => {
    if (fileChange) {
      closeFile();
      getFiles();
      setPastFile([]);
    }
  }, [fileChange, closeFile]);

  return (
    <div className="home-main-container overflow-x-hidden">
      <PreviewModal
        show={showPreviewModal}
        file={fileToShow}
        onHide={() => setShowPreviewModal(!showPreviewModal)}
      />
      <Elements stripe={stripePromise}>
        <UsersUHModal showModal={showModal} onHideModal={closeModalAdd} />
      </Elements>
      <div className="header-contain flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2 text-bear-dark-900 dark:text-white">
          <FolderOpen className="flex-shrink-0 w-6 h-6 text-bear-cyan" strokeWidth={2} />
          Todos los archivos
        </h2>
        <div className="relative flex items-center w-full md:w-80 max-w-full">
          <Search className="absolute left-3 w-4 h-4 pointer-events-none text-gray-500 dark:text-gray-400" />
          <input
            placeholder="Buscar"
            value={searchValue}
            className="w-full min-w-0 pl-10 pr-4 h-11 rounded-lg text-sm font-medium bg-bear-light-100 dark:bg-bear-dark-300 border border-gray-300 dark:border-bear-dark-100 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-bear-cyan focus:border-transparent"
            onChange={(e: any) => {
              startSearch(e.target.value);
            }}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 dark:border-bear-dark-100 bg-bear-light-100 dark:bg-bear-dark-500 p-2">
        <button
          type="button"
          onClick={goToRoot}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg min-h-[40px] text-sm font-medium hover:bg-gray-200 dark:hover:bg-bear-dark-100"
          style={{ color: "var(--fb-text)", fontSize: "var(--app-font-size-body)" }}
        >
          Inicio
        </button>
        {!showPagination && pastFile.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 font-mono text-sm text-cyan-500 dark:text-cyan-400">
            {pastFile.map((file: any, index) => {
              const isLastFolder = pastFile.length === index + 1;
              if (isLastFolder) {
                return (
                  <span key={`folder_${index}`}>
                    {file}
                  </span>
                );
              }
              return (
                <span key={`folder_${index}`} className="flex items-center gap-1">
                  <button
                    type="button"
                    className="cursor-pointer opacity-90 hover:opacity-100 hover:underline bg-transparent border-0 p-0"
                    onClick={() => {
                      goToFolder({ folder: index + 1 });
                    }}
                    style={{ color: "inherit", fontSize: "inherit" }}
                  >
                    {file}
                  </button>
                  <ChevronRight className="w-4 h-4 flex-shrink-0 text-cyan-500 dark:text-cyan-400" />
                </span>
              );
            })}
          </div>
        )}
        {!showPagination && pastFile.length === 0 && (
          <p className="m-0 text-sm text-gray-600 dark:text-gray-400">Raíz</p>
        )}
        {showPagination && (
          <p className="m-0 text-sm text-gray-600 dark:text-gray-400">
            Resultados para: <strong>{searchValue}</strong>
          </p>
        )}
        <button
          type="button"
          disabled={!showPagination && pastFile.length === 0}
          onClick={() => {
            if (showPagination) {
              clearSearch();
              return;
            }
            goToFolder({ back: true });
          }}
          className="fb-volver ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ color: "var(--fb-text-muted)", fontSize: "var(--app-font-size-body)" }}
        >
          <ArrowLeft className="w-5 h-5 flex-shrink-0" />
          {showPagination ? "Volver a carpeta" : "Volver"}
        </button>
      </div>

      <div className="bb-explorer rounded-xl border border-gray-200 dark:border-bear-dark-100 overflow-hidden bg-bear-light-100 dark:bg-bear-dark-500 shadow-sm">
        <div className="bb-explorer-head grid grid-cols-[1fr_auto] md:grid-cols-[1fr_120px_auto] gap-3 px-4 py-3 bg-gray-100 dark:bg-bear-dark-400 text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">
          <div>Nombre</div>
          <div className="hidden md:block text-right">Tamaño</div>
          <div className="text-right">Acciones</div>
        </div>
        <div className="bb-explorer-body flex flex-col">
          {!loader ? (
            sortArrayByName(files).map((file: IFiles, idx: number) => {
              const gbSize = file.size != null && Number.isFinite(file.size)
                ? file.size / (1024 * 1024 * 1024)
                : 0;
              const sizeLabel = file.size != null && Number.isFinite(file.size)
                ? `${gbSize >= 1 ? gbSize.toFixed(1) : gbSize.toFixed(2)} GB`
                : "—";
              const isFolder = file.type === "d";
              const allowFolderDownload = isFolder && file.size != null && gbSize <= 50;
              return (
                <div
                  key={`explorer-${idx}`}
                  className={`bb-explorer-row grid grid-cols-[1fr_auto] md:grid-cols-[1fr_120px_auto] items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-bear-dark-100 hover:bg-gray-100 dark:hover:bg-bear-dark-400/50 transition-colors ${isFolder ? "cursor-pointer" : ""}`}
                  onClick={() => {
                    if (isFolder) {
                      goToFolder({ next: file.name });
                    }
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isFolder ? (
                      <FolderOpen className="flex-shrink-0 w-5 h-5 text-bear-cyan" strokeWidth={2} aria-hidden />
                    ) : (
                      loadFile && index === idx ? (
                        <Spinner size={2} width={0.2} color="var(--fb-accent)" />
                      ) : (
                        <button
                          type="button"
                          className="flex-shrink-0 w-10 h-10 min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg bg-gray-200 dark:bg-bear-dark-100 text-bear-cyan hover:bg-bear-cyan hover:text-bear-dark-500 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            playFile(file, idx);
                          }}
                          title="Reproducir"
                          aria-label="Reproducir"
                        >
                          <Play className="w-4 h-4" aria-hidden />
                        </button>
                      )
                    )}
                    <span className="text-base font-medium text-gray-900 dark:text-gray-200 truncate" title={file.name}>
                      {file.name}
                    </span>
                  </div>
                  <div className="hidden md:block text-right tabular-nums text-sm text-gray-600 dark:text-gray-400">
                    {sizeLabel}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <span className="md:hidden text-xs tabular-nums text-gray-600 dark:text-gray-400">{sizeLabel}</span>
                    {isFolder && (
                      <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden />
                    )}
                    {allowFolderDownload && (
                      <button
                        type="button"
                        className="inline-flex items-center justify-center p-2.5 min-w-[40px] min-h-[40px] rounded-lg hover:bg-gray-200 dark:hover:bg-bear-dark-100 text-bear-cyan hover:opacity-90"
                        onClick={(e) => {
                          e.stopPropagation();
                          checkAlbumSize(file, idx);
                        }}
                        title="Descargar carpeta"
                        aria-label="Descargar carpeta"
                      >
                        {loadDownload && index === idx ? (
                          <Spinner size={2} width={0.2} color="var(--app-btn-text)" />
                        ) : (
                          <Download size={18} aria-hidden />
                        )}
                      </button>
                    )}
                    {file.type === "-" && (
                      loadDownload && index === idx ? (
                        <Spinner size={2} width={0.2} color="var(--app-btn-text)" />
                      ) : (
                        <button
                          type="button"
                          className="inline-flex items-center justify-center p-2.5 min-w-[40px] min-h-[40px] rounded-lg hover:bg-gray-200 dark:hover:bg-bear-dark-100 text-bear-cyan hover:opacity-90"
                          onClick={() => downloadFile(file, idx)}
                          title="Descargar archivo"
                          aria-label="Descargar archivo"
                        >
                          <Download size={18} aria-hidden />
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex justify-center py-12">
              <Spinner size={4} width={0.4} color="var(--app-accent)" />
            </div>
          )}
        </div>
        {showPagination && (
          <div className="border-t border-gray-200 dark:border-bear-dark-100 p-3 md:p-4">
            <Pagination
              totalLoader={paginationLoader}
              totalData={totalSearch}
              title="ordenes"
              startFilter={nextPage}
              currentPage={filters.page}
              limit={filters.limit}
            />
          </div>
        )}
      </div>

      <ConditionModal
        show={showConditionModal}
        onHide={closeConditionModal}
        action={() => startAlbumDownload(albumData, albumData.idx)}
        title="Descarga de Archivos"
        message={`El siguiente archivo pesa ${
          albumData.gbSize && albumData.gbSize.toFixed(2)
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
