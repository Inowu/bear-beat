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
      return goToFolder({});
    }
    let body = {
      query: value,
      limit: filters.limit,
      offset: filters.page * filters.limit,
    };
    try {
      const result = await trpc.ftp.search.query(body);
      let values: any = [];
      result.documents.forEach((val) => {
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
    <div className="home-main-container w-full max-w-[100vw] overflow-x-hidden">
      <PreviewModal
        show={showPreviewModal}
        file={fileToShow}
        onHide={() => setShowPreviewModal(!showPreviewModal)}
      />
      <Elements stripe={stripePromise}>
        <UsersUHModal showModal={showModal} onHideModal={closeModalAdd} />
      </Elements>
      <div className="header-contain flex flex-wrap justify-between items-center gap-4">
        <h2 className="flex items-center gap-2 font-semibold" style={{ color: 'var(--fb-text)', fontSize: 'var(--app-font-size-h2)' }}>
          <FolderOpen className="flex-shrink-0" style={{ color: 'var(--fb-accent)', width: '1.75rem', height: '1.75rem', strokeWidth: 2 }} />
          Todos los archivos
        </h2>
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 pointer-events-none" style={{ color: 'var(--fb-text-muted)' }} />
          <input
            placeholder="Buscar"
            className="w-full min-w-[200px] pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent min-h-[44px]"
            style={{
              background: 'var(--fb-input-bg)',
              border: '1px solid var(--fb-input-border)',
              color: 'var(--fb-text)',
              fontSize: 'var(--app-font-size-body)',
            }}
            onChange={(e: any) => {
              startSearch(e.target.value);
            }}
          />
        </div>
      </div>
      {pastFile.length > 0 && !showPagination && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 font-mono" style={{ color: 'var(--fb-accent)', fontSize: 'var(--app-font-size-body)' }}>
            {pastFile.map((file: any, index) => {
              const isLastFolder = pastFile.length === index + 1;
              if (isLastFolder) {
                return (
                  <span key={`folder_${index}`} style={{ color: 'var(--fb-accent)' }}>
                    {file}
                  </span>
                );
              }
              return (
                <span key={`folder_${index}`} className="flex items-center gap-1">
                  <span
                    className="cursor-pointer opacity-90 hover:opacity-100"
                    style={{ color: 'var(--fb-accent)' }}
                    onClick={() => {
                      goToFolder({ folder: index + 1 });
                    }}
                  >
                    {file}
                  </span>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--fb-text-muted)' }} />
                </span>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              goToFolder({ back: true });
            }}
            className="fb-volver inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors min-h-[44px]"
            style={{ color: 'var(--fb-text-muted)', fontSize: 'var(--app-font-size-body)' }}
          >
            <ArrowLeft className="w-5 h-5 flex-shrink-0" />
            Volver
          </button>
        </div>
      )}
      <div
        className="folders-navigation-container rounded-xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--fb-bg)', border: '1px solid var(--fb-border)' }}
      >
        <div className="header">
          <div>Nombre</div>
          <div className="text-right">Tamaño</div>
          <div className="modified-column hidden md:block text-right">Modificado</div>
        </div>
        <div className="folders-cards-container">
          {!loader ? (
            sortArrayByName(files).map((file: IFiles, idx: number) => {
              const gbSize = file.size != null && Number.isFinite(file.size)
                ? file.size / (1024 * 1024 * 1024)
                : 0;
              const sizeLabel = file.size != null && Number.isFinite(file.size)
                ? `${gbSize >= 1 ? gbSize.toFixed(1) : gbSize.toFixed(2)} GB`
                : '—';
              return (
                <div key={'files ' + idx}>
                  {file.type === 'd' && (
                    <div
                      className="fb-row cursor-pointer border-l-2 border-l-transparent hover:border-l-2"
                      style={{ borderLeftColor: 'transparent' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--fb-row-hover-bg)';
                        e.currentTarget.style.borderLeftColor = 'var(--fb-row-hover-border)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '';
                        e.currentTarget.style.borderLeftColor = 'transparent';
                      }}
                      onClick={() => {
                        goToFolder({ next: file.name });
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <FolderOpen className="flex-shrink-0 fb-icon-folder" strokeWidth={2} style={{ color: 'var(--fb-accent)' }} aria-hidden />
                        <span className="fb-row-name" title={file.name}>{file.name}</span>
                      </div>
                      <div className="fb-row-meta">
                        <span className="fb-row-size">{sizeLabel}</span>
                        <span className="modified-column whitespace-nowrap hidden md:inline">
                          {new Date().toLocaleString('en-US', {
                            month: 'short',
                            day: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {file.size != null && gbSize <= 50 && (
                          <button
                            type="button"
                            className="fb-btn-download"
                            onClick={(e) => {
                              e.stopPropagation();
                              checkAlbumSize(file, idx);
                            }}
                          >
                            {loadDownload && index === idx ? (
                              <Spinner size={2} width={0.2} color="var(--app-btn-text)" />
                            ) : (
                              <>
                                <Download className="fb-icon-download" style={{ color: 'inherit' }} />
                                <span className="fb-btn-download-text">Descargar</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {file.type === '-' && (
                    <div
                      className="fb-row border-l-2 border-l-transparent hover:border-l-2"
                      style={{ borderLeftColor: 'transparent' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--fb-row-hover-bg)';
                        e.currentTarget.style.borderLeftColor = 'var(--fb-row-hover-border)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '';
                        e.currentTarget.style.borderLeftColor = 'transparent';
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {loadFile && index === idx ? (
                          <Spinner size={2} width={0.2} color="var(--fb-accent)" />
                        ) : (
                          <button
                            type="button"
                            className="fb-btn-play flex-shrink-0"
                            onClick={() => playFile(file, idx)}
                            title="Reproducir"
                            aria-label="Reproducir"
                          >
                            <Play className="fb-icon-play" style={{ color: 'inherit' }} aria-hidden />
                          </button>
                        )}
                        <span className="fb-row-name" title={file.name}>{file.name}</span>
                      </div>
                      <div className="fb-row-meta">
                        <span className="fb-row-size">{sizeLabel}</span>
                        {loadDownload && index === idx ? (
                          <Spinner size={2} width={0.2} color="var(--app-btn-text)" />
                        ) : (
                          <button
                            type="button"
                            className="fb-btn-download"
                            onClick={() => downloadFile(file, idx)}
                          >
                            <Download className="fb-icon-download" style={{ color: 'inherit' }} />
                            <span className="fb-btn-download-text">Descargar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
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
          <Pagination
            totalLoader={paginationLoader}
            totalData={totalSearch}
            title="ordenes"
            startFilter={nextPage}
            currentPage={filters.page}
            limit={filters.limit}
          />
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
