import "./Instructions.scss";
import { of } from "await-of";
import { useEffect, useRef, useState } from "react";
import {
  Download,
  Server,
  Key,
  Link2,
  HardDrive,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import trpc from "../../api";

const FILEZILLA_URL = "https://filezilla-project.org/download.php?type=client";

function Instructions() {
  const step1Ref = useRef<HTMLDivElement>(null);
  const step2Ref = useRef<HTMLDivElement>(null);
  const step3Ref = useRef<HTMLDivElement>(null);
  const step4Ref = useRef<HTMLDivElement>(null);
  const [videoURL, setVideoURL] = useState<string>("");
  const [visibleSteps, setVisibleSteps] = useState<Set<number>>(new Set());

  const getConfig = async () => {
    const [videoConfig, errorVideoConfig] = await of(
      trpc.config.findFirstConfig.query({ where: { name: "videoURL" } })
    );
    if (!videoConfig) {
      console.error(errorVideoConfig);
      return;
    }
    setVideoURL(videoConfig.value);
  };

  useEffect(() => {
    getConfig();
  }, []);

  useEffect(() => {
    const refs = [step1Ref, step2Ref, step3Ref, step4Ref];
    const observers: IntersectionObserver[] = [];

    refs.forEach((ref, index) => {
      const el = ref.current;
      if (!el) return;
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setVisibleSteps((prev) => new Set(prev).add(index + 1));
            }
          });
        },
        { threshold: 0.2, rootMargin: "0px 0px -40px 0px" }
      );
      observer.observe(el);
      observers.push(observer);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [videoURL]);

  const scrollToStep = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div
      className="instructions-main-container min-h-screen dark:text-slate-300 [&_p]:dark:text-slate-300 [&_li]:dark:text-slate-300 [&_span]:dark:text-slate-300"
      style={{ background: "var(--in-bg)" }}
    >
      <div className="max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 py-8 md:py-12">
        {videoURL !== "" ? (
          <div className="rounded-xl overflow-hidden border in-iframe-wrap" style={{ borderColor: "var(--in-card-border)" }}>
            <iframe
              src={videoURL}
              title="YouTube video player"
              frameBorder={0}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="w-full aspect-video"
            />
          </div>
        ) : (
          <>
            {/* Hero */}
            <header
              className="rounded-2xl px-6 py-8 md:py-10 mb-10 text-center"
              style={{ background: "var(--in-hero-gradient)" }}
            >
              <h1
                className="text-2xl md:text-3xl font-bold uppercase tracking-wider mb-2"
                style={{ fontFamily: "Poppins, sans-serif", color: "var(--in-title)" }}
              >
                Protocolo de Conexión FTP
              </h1>
              <p
                className="text-base md:text-lg max-w-xl mx-auto"
                style={{ color: "var(--in-text-muted)" }}
              >
                Sigue estos 4 pasos para establecer el enlace seguro con nuestros servidores.
              </p>
            </header>

            {/* Nav rápido */}
            <nav className="flex flex-wrap justify-center gap-2 mb-10">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() =>
                    scrollToStep(
                      [step1Ref, step2Ref, step3Ref, step4Ref][n - 1]
                    )
                  }
                  className="in-nav-dot rounded-full w-9 h-9 flex items-center justify-center text-sm font-bold transition-transform hover:scale-110"
                  style={{
                    background: "var(--in-step-circle)",
                    color: "var(--in-step-circle-text)",
                  }}
                >
                  {n}
                </button>
              ))}
            </nav>

            {/* Stepper vertical */}
            <div
              className="relative pl-10 md:pl-12 border-l-2 space-y-12 md:space-y-16"
              style={{ borderColor: "var(--in-stepper-line)" }}
            >
              {/* FASE 1 */}
              <div
                ref={step1Ref}
                className={`relative in-step-card rounded-xl border p-6 md:p-8 transition-all duration-500 ${
                  visibleSteps.has(1) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{
                  background: "var(--in-card-bg)",
                  borderColor: "var(--in-card-border)",
                }}
              >
                <div
                  className="absolute -left-[3.5rem] top-6 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2"
                  style={{
                    background: "var(--in-step-circle)",
                    color: "var(--in-step-circle-text)",
                    borderColor: "var(--in-bg)",
                  }}
                >
                  1
                </div>
                <div className="flex items-start gap-3 mb-4">
                  <Server className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: "var(--in-accent)" }} />
                  <div>
                    <h2
                      className="text-lg font-bold uppercase tracking-wide"
                      style={{ color: "var(--in-title)" }}
                    >
                      Fase 1: Instalar cliente FTP
                    </h2>
                    <p className="mt-1 text-sm md:text-base" style={{ color: "var(--in-text-muted)" }}>
                      Necesitas un software gestor para descargar a máxima velocidad.
                    </p>
                  </div>
                </div>
                <a
                  href={FILEZILLA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="in-cta-primary"
                  style={{
                    background: "var(--app-btn-bg)",
                    color: "var(--app-btn-text)",
                  }}
                >
                  <Download className="w-5 h-5" style={{ flexShrink: 0 }} />
                  Descargar FileZilla (Gratis)
                </a>
              </div>

              {/* FASE 2 */}
              <div
                ref={step2Ref}
                className={`relative in-step-card rounded-xl border p-6 md:p-8 transition-all duration-500 ${
                  visibleSteps.has(2) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{
                  background: "var(--in-card-bg)",
                  borderColor: "var(--in-card-border)",
                }}
              >
                <div
                  className="absolute -left-[3.5rem] top-6 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2"
                  style={{
                    background: "var(--in-step-circle)",
                    color: "var(--in-step-circle-text)",
                    borderColor: "var(--in-bg)",
                  }}
                >
                  2
                </div>
                <div className="flex items-start gap-3 mb-4">
                  <Key className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: "var(--in-accent)" }} />
                  <div>
                    <h2
                      className="text-lg font-bold uppercase tracking-wide"
                      style={{ color: "var(--in-title)" }}
                    >
                      Fase 2: Obtener credenciales
                    </h2>
                    <p className="mt-1 text-sm md:text-base" style={{ color: "var(--in-text-muted)" }}>
                      Tus claves de acceso únicas están en tu Panel de Control.
                    </p>
                  </div>
                </div>
                <div
                  className="rounded-lg border p-4 mb-4 in-creds-preview"
                  style={{
                    background: "var(--in-terminal-bg)",
                    borderColor: "var(--in-terminal-border)",
                  }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono uppercase" style={{ color: "var(--in-text-muted)" }}>Host</span>
                    <span className="text-sm font-mono blur-sm select-none" style={{ color: "var(--in-text)" }}>ftp.ejemplo.com</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono uppercase" style={{ color: "var(--in-text-muted)" }}>Usuario</span>
                    <span className="text-sm font-mono blur-sm select-none" style={{ color: "var(--in-text)" }}>••••••••</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono uppercase" style={{ color: "var(--in-text-muted)" }}>Contraseña</span>
                    <span className="text-sm font-mono blur-sm select-none" style={{ color: "var(--in-text)" }}>••••••••••••</span>
                  </div>
                </div>
                <Link
                  to="/micuenta"
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 border font-medium transition-colors in-btn-secondary"
                  style={{
                    borderColor: "var(--in-card-border)",
                    color: "var(--in-accent)",
                  }}
                >
                  Ir a Mi Cuenta para ver mis claves
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* FASE 3 */}
              <div
                ref={step3Ref}
                className={`relative in-step-card rounded-xl border p-6 md:p-8 transition-all duration-500 ${
                  visibleSteps.has(3) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{
                  background: "var(--in-card-bg)",
                  borderColor: "var(--in-card-border)",
                }}
              >
                <div
                  className="absolute -left-[3.5rem] top-6 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2"
                  style={{
                    background: "var(--in-step-circle)",
                    color: "var(--in-step-circle-text)",
                    borderColor: "var(--in-bg)",
                  }}
                >
                  3
                </div>
                <div className="flex items-start gap-3 mb-4">
                  <Link2 className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: "var(--in-accent)" }} />
                  <div>
                    <h2
                      className="text-lg font-bold uppercase tracking-wide"
                      style={{ color: "var(--in-title)" }}
                    >
                      Fase 3: Iniciar enlace
                    </h2>
                    <p className="mt-1 text-sm md:text-base" style={{ color: "var(--in-text-muted)" }}>
                      En FileZilla, pega tus datos en los campos del administrador de sitios.
                    </p>
                  </div>
                </div>
                <div
                  className="rounded-lg border p-4 in-terminal"
                  style={{
                    background: "var(--in-terminal-bg)",
                    borderColor: "var(--in-terminal-border)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b font-mono text-xs" style={{ borderColor: "var(--in-terminal-border)", color: "var(--in-text-muted)" }}>
                    <span className="w-2 h-2 rounded-full bg-red-500/80" />
                    <span className="w-2 h-2 rounded-full bg-amber-500/80" />
                    <span className="w-2 h-2 rounded-full bg-green-500/80" />
                    <span className="ml-2">FileZilla — Administrador de sitios</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <label className="text-xs font-mono w-20 flex-shrink-0" style={{ color: "var(--in-text-muted)" }}>Host:</label>
                      <input
                        type="text"
                        readOnly
                        placeholder="Pega aquí tu Host"
                        className="flex-1 rounded px-3 py-2 font-mono text-sm border bg-transparent"
                        style={{ borderColor: "var(--in-terminal-border)", color: "var(--in-text)" }}
                      />
                      <span className="text-xs font-medium hidden sm:inline" style={{ color: "var(--in-accent)" }}>← Pega aquí</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <label className="text-xs font-mono w-20 flex-shrink-0" style={{ color: "var(--in-text-muted)" }}>Usuario:</label>
                      <input
                        type="text"
                        readOnly
                        placeholder="Pega aquí tu usuario"
                        className="flex-1 rounded px-3 py-2 font-mono text-sm border bg-transparent"
                        style={{ borderColor: "var(--in-terminal-border)", color: "var(--in-text)" }}
                      />
                      <span className="text-xs font-medium hidden sm:inline" style={{ color: "var(--in-accent)" }}>← Pega aquí</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <label className="text-xs font-mono w-20 flex-shrink-0" style={{ color: "var(--in-text-muted)" }}>Contraseña:</label>
                      <input
                        type="password"
                        readOnly
                        placeholder="Pega aquí tu contraseña"
                        className="flex-1 rounded px-3 py-2 font-mono text-sm border bg-transparent"
                        style={{ borderColor: "var(--in-terminal-border)", color: "var(--in-text)" }}
                      />
                      <span className="text-xs font-medium hidden sm:inline" style={{ color: "var(--in-accent)" }}>← Pega aquí</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <label className="text-xs font-mono w-20 flex-shrink-0" style={{ color: "var(--in-text-muted)" }}>Puerto:</label>
                      <input
                        type="text"
                        readOnly
                        placeholder="21"
                        className="flex-1 max-w-[80px] rounded px-3 py-2 font-mono text-sm border bg-transparent"
                        style={{ borderColor: "var(--in-terminal-border)", color: "var(--in-text)" }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* FASE 4 */}
              <div
                ref={step4Ref}
                className={`relative in-step-card rounded-xl border p-6 md:p-8 transition-all duration-500 ${
                  visibleSteps.has(4) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{
                  background: "var(--in-card-bg)",
                  borderColor: "var(--in-card-border)",
                }}
              >
                <div
                  className="absolute -left-[3.5rem] top-6 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2"
                  style={{
                    background: "var(--in-step-circle)",
                    color: "var(--in-step-circle-text)",
                    borderColor: "var(--in-bg)",
                  }}
                >
                  4
                </div>
                <div className="flex items-start gap-3 mb-4">
                  <HardDrive className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: "var(--in-accent)" }} />
                  <div>
                    <h2
                      className="text-lg font-bold uppercase tracking-wide"
                      style={{ color: "var(--in-title)" }}
                    >
                      Fase 4: Transferencia de datos
                    </h2>
                    <p className="mt-1 text-sm md:text-base" style={{ color: "var(--in-text-muted)" }}>
                      Arrastra las carpetas del servidor (panel derecho) a tu disco duro (panel izquierdo).
                    </p>
                  </div>
                </div>
                <div
                  className="rounded-lg border-l-4 py-3 px-4 in-tip"
                  style={{
                    borderLeftColor: "var(--in-accent)",
                    background: "var(--in-terminal-bg)",
                    color: "var(--in-text)",
                  }}
                >
                  <span className="font-semibold">Tip Pro:</span> Usa cable Ethernet para máxima estabilidad en descargas grandes.
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Instructions;
