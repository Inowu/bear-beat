import { HOME_USE_CASES } from "../homeCopy";

export default function UseCases() {
  return (
    <section className="use-cases" aria-label="Cómo te salva en cabina">
      <div className="ph__container">
        <h2 className="home-h2">Cómo te salva en cabina</h2>
        <div className="use-cases__grid">
          {HOME_USE_CASES.map((item) => (
            <article key={item.title} className="use-cases__card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

