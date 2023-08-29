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
import { sortArrayByName } from "../../functions/functions";

function Home() {
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [files, setfiles] = useState<IFiles[]>([]);
  const [pastFile, setPastFile] = useState<string[]>([]);
  const getFiles = async () =>  {
    let body = {
      path: '',
    }
    try{
      const files = await trpc.ftp.ls.query(body);
      setfiles(files);
    }
    catch(error){
      console.log(error);
    }
  }
  const getPath = async (name: string) => {
    let tempFiles = pastFile;
    tempFiles.push(name);
    try{
      const files = await trpc.ftp.ls.query({
        path: tempFiles.join('/'),
      })
      setPastFile(tempFiles);
      setfiles(files);
    }
    catch(error){
      console.log(error);
    }
  }
  const goBack = async () => {
    let tempFiles = pastFile;
    tempFiles.pop();
    try{
      const files = await trpc.ftp.ls.query({
        path: tempFiles.join('/'),
      })
      setPastFile(tempFiles);
      setfiles(files);
    }
    catch(error){
      console.log(error);
    }
  }

  // const downloadFile = async () => {
  //   try{
  //     const files = await trpc.ftp.ls.query({
  //       path: tempFiles.join('/'),
  //     })
  //     setPastFile(tempFiles);
  //     setfiles(files);
  //   }
  //   catch(error){
  //     console.log(error);
  //   }
  // }
  useEffect(() => {
    getFiles();
  }, []);

  return (
    <div className="home-main-container">
      <PreviewModal
        show={showPreviewModal}
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
          {
            sortArrayByName(files).map((file: IFiles, index: number)=>{
              return (
                <div key={"files " + index}>
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
                    <FontAwesomeIcon
                      icon={faPlay}
                      onClick={() => setShowPreviewModal(true)}
                    />
                    <div className="name-container">
                      <h3>{file.name}</h3>
                    </div>
                    <FontAwesomeIcon icon={faDownload} />
                  </div> 
                  }
                </div>
              )
            })
          }
        </div>
      </div>
    </div>
  );
}

export default Home;
