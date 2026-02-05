import { Link } from "react-router-dom";

function NotFound() {
  return (
    <div
      className="app-screen min-h-[60vh] flex flex-col items-center justify-center px-4 py-12 text-center"
      style={{
        background: "var(--app-bg)",
        color: "var(--app-text-body)",
        fontFamily: "Poppins, sans-serif",
      }}
    >
      <h1
        className="mb-4"
        style={{
          fontSize: "var(--app-font-size-h1)",
          fontWeight: 800,
          color: "var(--app-text-heading)",
        }}
      >
        Página no encontrada
      </h1>
      <p
        className="mb-6 max-w-md"
        style={{
          fontSize: "var(--app-font-size-body)",
          color: "var(--app-text-muted)",
        }}
      >
        La ruta que buscas no existe o fue movida.
      </p>
      <Link
        to="/"
        className="btn-back-home inline-flex items-center justify-center min-h-[44px] px-6 py-3 rounded-pill font-semibold bg-bear-gradient text-bear-dark-500 hover:opacity-90 transition-opacity"
        style={{
          fontSize: "var(--app-font-size-body)",
        }}
      >
        Volver al inicio
      </Link>
    </div>
  );
}

export default NotFound;
