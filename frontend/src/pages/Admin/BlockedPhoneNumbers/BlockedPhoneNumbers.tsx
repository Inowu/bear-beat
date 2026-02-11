import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import trpc from "../../../api";
import { ConditionModal, ErrorModal } from "../../../components/Modals";
import { Spinner } from "../../../components/Spinner/Spinner";
import { useUserContext } from "../../../contexts/UserContext";
import { AdminPageLayout } from "../../../components/AdminPageLayout/AdminPageLayout";
import { AdminDrawer } from "../../../components/AdminDrawer/AdminDrawer";
import { Plus, MoreVertical, Trash2 } from "lucide-react";
import { toErrorMessage } from "../../../utils/errorMessage";

const PHONE_REGEX = /^\+\d{1,4}\s\d{4,14}$/;

export const BlockedPhoneNumbers = () => {
  const { currentUser } = useUserContext();
  const navigate = useNavigate();
  const [blockedNumbers, setBlockedNumbers] = useState<string[]>([]);
  const [newPhone, setNewPhone] = useState<string>("");
  const [loader, setLoader] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [showError, setShowError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [drawerPhone, setDrawerPhone] = useState<string | null>(null);
  const [phoneToDelete, setPhoneToDelete] = useState<string | null>(null);

  const loadNumbers = async () => {
    setLoader(true);
    try {
      const numbers = await trpc.blockedPhoneNumbers.listBlockedPhoneNumbers.query();
      setBlockedNumbers(numbers);
    } catch (error: any) {
      setErrorMessage(toErrorMessage(error) || "Error al cargar los teléfonos.");
      setShowError(true);
    } finally {
      setLoader(false);
    }
  };

  const handleAddPhone = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = newPhone.trim().replace(/\s+/g, " ");
    if (!normalized) {
      setErrorMessage("Ingrese un teléfono válido.");
      setShowError(true);
      return;
    }
    if (!PHONE_REGEX.test(normalized)) {
      setErrorMessage("Formato válido: +52 6621258651");
      setShowError(true);
      return;
    }
    if (blockedNumbers.includes(normalized)) {
      setErrorMessage("El teléfono ya está en la lista.");
      setShowError(true);
      return;
    }
    setSaving(true);
    try {
      const numbers = await trpc.blockedPhoneNumbers.addBlockedPhoneNumber.mutate({ phone: normalized });
      setBlockedNumbers(numbers);
      setNewPhone("");
    } catch (error: any) {
      setErrorMessage(toErrorMessage(error) || "Error al agregar.");
      setShowError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePhone = async (phone: string) => {
    setSaving(true);
    try {
      const numbers = await trpc.blockedPhoneNumbers.removeBlockedPhoneNumber.mutate({ phone });
      setBlockedNumbers(numbers);
      setDrawerPhone(null);
      setPhoneToDelete(null);
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
    loadNumbers();
  }, []);

  const toolbar = (
    <form onSubmit={handleAddPhone} className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
      <input
        type="text"
        placeholder="ej. +52 6621258651"
        value={newPhone}
        onChange={(e) => setNewPhone(e.target.value)}
        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-bear-cyan min-w-[180px] max-w-xs"
      />
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 bg-bear-gradient hover:opacity-95 text-bear-dark-500 font-medium rounded-lg px-4 py-2 transition-opacity disabled:opacity-50"
      >
        <Plus size={18} />
        Agregar teléfono
      </button>
    </form>
  );

  return (
    <AdminPageLayout
      title="Teléfonos bloqueados"
      subtitle="Bloquea teléfonos problemáticos para reducir fraude, spam y registros inválidos."
      toolbar={toolbar}
    >
      <ConditionModal
        show={phoneToDelete !== null}
        onHide={() => setPhoneToDelete(null)}
        title="Eliminar teléfono"
        message="¿Eliminar este teléfono de la lista?"
        action={() => phoneToDelete ? handleRemovePhone(phoneToDelete) : Promise.resolve()}
      />
      {loader ? (
        <div className="flex justify-center py-12">
          <Spinner size={3} width={0.3} color="var(--app-accent)" />
        </div>
      ) : blockedNumbers.length === 0 ? (
        <p className="text-slate-400 py-8 text-center">No hay teléfonos bloqueados.</p>
      ) : (
        <>
          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/50 hidden md:block">
            <div
              className="overflow-x-auto"
              tabIndex={0}
              role="region"
              aria-label="Tabla de teléfonos bloqueados (desliza para ver más)"
              data-scroll-region
            >
              <table className="w-full">
                <thead className="bg-slate-900">
                  <tr>
                    <th className="text-slate-400 uppercase text-xs tracking-wider text-left py-3 px-4">Teléfono</th>
                    <th className="text-slate-400 uppercase text-xs tracking-wider text-right py-3 px-4">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-slate-950">
                  {blockedNumbers.map((phone) => (
                    <tr key={`p_${phone}`} className="border-b border-slate-800 hover:bg-slate-900/60 transition-colors">
                      <td className="py-3 px-4 text-sm text-slate-300">{phone}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setPhoneToDelete(phone)}
                          disabled={saving}
                          className="p-2 text-slate-400 hover:text-red-400 transition-colors rounded-lg hover:bg-slate-800 disabled:opacity-50"
                          title="Eliminar"
                          aria-label={`Eliminar teléfono ${phone}`}
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
            {blockedNumbers.map((phone) => (
              <button
                type="button"
                key={`m_${phone}`}
                className="flex items-center justify-between gap-3 min-h-[64px] w-full px-4 py-3 border-b border-slate-800 hover:bg-slate-900/60 active:bg-slate-800 text-left"
                onClick={() => setDrawerPhone(phone)}
                aria-label={`Ver acciones para ${phone}`}
              >
                <p className="font-medium text-white text-sm truncate flex-1 min-w-0">{phone}</p>
                <span className="p-2 text-slate-400 hover:text-bear-cyan rounded-lg" aria-hidden>
                  <MoreVertical size={20} />
                </span>
              </button>
            ))}
          </div>

          <AdminDrawer
            open={drawerPhone !== null}
            onClose={() => setDrawerPhone(null)}
            title={drawerPhone ?? "Teléfono"}
            user={undefined}
            actions={
              drawerPhone
                ? [{ id: "delete", label: "Eliminar de la lista", onClick: () => setPhoneToDelete(drawerPhone), variant: "danger" }]
                : []
            }
          >
            {drawerPhone && <p className="text-slate-300 text-sm">Teléfono bloqueado: <strong className="text-white">{drawerPhone}</strong></p>}
          </AdminDrawer>
        </>
      )}

      <ErrorModal show={showError} onHide={() => setShowError(false)} message={errorMessage} />
    </AdminPageLayout>
  );
};
