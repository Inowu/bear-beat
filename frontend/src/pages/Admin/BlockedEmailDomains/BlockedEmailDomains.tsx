import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import trpc from "../../../api";
import { ErrorModal } from "../../../components/Modals";
import { Spinner } from "../../../components/Spinner/Spinner";
import { useUserContext } from "../../../contexts/UserContext";
import "./BlockedEmailDomains.scss";

const DOMAIN_REGEX = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const RESERVED_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "protonmail.com",
  "aol.com",
];

export const BlockedEmailDomains = () => {
  const { currentUser } = useUserContext();
  const navigate = useNavigate();
  const [blockedDomains, setBlockedDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState<string>("");
  const [loader, setLoader] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [showError, setShowError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const closeError = () => {
    setShowError(false);
  };

  const loadDomains = async () => {
    setLoader(true);
    try {
      const domains =
        await trpc.blockedEmailDomains.listBlockedEmailDomains.query();
      setBlockedDomains(domains);
    } catch (error: any) {
      setErrorMessage(error.message ?? "Error al cargar los dominios.");
      setShowError(true);
    } finally {
      setLoader(false);
    }
  };

  const handleAddDomain = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = newDomain.trim().toLowerCase();

    if (!normalized) {
      setErrorMessage("Ingrese un dominio valido.");
      setShowError(true);
      return;
    }

    if (!DOMAIN_REGEX.test(normalized)) {
      setErrorMessage("El dominio no tiene un formato valido.");
      setShowError(true);
      return;
    }

    if (blockedDomains.includes(normalized)) {
      setErrorMessage("El dominio ya esta en la lista de bloqueados.");
      setShowError(true);
      return;
    }

    setSaving(true);
    try {
      const domains =
        await trpc.blockedEmailDomains.addBlockedEmailDomain.mutate({
          domain: normalized,
        });
      setBlockedDomains(domains);
      setNewDomain("");
    } catch (error: any) {
      let message = error.message;
      if (message?.includes('"validation"')) {
        message = JSON.parse(message)[0].message;
      }
      setErrorMessage(message ?? "Error al agregar el dominio.");
      setShowError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveDomain = async (domain: string) => {
    const shouldRemove = window.confirm(
      "Desea eliminar este dominio de la lista?",
    );
    if (!shouldRemove) {
      return;
    }

    setSaving(true);
    try {
      const domains =
        await trpc.blockedEmailDomains.removeBlockedEmailDomain.mutate({
          domain,
        });
      setBlockedDomains(domains);
    } catch (error: any) {
      setErrorMessage(error.message ?? "Error al eliminar el dominio.");
      setShowError(true);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") {
      navigate("/");
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    loadDomains();
  }, []);

  return (
    <div className="blocked-domains-contain">
      <div className="header">
        <h1>Dominios bloqueados</h1>
      </div>
      <form className="domain-form" onSubmit={handleAddDomain}>
        <input
          placeholder="ej. spamdomain.com"
          value={newDomain}
          onChange={(event) => setNewDomain(event.target.value)}
          type="text"
        />
        <button className="btn-addDomain" type="submit" disabled={saving}>
          Agregar dominio
        </button>
      </form>
      <p className="hint">
        No se permiten dominios publicos como {RESERVED_DOMAINS.join(", ")}.
      </p>
      {!loader ? (
        <div className="admin-table">
          <div className="table-contain">
            <table>
              <thead>
                <tr>
                  <th>Dominio</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {blockedDomains.length > 0 ? (
                  blockedDomains.map((domain) => (
                    <tr key={`blocked-domain-${domain}`}>
                      <td data-label="Dominio">{domain}</td>
                      <td data-label="Acciones">
                        <button
                          onClick={() => handleRemoveDomain(domain)}
                          disabled={saving}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2}>No se encontraron dominios...</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <Spinner size={3} width={0.3} color="#00e2f7" />
      )}
      <ErrorModal show={showError} onHide={closeError} message={errorMessage} />
    </div>
  );
};
