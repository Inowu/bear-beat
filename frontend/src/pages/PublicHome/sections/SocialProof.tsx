export type SocialTopItem = {
  name: string;
  downloads: number;
};

function TopList(props: {
  title: string;
  items: SocialTopItem[];
  numberLocale: string;
}) {
  const { title, items, numberLocale } = props;
  return (
    <div className="social-proof__col" role="list" aria-label={title}>
      <h3 className="social-proof__col-title">{title}</h3>
      {items.slice(0, 5).map((item) => (
        <div key={item.name} className="social-proof__row" role="listitem">
          <span className="social-proof__name" title={item.name}>
            {item.name}
          </span>
          <span className="social-proof__meta">
            {item.downloads.toLocaleString(numberLocale)} descargas
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SocialProof(props: {
  audio: SocialTopItem[];
  video: SocialTopItem[];
  numberLocale: string;
}) {
  const { audio, video, numberLocale } = props;
  const hasAny = (audio?.length ?? 0) > 0 || (video?.length ?? 0) > 0;

  return (
    <section className="social-proof" aria-label="Prueba social">
      <div className="ph__container">
        <h2 className="home-h2">Lo que más se descarga</h2>
        <p className="home-sub">Basado en historial real de descargas (cuando existe suficiente data).</p>

        {!hasAny ? (
          <div className="social-proof__empty" role="note">
            Este ranking aparece cuando hay suficiente historial real de descargas.
          </div>
        ) : (
          <div className="social-proof__grid" aria-label="Top descargas">
            {(audio?.length ?? 0) > 0 && (
              <TopList title="Audios" items={audio} numberLocale={numberLocale} />
            )}
            {(video?.length ?? 0) > 0 && (
              <TopList title="Videos" items={video} numberLocale={numberLocale} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

