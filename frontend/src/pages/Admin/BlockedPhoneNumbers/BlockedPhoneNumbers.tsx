import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import trpc from "../../../api";
import { ErrorModal } from "../../../components/Modals";
import { Spinner } from "../../../components/Spinner/Spinner";
import { useUserContext } from "../../../contexts/UserContext";
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

  const closeError = () => {
    setShowError(false);
  };

  const loadNumbers = async () => {
    setLoader(true);
    try {
      const numbers =
        await trpc.blockedPhoneNumbers.listBlockedPhoneNumbers.query();
      setBlockedNumbers(numbers);
    } catch (error: any) {
      setErrorMessage(error.message ?? "Error al cargar los telefonos.");
      setShowError(true);
    } finally {
      setLoader(false);
    }
  };

  const handleAddPhone = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = newPhone.trim().replace(/\s+/g, " ");

    if (!normalized) {
      setErrorMessage("Ingrese un telefono valido.");
      setShowError(true);
      return;
    }

    if (!PHONE_REGEX.test(normalized)) {
      setErrorMessage("El telefono no tiene un formato valido.");
      setShowError(true);
      return;
    }

    if (blockedNumbers.includes(normalized)) {
      setErrorMessage("El telefono ya esta en la lista de bloqueados.");
      setShowError(true);
      return;
    }

    setSaving(true);
    try {
      const numbers =
        await trpc.blockedPhoneNumbers.addBlockedPhoneNumber.mutate({
          phone: normalized,
        });
      setBlockedNumbers(numbers);
      setNewPhone("");
    } catch (error: any) {
      let message = error.message;
      if (message?.includes('"validation"')) {
        message = JSON.parse(message)[0].message;
      }
      setErrorMessage(message ?? "Error al agregar el telefono.");
      setShowError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePhone = async (phone: string) => {
    const shouldRemove = window.confirm(
      "Desea eliminar este telefono de la lista?",
    );
    if (!shouldRemove) {
      return;
    }

    setSaving(true);
    try {
      const numbers =
        await trpc.blockedPhoneNumbers.removeBlockedPhoneNumber.mutate({
          phone,
        });
      setBlockedNumbers(numbers);
    } catch (error: any) {
      setErrorMessage(error.message ?? "Error al eliminar el telefono.");
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
    loadNumbers();
  }, []);

  return (
    <div className="blocked-phones-contain">
      <div className="header">
        <h1>Telefonos bloqueados</h1>
      </div>
      <form className="phone-form" onSubmit={handleAddPhone}>
        <input
          placeholder="ej. +52 6621258651"
          value={newPhone}
          onChange={(event) => setNewPhone(event.target.value)}
          type="text"
        />
        <button className="btn-addPhone" type="submit" disabled={saving}>
          Agregar telefono
        </button>
      </form>
      {!loader ? (
        <div className="admin-table">
          <div className="table-contain">
            <table>
              <thead>
                <tr>
                  <th>Telefono</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {blockedNumbers.length > 0 ? (
                  blockedNumbers.map((phone) => (
                    <tr key={`blocked-phone-${phone}`}>
                      <td data-label="Teléfono">{phone}</td>
                      <td data-label="Acciones">
                        <button
                          onClick={() => handleRemovePhone(phone)}
                          disabled={saving}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2}>No se encontraron telefonos...</td>
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
