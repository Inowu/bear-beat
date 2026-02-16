import { User, Database, HardDriveDownload, LibraryBig } from "src/icons";

export default function TrustBar(props: {
  totalFilesLabel: string;
  totalTBLabel: string;
  downloadQuotaLabel: string;
}) {
  const { totalFilesLabel, totalTBLabel, downloadQuotaLabel } = props;

  return (
    <section className="trust-bar" aria-label="Confianza">
      <div className="ph__container trust-bar__inner" role="list">
        <div className="trust-bar__item bb-market-surface" role="listitem">
          <LibraryBig size={18} aria-hidden />
          <span>
            <strong>+{totalFilesLabel}</strong> archivos
          </span>
        </div>
        <div className="trust-bar__item bb-market-surface" role="listitem">
          <Database size={18} aria-hidden />
          <span>
            Catálogo: <strong>{totalTBLabel}</strong>
          </span>
        </div>
        <div className="trust-bar__item bb-market-surface" role="listitem">
          <HardDriveDownload size={18} aria-hidden />
          <span>
            Descargas: <strong>{downloadQuotaLabel}</strong>
          </span>
        </div>
        <div className="trust-bar__item bb-market-surface" role="listitem">
          <User size={18} aria-hidden />
          <span>
            Activación guiada <strong>1 a 1</strong>
          </span>
        </div>
      </div>
    </section>
  );
}
