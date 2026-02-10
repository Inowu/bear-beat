import { Download, Sparkles, Search } from "lucide-react";
import { HOME_HERO_MICROCOPY_TRIAL } from "../homeCopy";

export default function HowItWorks(props: { trial: { enabled: boolean; days: number; gb: number } | null }) {
  const { trial } = props;
  const step1Copy =
    trial?.enabled ? `Activación en minutos. ${HOME_HERO_MICROCOPY_TRIAL}` : "Activación en minutos. Pago seguro (Stripe).";

  return (
    <section className="how-it-works" aria-label="Cómo funciona">
      <div className="ph__container">
        <div className="how-it-works__head">
          <h2 className="home-h2">Cómo funciona</h2>
          <p className="home-sub">3 pasos y llegas a cabina con repertorio listo.</p>
        </div>

        <ul className="how-it-works__grid" aria-label="Pasos">
          <li className="how-it-works__card">
            <span className="how-it-works__icon" aria-hidden>
              <Sparkles size={18} />
            </span>
            <h3>Activa tu prueba</h3>
            <p>{step1Copy}</p>
          </li>
          <li className="how-it-works__card">
            <span className="how-it-works__icon" aria-hidden>
              <Search size={18} />
            </span>
            <h3>Encuentra en segundos</h3>
            <p>Carpetas listas por género/año/mood para responder pedidos sin estrés.</p>
          </li>
          <li className="how-it-works__card">
            <span className="how-it-works__icon" aria-hidden>
              <Download size={18} />
            </span>
            <h3>Descarga e importa</h3>
            <p>Descarga por FTP o web e importa a tu software como siempre.</p>
          </li>
        </ul>
      </div>
    </section>
  );
}
