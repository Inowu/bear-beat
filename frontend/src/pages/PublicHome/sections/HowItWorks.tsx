import { Download, Ticket, Search } from "src/icons";
import { HOME_HERO_MICROCOPY_BASE, HOME_HERO_MICROCOPY_TRIAL } from "../homeCopy";

export default function HowItWorks(props: { trial: { enabled: boolean; days: number; gb: number } | null }) {
  const { trial } = props;
  const step1Copy =
    trial?.enabled
      ? `Alta rápida en pocos minutos. ${HOME_HERO_MICROCOPY_TRIAL}`
      : `Alta rápida en pocos minutos. ${HOME_HERO_MICROCOPY_BASE}`;

  return (
    <section className="how-it-works" aria-label="Cómo funciona">
      <div className="ph__container">
        <div className="how-it-works__head">
          <h2 className="home-h2">Así arrancas hoy</h2>
          <p className="home-sub">3 pasos simples para tener repertorio listo antes de tu evento.</p>
        </div>

        <ul className="how-it-works__grid" aria-label="Pasos">
          <li className="how-it-works__card bb-market-card">
            <span className="how-it-works__icon" aria-hidden>
              <Ticket size={18} />
            </span>
            <h3>Activa tu cuenta</h3>
            <p>{step1Copy}</p>
          </li>
          <li className="how-it-works__card bb-market-card">
            <span className="how-it-works__icon" aria-hidden>
              <Search size={18} />
            </span>
            <h3>Encuentra en segundos</h3>
            <p>Busca por canción, artista o carpeta y responde pedidos sin cortar el ritmo.</p>
          </li>
          <li className="how-it-works__card bb-market-card">
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
