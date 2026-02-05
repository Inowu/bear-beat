import { useSearchParams, Link } from "react-router-dom";
import "./Checkout.scss";
import { Check } from "lucide-react";

function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className="checkout-main-container">
      <div className="checkout-inner">
        <header className="checkout-header">
          <h1 className="checkout-page-title">Pago realizado</h1>
          <p className="checkout-page-subtitle">
            Gracias por tu compra. Tu acceso está siendo activado.
          </p>
        </header>

        <div className="checkout-card" style={{ maxWidth: "480px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ marginBottom: "1.5rem" }}>
            <span
              className="checkout-summary__check"
              style={{ width: "64px", height: "64px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            >
              <Check style={{ width: 32, height: 32, color: "var(--app-accent-bright)" }} />
            </span>
          </div>
          <p className="checkout-summary__desc" style={{ marginBottom: "1rem" }}>
            En unos segundos tendrás acceso a todo el catálogo. Si no ves los cambios, recarga la página o cierra sesión y vuelve a entrar.
          </p>
          {sessionId && (
            <p className="checkout-summary__meta" style={{ fontSize: "0.875rem", marginBottom: "1.5rem" }}>
              Referencia: {sessionId.slice(0, 20)}…
            </p>
          )}
          <Link
            to="/"
            className="checkout-cta-btn checkout-cta-btn--primary"
            style={{ display: "inline-block", textAlign: "center", textDecoration: "none" }}
          >
            Ir al explorador
          </Link>
        </div>
      </div>
    </div>
  );
}

export default CheckoutSuccess;
