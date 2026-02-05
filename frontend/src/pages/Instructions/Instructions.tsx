import "./Instructions.scss";
import { of } from "await-of";
import { useEffect, useRef, useState } from "react";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";
import step1 from "../../assets/images/instructions-1.jpg";
import step2 from "../../assets/images/instructions-2.jpg";
import step3 from "../../assets/images/instructions-3.jpg";
import trpc from "../../api"

function Instructions() {
  const step1Ref: any = useRef(null);
  const step2Ref: any = useRef(null);
  const step3Ref: any = useRef(null);
  const step4Ref: any = useRef(null);
  const [videoURL, setVideoURL] = useState<string>("")

  const getConfig = async () => {
    const [videoConfig, errorVideoConfig] = await of(trpc.config.findFirstConfig.query({ where: { name: 'videoURL' } }));

    if (!videoConfig) {
      console.error(errorVideoConfig);
      return;
    }

    setVideoURL(videoConfig.value);
  }

  useEffect(() => { getConfig() }, []);
  useEffect(() => { trackManyChatConversion(MC_EVENTS.VIEW_INSTRUCTIONS); }, []);

  return (
    <div className="instructions-main-container">
      <h1>Método de descarga</h1>
      <p className="instructions-intro">
        Todo el contenido (música y videos) es exclusivo para DJs y está organizado por géneros para que encuentres rápido lo que necesitás.
      </p>
      <div className="instructions-content-container">
        {videoURL !== "" ? (
          <iframe src={videoURL} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen></iframe>
        ) : (
          <>
            <ul className="steps-nav-container">
              <li
                className="border-bottom"
                onClick={() =>
                  step1Ref.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  })
                }
              >
                Paso 1
              </li>
              <li
                className="border-bottom"
                onClick={() =>
                  step2Ref.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  })
                }
              >
                Paso 2
              </li>
              <li
                className="border-bottom"
                onClick={() =>
                  step3Ref.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  })
                }
              >
                Paso 3
              </li>
              <li
                onClick={() =>
                  step4Ref.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  })
                }
              >
                Paso 4
              </li>
            </ul>
            <div className="steps-container">
              <div className="step-card" ref={step1Ref}>
                <h2>Paso 1</h2>
                <p>
                  Descarga e instala el cliente de FileZilla en este <a href="https://filezilla-project.org/download.php?type=client" target="_blank" rel="noopener noreferrer">link</a>
                </p>
                <img src={step1} alt="" />
              </div>
              <div className="step-card" ref={step2Ref}>
                <h2>Paso 2</h2>
                <p>
                  Ve a la sección "Mi Cuenta" y en esta sección encontrarás tus claves de usuario FTP
                </p>
                <img src={step2} alt="" />
              </div>
              <div className="step-card" ref={step3Ref}>
                <h2>Paso 3</h2>
                <p>Esas claves de usuario ponlas en esta sección de filezilla</p>
                <img src={step3} alt="" />
              </div>
              <div className="step-card" ref={step4Ref}>
                <h2>Paso 4</h2>
                <p>
                  Selecciona en que disco duro o carpeta quieres hacer la descarga
                  una ves echo eso da click derecho a la carpeta que deseas
                  descargar y listo tu descarga arranca exitosamente
                </p>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default Instructions;
