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

const PHONE_REGEX = /^\+\d{1,4}\s\d{4,14}$/;
const PAGE_SIZE = 50;

export const BlockedPhoneNumbers = () => {
  const { currentUser } = useUserContext();
  const navigate = useNavigate();
  const [blockedNumbers, setBlockedNumbers] = useState<string[]>([]);
  const [page, setPage] = useState<number>(0);
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

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(blockedNumbers.length / PAGE_SIZE));
    setPage((prev) => Math.min(prev, totalPages - 1));
  }, [blockedNumbers.length]);

  const pageNumbers = blockedNumbers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const startFilter = (key: string, value: string | number) => {
    if (key !== "page") return;
    setPage(Number(value));
  };

  const toolbar = (
    <form onSubmit={handleAddPhone} className="flex flex-wrap items-end gap-2 w-full">
      <label className="inline-flex flex-col gap-1 text-sm text-text-muted min-w-[260px] flex-1">
        Teléfono a bloquear
        <input
          type="text"
          placeholder="ej. +52 6621258651"
          value={newPhone}
          onChange={(e) => setNewPhone(e.target.value)}
          className="min-h-[44px] rounded-xl px-3 border border-border bg-bg-card text-text-main"
        />
      </label>
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center justify-center gap-2 bg-bear-gradient text-bear-dark-500 hover:opacity-95 font-medium rounded-pill px-4 py-2 transition-colors disabled:opacity-50"
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
      <section className="grid gap-3">
        <ConditionModal
          show={phoneToDelete !== null}
          onHide={() => setPhoneToDelete(null)}
          title="Eliminar teléfono"
          message="¿Eliminar este teléfono de la lista?"
          action={() => (phoneToDelete ? handleRemovePhone(phoneToDelete) : Promise.resolve())}
        />
        {loader ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Spinner size={3} width={0.3} color="var(--app-accent)" />
          </div>
        ) : blockedNumbers.length === 0 ? (
          <p className="text-text-muted text-sm font-medium text-center py-8">No hay teléfonos bloqueados.</p>
        ) : (
          <>
            <div className="admin-table-panel">
              <div
                className="overflow-x-auto max-h-[60vh] overflow-y-auto"
                tabIndex={0}
                role="region"
                aria-label="Tabla de teléfonos bloqueados (desliza para ver más)"
                data-scroll-region
              >
                <table className="w-full">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="uppercase text-xs tracking-wider text-left py-3 px-4">Teléfono</th>
                      <th className="uppercase text-xs tracking-wider text-right py-3 px-4 w-[140px]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageNumbers.map((phone) => (
                      <tr key={`p_${phone}`} className="border-b transition-colors">
                        <td className="py-3 px-4 text-sm">{phone}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="table-actions">
                            <button
                              type="button"
                              onClick={() => setPhoneToDelete(phone)}
                              disabled={saving}
                              className="btn-cell btn-cell--danger"
                              title="Eliminar"
                              aria-label={`Eliminar teléfono ${phone}`}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2} className="py-3 px-4">
                        <Pagination
                          totalData={blockedNumbers.length}
                          title="teléfonos"
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
              {pageNumbers.map((phone) => (
                <button
                  type="button"
                  key={`m_${phone}`}
                  className="admin-mobile-card"
                  onClick={() => setDrawerPhone(phone)}
                  aria-label={`Ver acciones para ${phone}`}
                >
                  <div className="admin-mobile-card__head">
                    <div className="admin-mobile-card__identity">
                      <div className="admin-mobile-card__avatar">{phone.charAt(0)}</div>
                      <div className="admin-mobile-card__copy">
                        <p className="admin-mobile-card__name">{phone}</p>
                        <p className="admin-mobile-card__email">Teléfono bloqueado</p>
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
                totalData={blockedNumbers.length}
                title="teléfonos"
                startFilter={startFilter}
                currentPage={page}
                limit={PAGE_SIZE}
              />
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
                <p className="text-text-muted text-sm font-medium">
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
