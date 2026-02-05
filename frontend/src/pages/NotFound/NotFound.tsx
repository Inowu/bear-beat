import { Link } from "react-router-dom";

function NotFound() {
  return (
    <div className="app-screen min-h-[60vh] flex flex-col items-center justify-center px-4 py-12 text-center bg-bg-main text-text-main font-poppins">
      <h1 className="mb-4 font-bear text-text-main text-2xl md:text-3xl font-extrabold">
        Página no encontrada
      </h1>
      <p className="mb-6 max-w-md text-text-muted text-base">
        La ruta que buscas no existe o fue movida.
      </p>
      <Link
        to="/"
        className="btn-back-home inline-flex items-center justify-center min-h-[44px] px-6 py-3 rounded-pill font-semibold bg-bear-gradient text-bear-dark-500 hover:opacity-90 transition-opacity text-base"
      >
        Volver al inicio
      </Link>
    </div>
  );
}

export default NotFound;
