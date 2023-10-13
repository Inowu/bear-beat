import "./Home.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFolder,
  faPlay,
  faDownload,
} from "@fortawesome/free-solid-svg-icons";
import PreviewModal from "../../components/PreviewModal/PreviewModal";
import { useEffect, useState } from "react";
import trpc from "../../api";

function Home() {
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  const getData = async () => {
    try {
      const files = await trpc.ftp.ls.query({
        path: "",
      });
      console.log(files);
      getPath(files[0].name);
    } catch (error) {
      console.log(error);
    }
  };
  const getPath = async (name: string) => {
    try {
      console.log(name);
      const files = await trpc.ftp.ls.query({
        path: name,
      });
      console.log(files);
    } catch (error) {
      console.log(error);
    }
  };
  const downloadFile = async () => {
    try {
      const download: any = await trpc.ftp.download.query({
        path: "",
      });
    } catch (error) {
      console.log(error);
    }
  };
  useEffect(() => {
    getData();
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
      <div className="folders-navigation-container">
        <div className="header">
          <div>Nombre</div>
          <div className="modified-column">Modificado</div>
        </div>
        <div className="folders-cards-container">
          <div className="folder-card">
            <div className="name-container">
              <FontAwesomeIcon icon={faFolder} />
              <h3>01 Audios Enero 2023</h3>
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
          </div>
          <div className="folder-card video-card">
            <FontAwesomeIcon
              icon={faPlay}
              onClick={() => setShowPreviewModal(true)}
            />
            <div className="name-container">
              <h3>Dog Night - Mama Told me not to c.mp3</h3>
            </div>
            <FontAwesomeIcon
              icon={faDownload}
              onClick={async () => {
                try {
                  const a = document.createElement("a");
                  // const result = await fetch(
                  const url =
                    "https://kale67.world/download?path=" +
                    encodeURIComponent(
                      "04 Karaokes Abril 2023/Arcangel & Bad Bunny - La Jumpa.mp4",
                    ) +
                    "&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6OTkxNiwicm9sZSI6Im5vcm1hbCIsInVzZXJuYW1lIjoia2V2aW53b29sZm9sayIsInBob25lIjoiKzUyNjYyMzI5MDIzNCIsImVtYWlsIjoia2V2aW4ud29vbGZvbGtAaW5vd3UuZGV2IiwicHJvZmlsZUltZyI6bnVsbCwiaWF0IjoxNjk1MjMxOTY3LCJleHAiOjE2OTU4MzY3Njd9.1ghYIG8fT8gibZG9f1gvaWz25t5ONj8k4RFQNIRHqpc";
                  // ).then((r) => r.text());
                  // console.log(result);
                  // console.log(url);
                  a.href = url;
                  a.download = "Arcangel & Bad Bunny - La Jumpa.mp4";
                  document.body.appendChild(a);
                  a.click(); document.body.removeChild(a);
                } catch (e) {
                  console.log(e);
                }

                // try {
                //   const data = await fetch(
                //     "https://bearbeat.com/micuenta/descargar_producto",
                //     {
                //       method: "POST",
                //       headers: {
                //         "Content-Type": "application/json",
                //       },
                //       body: JSON.stringify({
                //         ruta: "/04 Karaokes Abril 2023/Arcangel & Bad Bunny - La Jumpa.mp4",
                //         size: 1,
                //       }),
                //     }
                //   ).then((r) => r.json());
                //
                //   console.log(data);
                // } catch (e) {
                //   console.log(e);
                // }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
