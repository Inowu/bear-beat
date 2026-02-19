import { useMemo } from "react";
import { formatInt } from "../homeFormat";

type ComparisonTone = "yes" | "no" | "neutral" | "value";

type ComparisonCell = {
  value: string;
  tone: ComparisonTone;
};

type ComparisonRow = {
  feature: string;
  bearBeat: ComparisonCell;
  others: ComparisonCell;
};

function formatCurrency(
  amount: number,
  currency: "mxn" | "usd",
  locale: string,
): string {
  const code = currency === "mxn" ? "MXN" : "USD";
  const safe = Number(amount);
  if (!Number.isFinite(safe) || safe <= 0) return "N/D";
  const hasDecimals = !Number.isInteger(safe);

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return `${safe} ${code}`;
  }
}

function getBearBeatPriceLabel(input: {
  usdMonthlyPrice: number | null;
  mxnMonthlyPrice: number | null;
  numberLocale: string;
}): string {
  const usd = Number(input.usdMonthlyPrice ?? 0);
  const mxn = Number(input.mxnMonthlyPrice ?? 0);
  const usdLabel =
    Number.isFinite(usd) && usd > 0
      ? `${formatCurrency(usd, "usd", input.numberLocale)}/mes`
      : null;
  const mxnLabel =
    Number.isFinite(mxn) && mxn > 0
      ? `${formatCurrency(mxn, "mxn", input.numberLocale)}/mes`
      : null;

  if (usdLabel && mxnLabel) return `${usdLabel} · ${mxnLabel}`;
  if (usdLabel) return usdLabel;
  if (mxnLabel) return mxnLabel;
  return "Precio mensual disponible en checkout";
}

export default function WhyBearBeat(props: {
  totalGenres: number;
  karaokes: number;
  totalTBLabel: string;
  usdMonthlyPrice: number | null;
  mxnMonthlyPrice: number | null;
  numberLocale: string;
}) {
  const {
    totalGenres,
    karaokes,
    totalTBLabel,
    usdMonthlyPrice,
    mxnMonthlyPrice,
    numberLocale,
  } = props;
  const safeGenres = Math.max(0, Number(totalGenres ?? 0));
  const safeKaraokes = Math.max(0, Number(karaokes ?? 0));
  const genresLabel = safeGenres > 0 ? `${formatInt(safeGenres)}+` : "N/D";
  const karaokeLabel = safeKaraokes > 0 ? `${formatInt(safeKaraokes)}+` : "N/D";
  const totalTbDisplay = `${totalTBLabel ?? ""}`.trim() || "N/D";
  const bearBeatPriceLabel = useMemo(
    () =>
      getBearBeatPriceLabel({
        usdMonthlyPrice,
        mxnMonthlyPrice,
        numberLocale,
      }),
    [mxnMonthlyPrice, numberLocale, usdMonthlyPrice],
  );

  const rows = useMemo<ComparisonRow[]>(
    () => [
      {
        feature: "Audios DJ (remixes, extended)",
        bearBeat: { value: "Sí", tone: "yes" },
        others: { value: "Sí", tone: "neutral" },
      },
      {
        feature: "Videos DJ para pantalla",
        bearBeat: { value: "Sí", tone: "yes" },
        others: { value: "Algunos", tone: "neutral" },
      },
      {
        feature: `Karaoke (${karaokeLabel} canciones)`,
        bearBeat: { value: "Sí", tone: "yes" },
        others: { value: "No", tone: "no" },
      },
      {
        feature: "BPM + Key en nombre de archivo",
        bearBeat: { value: "Sí", tone: "yes" },
        others: { value: "No", tone: "no" },
      },
      {
        feature: "Cobertura de géneros latinos",
        bearBeat: { value: genresLabel, tone: "value" },
        others: { value: "~20-40", tone: "neutral" },
      },
      {
        feature: "Punta, huapango y cubatón",
        bearBeat: { value: "Sí", tone: "yes" },
        others: { value: "No", tone: "no" },
      },
      {
        feature: "Actualizaciones",
        bearBeat: { value: "Semanales", tone: "value" },
        others: { value: "Irregulares", tone: "neutral" },
      },
      {
        feature: "Catálogo total",
        bearBeat: { value: totalTbDisplay, tone: "value" },
        others: { value: "Variable", tone: "neutral" },
      },
      {
        feature: "Precio mensual",
        bearBeat: { value: bearBeatPriceLabel, tone: "value" },
        others: { value: "USD $15-40/mes", tone: "neutral" },
      },
    ],
    [bearBeatPriceLabel, genresLabel, karaokeLabel, totalTbDisplay],
  );

  return (
    <section className="home-why" aria-label="Comparativa">
      <div className="ph__container">
        <div className="home-why__head">
          <h2 className="home-h2">¿Por qué Bear Beat y no otro record pool?</h2>
          <p className="home-sub">Audio, video y karaoke en un solo lugar para cubrir cualquier pedido en cabina.</p>
        </div>

        <div className="home-why__table-wrap bb-market-surface">
          <table className="home-why__table" aria-label="Comparativa Bear Beat vs otros record pools">
            <thead>
              <tr>
                <th scope="col">Qué comparas</th>
                <th scope="col">Bear Beat</th>
                <th scope="col">Otros record pools</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.feature}>
                  <th scope="row">{row.feature}</th>
                  <td data-column="Bear Beat">
                    <span className={`home-why__chip home-why__chip--${row.bearBeat.tone}`}>
                      {row.bearBeat.value}
                    </span>
                  </td>
                  <td data-column="Otros record pools">
                    <span className={`home-why__chip home-why__chip--${row.others.tone}`}>
                      {row.others.value}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="home-why__closing">
          <strong>Audio + Video + Karaoke en un solo lugar.</strong> Ningún otro record pool te da los tres.
        </p>
      </div>
    </section>
  );
}
