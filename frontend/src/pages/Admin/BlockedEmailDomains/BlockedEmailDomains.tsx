import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import trpc from "../../../api";
import { ErrorModal } from "../../../components/Modals";
import { Spinner } from "../../../components/Spinner/Spinner";
import { useUserContext } from "../../../contexts/UserContext";
import "./BlockedEmailDomains.scss";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import { AdminDrawer } from "../../../components/AdminDrawer/AdminDrawer";
import { Plus, MoreVertical, Trash2 } from "lucide-react";

const DOMAIN_REGEX = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const RESERVED_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "icloud.com", "protonmail.com", "aol.com"];

export const BlockedEmailDomains = () => {
  const { currentUser } = useUserContext();
  const navigate = useNavigate();
  const [blockedDomains, setBlockedDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState<string>("");
  const [loader, setLoader] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [showError, setShowError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [drawerDomain, setDrawerDomain] = useState<string | null>(null);

  const loadDomains = async () => {
    setLoader(true);
    try {
      const domains = await trpc.blockedEmailDomains.listBlockedEmailDomains.query();
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
      let msg = error.message;
      if (msg?.includes('"validation"')) try { msg = JSON.parse(msg)[0].message; } catch {}
      setErrorMessage(msg ?? "Error al agregar.");
      setShowError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveDomain = async (domain: string) => {
    if (!window.confirm("¿Eliminar este dominio de la lista?")) return;
    setSaving(true);
    try {
      const domains = await trpc.blockedEmailDomains.removeBlockedEmailDomain.mutate({ domain });
      setBlockedDomains(domains);
      setDrawerDomain(null);
    } catch (error: any) {
      setErrorMessage(error.message ?? "Error al eliminar.");
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

  const toolbar = (
    <form onSubmit={handleAddDomain} className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
      <input
        type="text"
        placeholder="ej. spamdomain.com"
        value={newDomain}
        onChange={(e) => setNewDomain(e.target.value)}
        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 min-w-[180px] max-w-xs"
      />
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
      >
        <Plus size={18} />
        Agregar dominio
      </button>
    </form>
  );

  return (
    <AdminPageLayout title="Dominios bloqueados" toolbar={toolbar}>
      <p className="text-slate-500 text-sm mb-4">No se permiten dominios públicos como {RESERVED_DOMAINS.slice(0, 4).join(", ")}…</p>

      {loader ? (
        <div className="flex justify-center py-12">
          <Spinner size={3} width={0.3} color="var(--app-accent)" />
        </div>
      ) : blockedDomains.length === 0 ? (
        <p className="text-slate-400 py-8 text-center">No hay dominios bloqueados.</p>
      ) : (
        <>
          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/50 hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900">
                  <tr>
                    <th className="text-slate-400 uppercase text-xs tracking-wider text-left py-3 px-4">Dominio</th>
                    <th className="text-slate-400 uppercase text-xs tracking-wider text-right py-3 px-4">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-slate-950">
                  {blockedDomains.map((domain) => (
                    <tr key={`d_${domain}`} className="border-b border-slate-800 hover:bg-slate-900/60 transition-colors">
                      <td className="py-3 px-4 text-sm text-slate-300">{domain}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveDomain(domain)}
                          disabled={saving}
                          className="p-2 text-slate-400 hover:text-red-400 transition-colors rounded-lg hover:bg-slate-800 disabled:opacity-50"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="md:hidden flex flex-col rounded-xl border border-slate-800 overflow-hidden bg-slate-900/50">
            {blockedDomains.map((domain) => (
              <div
                key={`m_${domain}`}
                className="flex items-center justify-between gap-3 min-h-[64px] px-4 py-3 border-b border-slate-800 hover:bg-slate-900/60 active:bg-slate-800"
                onClick={() => setDrawerDomain(domain)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setDrawerDomain(domain)}
              >
                <p className="font-medium text-white text-sm truncate flex-1 min-w-0">{domain}</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDrawerDomain(domain); }}
                  className="p-2 text-slate-400 hover:text-cyan-400 rounded-lg"
                  aria-label="Ver más"
                >
                  <MoreVertical size={20} />
                </button>
              </div>
            ))}
          </div>

          <AdminDrawer
            open={drawerDomain !== null}
            onClose={() => setDrawerDomain(null)}
            title={drawerDomain ?? "Dominio"}
            user={undefined}
            actions={
              drawerDomain
                ? [{ id: "delete", label: "Eliminar de la lista", onClick: () => handleRemoveDomain(drawerDomain), variant: "danger" }]
                : []
            }
          >
            {drawerDomain && <p className="text-slate-300 text-sm">Dominio bloqueado: <strong className="text-white">{drawerDomain}</strong></p>}
          </AdminDrawer>
        </>
      )}

      <ErrorModal show={showError} onHide={() => setShowError(false)} message={errorMessage} />
    </AdminPageLayout>
  );
};
