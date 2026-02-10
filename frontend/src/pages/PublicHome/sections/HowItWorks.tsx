import { Download, Sparkles, Search } from "lucide-react";
import { formatInt } from "../homeFormat";

export default function HowItWorks(props: { trial: { enabled: boolean; days: number; gb: number } | null }) {
  const { trial } = props;
  const step1Copy =
    trial?.enabled && Number.isFinite(trial.days) && trial.days > 0
      ? `${formatInt(trial.days)} días + ${formatInt(trial.gb)} GB. Cancelas antes de que termine y no se cobra.`
      : "Activa tu acceso en minutos. Pago seguro (Stripe).";

  return (
    <section className="how-it-works" aria-label="Cómo funciona">
      <div className="ph__container">
        <div className="how-it-works__head">
          <h2 className="home-h2">Cómo funciona</h2>
          <p className="home-sub">3 pasos y llegas a cabina con repertorio listo.</p>
        </div>

        <div className="how-it-works__grid" role="list" aria-label="Pasos">
          <article className="how-it-works__card" role="listitem">
            <span className="how-it-works__icon" aria-hidden>
              <Sparkles size={18} />
            </span>
            <h3>Activa tu prueba</h3>
            <p>{step1Copy}</p>
          </article>
          <article className="how-it-works__card" role="listitem">
            <span className="how-it-works__icon" aria-hidden>
              <Search size={18} />
            </span>
            <h3>Elige por género/año/mood</h3>
            <p>Carpetas listas para responder pedidos rápido, sin estrés.</p>
          </article>
          <article className="how-it-works__card" role="listitem">
            <span className="how-it-works__icon" aria-hidden>
              <Download size={18} />
            </span>
            <h3>Descarga por FTP o web e importa</h3>
            <p>Descargas a tu compu e importas a tu software como siempre.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
