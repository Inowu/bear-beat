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
import "./BlockedPhoneNumbers.scss";

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
    <form onSubmit={handleAddPhone} className="blocked-phones-toolbar">
      <label className="blocked-phones-toolbar__field">
        Teléfono a bloquear
        <input
          type="text"
          placeholder="ej. +52 6621258651"
          value={newPhone}
          onChange={(e) => setNewPhone(e.target.value)}
        />
      </label>
      <button type="submit" disabled={saving} className="blocked-phones-toolbar__btn">
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
      <section className="blocked-phones-page">
        <ConditionModal
          show={phoneToDelete !== null}
          onHide={() => setPhoneToDelete(null)}
          title="Eliminar teléfono"
          message="¿Eliminar este teléfono de la lista?"
          action={() => (phoneToDelete ? handleRemovePhone(phoneToDelete) : Promise.resolve())}
        />
        {loader ? (
          <div className="blocked-phones-state">
            <Spinner size={3} width={0.3} color="var(--app-accent)" />
          </div>
        ) : blockedNumbers.length === 0 ? (
          <p className="blocked-phones-state blocked-phones-state--empty">
            No hay teléfonos bloqueados.
          </p>
        ) : (
          <>
            <div className="blocked-phones-table-wrap hidden md:block">
              <div
                className="blocked-phones-table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Tabla de teléfonos bloqueados (desliza para ver más)"
                data-scroll-region
              >
                <table className="blocked-phones-table">
                  <thead>
                    <tr>
                      <th>Teléfono</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockedNumbers.map((phone) => (
                      <tr key={`p_${phone}`}>
                        <td>{phone}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => setPhoneToDelete(phone)}
                            disabled={saving}
                            className="blocked-phones-delete-btn"
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

            <div className="blocked-phones-mobile-list md:hidden">
              {blockedNumbers.map((phone) => (
                <button
                  type="button"
                  key={`m_${phone}`}
                  className="blocked-phones-mobile-item"
                  onClick={() => setDrawerPhone(phone)}
                  aria-label={`Ver acciones para ${phone}`}
                >
                  <p>{phone}</p>
                  <span aria-hidden>
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
              {drawerPhone && (
                <p className="blocked-phones-drawer-copy">
                  Teléfono bloqueado: <strong>{drawerPhone}</strong>
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
