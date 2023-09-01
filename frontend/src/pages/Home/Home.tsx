import "./Home.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFolder,
  faPlay,
  faDownload,
  faArrowLeft,
} from "@fortawesome/free-solid-svg-icons";
import PreviewModal from "../../components/PreviewModal/PreviewModal";
import { useEffect, useState } from "react";
import trpc from "../../api";
import { IFiles } from "interfaces/Files";
import { downloadMP3, sortArrayByName } from "../../functions/functions";
import { Spinner } from "../../components/Spinner/Spinner";

function Home() {
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [files, setfiles] = useState<IFiles[]>([]);
  const [pastFile, setPastFile] = useState<string[]>([]);
  const [loader, setLoader] = useState<boolean>(false);
  const [loadFile, setLoadFile] = useState<boolean>(false);
  const [loadDownload, setLoadDownload] = useState<boolean>(false);
  const [fileToShow, setFileToShow] = useState<any>(null);
  const [index, setIndex] = useState<number>(-1);
  const getFiles = async () =>  {
    setLoader(true);
    let body = {
      path: '',
    }
    try{
      const files = await trpc.ftp.ls.query(body);
      setfiles(files);
      setLoader(false);
    }
    catch(error){
      console.log(error);
      setLoader(false);
    }
  }
  const getPath = async (name: string) => {
    setLoader(true);
    let tempFiles = pastFile;
    tempFiles.push(name);
    try{
      const files = await trpc.ftp.ls.query({
        path: (tempFiles.length === 0 ? '': '/') + tempFiles.join('/'),
      })
      setPastFile(tempFiles);
      setfiles(files);
      setLoader(false);
    }
    catch(error){
      console.log(error);
      setLoader(false);
    }
  }
  const goBack = async () => {
    setLoader(true);
    let tempFiles = pastFile;
    tempFiles.pop();
    try{
      const files = await trpc.ftp.ls.query({
        path: tempFiles.join('/'),
      })
      setPastFile(tempFiles);
      setfiles(files);
      setLoader(false);
    }
    catch(error){
      console.log(error);
      setLoader(false);
    }
  }
  const playFile = async (name: string, index: number) => {
    setLoadFile(true);
    setIndex(index);
    try{
      const files = await trpc.ftp.demo.query({
        path: "/" +pastFile.join('/') + "/" + name,
      })
      setFileToShow(files.demo)
      setIndex(-1);
      setLoadFile(false);
      setShowPreviewModal(true);
    }
    catch(error){
      console.log(error);
    }
  }
  const downloadFile = async (name: string, index: number) => {
    setLoadDownload(true);
    setIndex(index);
    try{
      const files = await trpc.ftp.download.query({
        path:"/"+ pastFile.join('/') + "/" + name,
      })
      downloadMP3(files.file, name);
      setLoadDownload(false);
      setIndex(-1);
    }
    catch(error){
      console.log(error);
    }
  }
  useEffect(() => {
    getFiles();
  }, []);

  return (
    <div className="home-main-container">
      <PreviewModal
        show={showPreviewModal}
        file={fileToShow}
        onHide={() => setShowPreviewModal(!showPreviewModal)}
      />
      <h2>
        <FontAwesomeIcon icon={faFolder} /> Todos los archivos
      </h2>
      {
        pastFile.length> 0 &&
        <div className="btn-back">
          <button onClick={goBack}>
          <FontAwesomeIcon icon={faArrowLeft} />
            Back
          </button>
        </div>
      }

      <div className="folders-navigation-container">
        <div className="header">
          <div>Nombre</div>
          <div className="modified-column">Modificado</div>
        </div>
        <div className="folders-cards-container">
          { !loader ?
            sortArrayByName(files).map((file: IFiles, idx: number)=>{
              return (
                <div key={"files " + idx}>
                  {
                    file.type === "d" &&
                    <div className="folder-card" onClick={()=> getPath(file.name)}>
                    <div className="name-container">
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
                  </div> }
                  { file.type === "-" &&
                    <div className="folder-card video-card">
                      {
                        (loadFile && index === idx) ?
                        <Spinner size={2} width={.2} color="black"/> :
                        <FontAwesomeIcon
                        icon={faPlay}
                        onClick={() => playFile(file.name, idx)}
                      />
                      }

                    <div className="name-container">
                      <h3>{file.name}</h3>
                    </div>
                    {
                      (loadDownload && index === idx) ?
                      <Spinner size={2} width={.2} color="black"/> :
                      <FontAwesomeIcon icon={faDownload}  onClick={()=> downloadFile(file.name, idx)}/>
                    }
                   
                  </div> 
                  }
                </div>
              )
            })
            : <Spinner size={4} width= {.4} color="#2c2c2c"/>
          }
        </div>
      </div>
    </div>
  );
}

export default Home;
