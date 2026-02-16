import { User } from "src/icons";
import { HOME_TESTIMONIALS, type HomeTestimonial } from "../homeTestimonials";

export default function HumanSocialProof(props: {
  testimonials?: HomeTestimonial[];
}) {
  const list = props.testimonials ?? HOME_TESTIMONIALS;
  if (!Array.isArray(list) || list.length === 0) return null;

  return (
    <section className="human-proof" aria-label="Resultados reales de DJs">
      <div className="ph__container">
        <div className="human-proof__head">
          <h2 className="home-h2">Resultados reales de DJs</h2>
          <p className="home-sub">Testimonios reales y breves de DJs.</p>
        </div>

        <div className="human-proof__grid" role="list" aria-label="Testimonios">
          {list.slice(0, 3).map((t) => (
            <article key={t.id} className="human-proof__card bb-market-card" role="listitem">
              <div className="human-proof__card-head">
                <div className="human-proof__avatar" aria-hidden>
                  <User size={16} />
                </div>
                <div className="human-proof__meta">
                  <h3 className="human-proof__title">{t.title}</h3>
                  {t.metric && <p className="human-proof__metric">{t.metric}</p>}
                </div>
              </div>
              <p className="human-proof__quote">“{t.quote}”</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
