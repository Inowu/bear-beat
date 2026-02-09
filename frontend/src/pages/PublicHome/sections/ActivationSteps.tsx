import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const STEPS = [
  {
    title: "Activa tu acceso",
    body: "Crea tu cuenta y elige tu método de pago en un flujo simple.",
  },
  {
    title: "Recibe ayuda real",
    body: "Te guiamos por chat para activar y entrar a tus carpetas sin fricción.",
  },
  {
    title: "Descarga lo que necesitas",
    body: "Baja por FTP o web y llega con repertorio listo a tu evento.",
  },
] as const;

export default function ActivationSteps(props: {
  ctaLabel: string;
  onPrimaryCtaClick: () => void;
}) {
  const { ctaLabel, onPrimaryCtaClick } = props;

  return (
    <section className="activation-steps" aria-label="Activación rápida">
      <div className="ph__container">
        <div className="activation-steps__head">
          <h2 className="home-h2">De pago a cabina en minutos</h2>
          <p className="home-sub">
            Activación guiada por chat para que descargues hoy mismo.
          </p>
        </div>

        <ol className="activation-steps__grid" aria-label="Pasos de activación">
          {STEPS.map((step) => (
            <li key={step.title} className="activation-steps__card">
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="activation-steps__cta">
          <Link
            to="/auth/registro"
            state={{ from: "/planes" }}
            className="home-cta home-cta--primary"
            onClick={onPrimaryCtaClick}
          >
            {ctaLabel}
            <ArrowRight size={18} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
