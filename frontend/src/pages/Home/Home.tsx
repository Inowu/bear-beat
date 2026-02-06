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
      <div className="bb-home-top">
        <h2 className="bb-home-title">
          <FolderOpen className="bb-home-title-icon" strokeWidth={2} />
          Todos los archivos
        </h2>
        <div className="bb-search-wrap">
          <Search className="bb-search-icon" />
          <input
            placeholder="Buscar"
            value={searchValue}
            className="bb-search-input"
            onChange={(e: any) => {
              startSearch(e.target.value);
            }}
          />
        </div>
      </div>

      <div className="bb-pathbar">
        <div className="bb-path-items">
          <button type="button" onClick={goToRoot} className="bb-chip bb-chip-root">
            Inicio
          </button>
          {!showPagination && pastFile.length > 0 && (
            <div className="bb-chip-track">
              {pastFile.map((file: any, index) => {
                const isLastFolder = pastFile.length === index + 1;
                if (isLastFolder) {
                  return (
                    <span key={`folder_${index}`} className="bb-chip bb-chip-current">
                      {file}
                    </span>
                  );
                }
                return (
                  <span key={`folder_${index}`} className="bb-chip-item">
                    <button
                      type="button"
                      className="bb-chip bb-chip-link"
                      onClick={() => {
                        goToFolder({ folder: index + 1 });
                      }}
                    >
                      {file}
                    </button>
                    <ChevronRight className="bb-chip-sep" />
                  </span>
                );
              })}
            </div>
          )}
          {!showPagination && pastFile.length === 0 && (
            <span className="bb-chip bb-chip-current">Raíz</span>
          )}
          {showPagination && (
            <span className="bb-chip bb-chip-search">
              Resultados para: <strong>{searchValue}</strong>
            </span>
          )}
        </div>
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
          className="bb-back-btn"
        >
          <ArrowLeft className="bb-back-icon" />
          {showPagination ? 'Volver a carpeta' : 'Volver'}
        </button>
      </div>

      <div className="bb-explorer">
        <div className="bb-explorer-head">
          <div>Nombre</div>
          <div className="bb-head-size">Tamaño</div>
          <div className="bb-head-actions">Acciones</div>
        </div>
        <div className="bb-explorer-body">
          {!loader ? (
            sortArrayByName(files).map((file: IFiles, idx: number) => {
              const gbSize = file.size != null && Number.isFinite(file.size)
                ? file.size / (1024 * 1024 * 1024)
                : 0;
              const sizeLabel = file.size != null && Number.isFinite(file.size)
                ? `${gbSize >= 1 ? gbSize.toFixed(1) : gbSize.toFixed(2)} GB`
                : '—';
              const isFolder = file.type === 'd';
              const allowFolderDownload = isFolder && file.size != null && gbSize <= 50;
              return (
                <div
                  key={`explorer-${idx}`}
                  className={`bb-explorer-row ${isFolder ? 'is-folder' : 'is-file'}`}
                  onClick={() => {
                    if (isFolder) {
                      goToFolder({ next: file.name });
                    }
                  }}
                >
                  <div className="bb-row-main">
                    {isFolder ? (
                      <span className="bb-kind-icon bb-kind-folder">
                        <FolderOpen strokeWidth={2} />
                      </span>
                    ) : (
                      loadFile && index === idx ? (
                        <span className="bb-kind-icon bb-kind-file">
                          <Spinner size={2} width={0.2} color="var(--fb-accent)" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="bb-kind-icon bb-kind-file bb-kind-play"
                          onClick={(e) => {
                            e.stopPropagation();
                            playFile(file, idx);
                          }}
                          title="Reproducir"
                          aria-label="Reproducir"
                        >
                          <Play size={16} />
                        </button>
                      )
                    )}
                    <span className="bb-file-name" title={file.name}>
                      {file.name}
                    </span>
                  </div>
                  <div className="bb-row-size">{sizeLabel}</div>
                  <div className="bb-row-actions">
                    {isFolder && <ChevronRight className="bb-row-chevron" aria-hidden />}
                    {allowFolderDownload && (
                      <button
                        type="button"
                        className="bb-action-btn"
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
                          <Download size={18} />
                        )}
                      </button>
                    )}
                    {file.type === '-' && (
                      loadDownload && index === idx ? (
                        <span className="bb-action-btn bb-action-btn--loading">
                          <Spinner size={2} width={0.2} color="var(--app-btn-text)" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="bb-action-btn"
                          onClick={() => downloadFile(file, idx)}
                          title="Descargar archivo"
                          aria-label="Descargar archivo"
                        >
                          <Download size={18} />
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bb-explorer-loading">
              <Spinner size={4} width={0.4} color="var(--app-accent)" />
            </div>
          )}
        </div>
        {showPagination && (
          <div className="bb-pagination-wrap">
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
