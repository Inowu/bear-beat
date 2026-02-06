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

        <div className="checkout-card checkout-success-card">
          <div className="checkout-success-card__icon-wrap">
            <span className="checkout-summary__check checkout-success-card__icon">
              <Check className="checkout-success-card__icon-check" />
            </span>
          </div>
          <p className="checkout-summary__desc checkout-success-card__desc">
            En unos segundos tendrás acceso a todo el catálogo. Si no ves los cambios, recarga la página o cierra sesión y vuelve a entrar.
          </p>
          <ul className="checkout-success-card__steps">
            <li>Entra al explorador y valida tu acceso.</li>
            <li>Si aún no aparece, cierra sesión y vuelve a iniciar.</li>
          </ul>
          {sessionId && (
            <p className="checkout-summary__meta checkout-success-card__meta">
              Referencia: {sessionId.slice(0, 20)}…
            </p>
          )}
          <div className="checkout-success-card__actions">
            <Link to="/" className="checkout-cta-btn checkout-cta-btn--primary">
              Ir al explorador
            </Link>
            <Link to="/micuenta" className="checkout-cta-btn checkout-cta-btn--ghost">
              Ir a mi cuenta
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CheckoutSuccess;
