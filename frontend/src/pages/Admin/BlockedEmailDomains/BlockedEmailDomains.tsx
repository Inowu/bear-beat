import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import trpc from "../../../api";
import { ConditionModal, ErrorModal } from "../../../components/Modals";
import { Spinner } from "../../../components/Spinner/Spinner";
import { useUserContext } from "../../../contexts/UserContext";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import { AdminDrawer } from "../../../components/AdminDrawer/AdminDrawer";
import Pagination from "../../../components/Pagination/Pagination";
import { Plus, MoreVertical, Trash2 } from "src/icons";
import { toErrorMessage } from "../../../utils/errorMessage";
import "./BlockedEmailDomains.scss";

const DOMAIN_REGEX = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const RESERVED_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "icloud.com", "protonmail.com", "aol.com"];
const PAGE_SIZE = 100;

export const BlockedEmailDomains = () => {
  const { currentUser } = useUserContext();
  const navigate = useNavigate();
  const [blockedDomains, setBlockedDomains] = useState<string[]>([]);
  const [page, setPage] = useState<number>(0);
  const [newDomain, setNewDomain] = useState<string>("");
  const [loader, setLoader] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [showError, setShowError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [drawerDomain, setDrawerDomain] = useState<string | null>(null);
  const [domainToDelete, setDomainToDelete] = useState<string | null>(null);

  const loadDomains = async () => {
    setLoader(true);
    try {
      const domains = await trpc.blockedEmailDomains.listBlockedEmailDomains.query();
      setBlockedDomains(domains);
    } catch (error: any) {
      setErrorMessage(toErrorMessage(error) || "Error al cargar los dominios.");
      setShowError(true);
    } finally {
      setLoader(false);
    }
  };

  const handleAddDomain = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = newDomain.trim().toLowerCase();
    if (!normalized) {
      setErrorMessage("Ingrese un dominio válido.");
      setShowError(true);
      return;
    }
    if (!DOMAIN_REGEX.test(normalized)) {
      setErrorMessage("El dominio no tiene un formato válido.");
      setShowError(true);
      return;
    }
    if (blockedDomains.includes(normalized)) {
      setErrorMessage("El dominio ya está en la lista.");
      setShowError(true);
      return;
    }
    setSaving(true);
    try {
      const domains = await trpc.blockedEmailDomains.addBlockedEmailDomain.mutate({ domain: normalized });
      setBlockedDomains(domains);
      setNewDomain("");
    } catch (error: any) {
      setErrorMessage(toErrorMessage(error) || "Error al agregar.");
      setShowError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveDomain = async (domain: string) => {
    setSaving(true);
    try {
      const domains = await trpc.blockedEmailDomains.removeBlockedEmailDomain.mutate({ domain });
      setBlockedDomains(domains);
      setDrawerDomain(null);
      setDomainToDelete(null);
    } catch (error: any) {
      setErrorMessage(toErrorMessage(error) || "Error al eliminar.");
      setShowError(true);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") navigate("/");
  }, [currentUser, navigate]);

  useEffect(() => {
    loadDomains();
  }, []);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(blockedDomains.length / PAGE_SIZE));
    setPage((prev) => Math.min(prev, totalPages - 1));
  }, [blockedDomains.length]);

  const pageDomains = blockedDomains.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const startFilter = (key: string, value: string | number) => {
    if (key !== "page") return;
    setPage(Number(value));
  };

  const toolbar = (
    <form onSubmit={handleAddDomain} className="blocked-domains-toolbar">
      <label className="blocked-domains-toolbar__field">
        Dominio a bloquear
        <input
          type="text"
          placeholder="ej. spamdomain.com"
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
        />
      </label>
      <button type="submit" disabled={saving} className="blocked-domains-toolbar__btn">
        <Plus size={18} />
        Agregar dominio
      </button>
    </form>
  );

  return (
    <AdminPageLayout
      title="Dominios bloqueados"
      subtitle="Protege el registro filtrando dominios riesgosos y mantén la base de usuarios limpia."
      toolbar={toolbar}
    >
      <section className="blocked-domains-page">
        <p className="blocked-domains-note">
          No se permiten dominios públicos como {RESERVED_DOMAINS.slice(0, 4).join(", ")}…
        </p>
        <ConditionModal
          show={domainToDelete !== null}
          onHide={() => setDomainToDelete(null)}
          title="Eliminar dominio"
          message="¿Eliminar este dominio de la lista?"
          action={() => (domainToDelete ? handleRemoveDomain(domainToDelete) : Promise.resolve())}
        />

        {loader ? (
          <div className="blocked-domains-state">
            <Spinner size={3} width={0.3} color="var(--app-accent)" />
          </div>
        ) : blockedDomains.length === 0 ? (
          <p className="blocked-domains-state blocked-domains-state--empty">
            No hay dominios bloqueados.
          </p>
        ) : (
          <>
            <div className="admin-table-panel blocked-domains-table-wrap">
              <div
                className="blocked-domains-table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Tabla de dominios bloqueados (desliza para ver más)"
                data-scroll-region
              >
                <table className="blocked-domains-table">
                  <thead>
                    <tr>
                      <th>Dominio</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageDomains.map((domain) => (
                      <tr key={`d_${domain}`}>
                        <td>{domain}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => setDomainToDelete(domain)}
                            disabled={saving}
                            className="blocked-domains-delete-btn"
                            title="Eliminar"
                            aria-label={`Eliminar dominio ${domain}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2} className="py-3 px-4">
                        <Pagination
                          totalData={blockedDomains.length}
                          title="dominios"
                          startFilter={startFilter}
                          currentPage={page}
                          limit={PAGE_SIZE}
                        />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="admin-mobile-list">
              {pageDomains.map((domain) => (
                <button
                  type="button"
                  key={`m_${domain}`}
                  className="admin-mobile-card"
                  onClick={() => setDrawerDomain(domain)}
                  aria-label={`Ver acciones para ${domain}`}
                >
                  <div className="admin-mobile-card__head">
                    <div className="admin-mobile-card__identity">
                      <div className="admin-mobile-card__avatar">{domain.charAt(0).toUpperCase()}</div>
                      <div className="admin-mobile-card__copy">
                        <p className="admin-mobile-card__name">{domain}</p>
                        <p className="admin-mobile-card__email">Dominio bloqueado</p>
                      </div>
                    </div>
                    <span className="admin-mobile-status is-blocked">Bloqueado</span>
                    <span className="admin-mobile-card__menu" aria-hidden>
                      <MoreVertical size={20} />
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="admin-pagination-mobile">
              <Pagination
                totalData={blockedDomains.length}
                title="dominios"
                startFilter={startFilter}
                currentPage={page}
                limit={PAGE_SIZE}
              />
            </div>

            <AdminDrawer
              open={drawerDomain !== null}
              onClose={() => setDrawerDomain(null)}
              title={drawerDomain ?? "Dominio"}
              user={undefined}
              actions={
                drawerDomain
                  ? [{ id: "delete", label: "Eliminar de la lista", onClick: () => setDomainToDelete(drawerDomain), variant: "danger" }]
                  : []
              }
            >
              {drawerDomain && (
                <p className="blocked-domains-drawer-copy">
                  Dominio bloqueado: <strong>{drawerDomain}</strong>
                </p>
              )}
            </AdminDrawer>
          </>
        )}

        <ErrorModal show={showError} onHide={() => setShowError(false)} message={errorMessage} />
      </section>
    </AdminPageLayout>
  );
};
