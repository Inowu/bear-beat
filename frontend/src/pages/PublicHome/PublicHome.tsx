import { Link } from "react-router-dom";
import Logo from "../../assets/images/osonuevo.png";
import "./PublicHome.scss";

function PublicHome() {
  return (
    <div className="public-home-container">
      <div className="public-home-card">
        <img className="public-home-logo" src={Logo} alt="Bear Beat" />
        <p className="public-home-tagline">
          Música y videos <strong>exclusivos para DJs</strong>
          <span className="public-home-sep"> · </span>
          Todo organizado por <strong>géneros</strong>
        </p>
        <p className="public-home-sub">
          Accedé a la librería, descargá por FTP y llevá todo a tus sets.
        </p>
        <div className="public-home-actions">
          <Link to="/auth" className="public-home-btn public-home-btn-primary">
            Iniciar sesión
          </Link>
          <Link to="/auth/registro" className="public-home-btn public-home-btn-secondary">
            Registrarse
          </Link>
        </div>
      </div>
    </div>
  );
}

export default PublicHome;
