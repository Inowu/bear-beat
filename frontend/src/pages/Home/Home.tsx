import './Home.scss';
import {
  Folder,
  ArrowLeft,
  ChevronRight,
  Music,
  File,
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
          <Folder className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--fb-accent)' }} />
          Todos los archivos
        </h2>
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 pointer-events-none" style={{ color: 'var(--fb-text-muted)' }} />
          <input
            placeholder="Buscar"
            className="w-full min-w-[200px] pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
            style={{
              background: 'var(--fb-input-bg)',
              border: '1px solid var(--fb-input-border)',
              color: 'var(--fb-text)',
            }}
            onChange={(e: any) => {
              startSearch(e.target.value);
            }}
          />
        </div>
      </div>
      {pastFile.length > 0 && !showPagination && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 font-mono text-sm" style={{ color: 'var(--fb-accent)' }}>
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
            className="fb-volver inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
            style={{ color: 'var(--fb-text-muted)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
        </div>
      )}
      <div
        className="folders-navigation-container rounded-xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--fb-bg)', border: '1px solid var(--fb-border)' }}
      >
        <div
          className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr] gap-4 px-4 py-3 border-b text-sm font-medium"
          style={{ borderColor: 'var(--fb-border)', color: 'var(--fb-text-muted)' }}
        >
          <div>Nombre</div>
          <div className="text-right">Tamaño</div>
          <div className="hidden md:block text-right">Modificado</div>
        </div>
        <div className="folders-cards-container">
          {!loader ? (
            sortArrayByName(files).map((file: IFiles, idx: number) => {
              let gbSize = file.size / (1024 * 1024 * 1024);
              return (
                <div key={'files ' + idx}>
                  {file.type === 'd' && (
                    <div
                      className="flex items-center justify-between p-4 border-b border-l-2 border-l-transparent transition-colors cursor-pointer hover:border-l-2"
                      style={{ borderBottomColor: 'var(--fb-row-border)' }}
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
                        <Folder className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--fb-folder-icon)' }} />
                        <span className="font-medium truncate text-[length:var(--app-font-size-body)]" style={{ color: 'var(--fb-text)' }}>
                          {file.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <span className="whitespace-nowrap text-sm font-mono" style={{ color: 'var(--fb-text-muted)' }}>
                          {gbSize.toFixed(2)} GB
                        </span>
                        <span className="modified-column whitespace-nowrap text-sm hidden md:inline" style={{ color: 'var(--fb-text-muted)' }}>
                          {new Date().toLocaleString('en-US', {
                            month: 'short',
                            day: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {gbSize <= 50 && (
                          <div
                            className="p-1 rounded hover:opacity-80"
                            onClick={(e) => {
                              e.stopPropagation();
                              checkAlbumSize(file, idx);
                            }}
                          >
                            {loadDownload && index === idx ? (
                              <Spinner size={2} width={0.2} color="var(--fb-accent)" />
                            ) : (
                              <Download className="w-4 h-4 cursor-pointer" style={{ color: 'var(--fb-file-icon)' }} />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {file.type === '-' && (
                    <div
                      className="flex items-center justify-between p-4 border-b border-l-2 border-l-transparent transition-colors hover:border-l-2"
                      style={{ borderBottomColor: 'var(--fb-row-border)' }}
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
                            className="p-1 rounded hover:opacity-80 flex-shrink-0"
                            onClick={() => playFile(file, idx)}
                          >
                            <Play className="w-4 h-4" style={{ color: 'var(--fb-file-icon)' }} />
                          </button>
                        )}
                        <Music className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--fb-file-icon)' }} />
                        <span className="font-medium truncate text-[length:var(--app-font-size-body)]" style={{ color: 'var(--fb-text)' }}>
                          {file.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 min-w-0">
                        <span className="whitespace-nowrap text-sm font-mono" style={{ color: 'var(--fb-text-muted)' }}>
                          {gbSize.toFixed(2)} GB
                        </span>
                        {loadDownload && index === idx ? (
                          <Spinner size={2} width={0.2} color="var(--fb-accent)" />
                        ) : (
                          <button
                            type="button"
                            className="p-1 rounded hover:opacity-80"
                            onClick={() => downloadFile(file, idx)}
                          >
                            <Download className="w-4 h-4" style={{ color: 'var(--fb-file-icon)' }} />
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
              <Spinner size={4} width={0.4} color="#22d3ee" />
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
