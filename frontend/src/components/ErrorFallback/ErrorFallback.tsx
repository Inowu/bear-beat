import React from "react";
import "./ErrorFallback.scss";

interface ErrorFallbackProps {
  /** Mensaje opcional del error (Sentry lo inyecta) */
  error?: Error;
}

export function ErrorFallback({ error }: ErrorFallbackProps) {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="error-fallback" role="alert">
      <div className="error-fallback__card">
        <h1 className="error-fallback__title">Ups, algo salió mal.</h1>
        <p className="error-fallback__message">
          Nuestro equipo ya fue notificado.
        </p>
        {error?.message && (
          <p className="error-fallback__detail">{error.message}</p>
        )}
        <button
          type="button"
          className="error-fallback__btn"
          onClick={handleReload}
        >
          Recargar página
        </button>
      </div>
    </div>
  );
}
