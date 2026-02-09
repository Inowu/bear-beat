import "../Modal.scss";
import "react-phone-input-2/lib/material.css";
import { PasswordInput } from "../../PasswordInput/PasswordInput";
import "react-phone-input-2/lib/material.css";
import { ErrorModal } from "../ErrorModal/ErrorModal";
import { findCountryCode, twoDigitsCountryCodes } from "../../../utils/country_codes";
import { Modal } from "react-bootstrap";
import { of } from "await-of";
import { XCircle } from "lucide-react";
import { Spinner } from "../../Spinner/Spinner";
import { SuccessModal } from "../SuccessModal/SuccessModal";
import { useFormik } from "formik";
import { USER_ROLES } from "../../../interfaces/admin";
import { useState, useEffect } from "react";
import * as Yup from "yup";
import es from "react-phone-input-2/lang/es.json";
import PhoneInput from "react-phone-input-2";
import trpc from "../../../api";
import { GROWTH_METRICS, trackGrowthMetric } from "../../../utils/growthMetrics";

interface IEditPlanModal {
  showModal: boolean;
  onHideModal: () => void;
  editingUser: UserToEdit;
  onSaved?: () => void;
}

interface UserToEdit {
  id: number;
  email: string;
  username: string;
  phone: string;
  role: number;
}

export function EditUserModal(props: IEditPlanModal) {
  const { showModal, onHideModal, editingUser, onSaved } = props;

  // const navigate = useNavigate();
  const [loader, setLoader] = useState<boolean>(false);
  const [show, setShow] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [code, setCode] = useState<string>("52");
  const [countryCode, setCountryCode] = useState<string>("mx");
  const [errorMessage, setErrorMessage] = useState<any>("");
  const closeModal = () => {
    setShow(false);
  };
  const closeSuccess = () => {
    setShowSuccess(false);
    onSaved?.();
    onHideModal();
  };

  const validationSchema = Yup.object().shape({
    email: Yup.string().required("El correo es requerido"),
    password: Yup.string().min(6, "La contraseña debe contener por lo menos 6 caracteres"),
    name: Yup.string().required("El nombre es requerido"),
    phone: Yup.string()
      .required("El teléfono es requerido")
      .matches(/^[0-9]{7,10}$/, "El teléfono no es válido"),
  });

  const handlePhoneNumberChange = (value: any, country: any) => {
    setCode(country.dialCode);
  };

  const initialValues = {
    email: "",
    password: "",
    name: "",
    phone: "",
    role: 4,
  };

  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setLoader(true);
      trackGrowthMetric(GROWTH_METRICS.FORM_SUBMIT, { formId: "admin_edit_user" });
      const body: {
        email: string;
        username: string;
        phone: string;
        role_id: number;
        password?: string;
      } = {
        email: values.email,
        username: values.name,
        phone: `+${code} ${values.phone}`,
        role_id: values.role,
      };

      if (values.password.trim().length > 0) {
        body.password = values.password;
      }

      const [, errorUpdate] = await of(
        trpc.users.updateOneUsers.mutate({
          where: { id: editingUser.id },
          data: body,
        })
      );

      if (errorUpdate) {
        trackGrowthMetric(GROWTH_METRICS.ADMIN_ACTION, {
          action: "update",
          entity: "user",
          success: false,
        });
        setShow(true);
        setErrorMessage(errorUpdate.message);
        setLoader(false);
      } else {
        trackGrowthMetric(GROWTH_METRICS.ADMIN_ACTION, {
          action: "update",
          entity: "user",
          success: true,
        });
        setShowSuccess(true);
        setLoader(false);
      }
    },
  });

  useEffect(() => {
    if (editingUser) {
      let dialCode = "52";
      let phoneNumber = editingUser.phone;

      if (editingUser.phone) {
        if (editingUser.phone.includes(" ")) {
          dialCode = editingUser.phone.trim().split(" ")[0].replace("+", "");
          phoneNumber = editingUser.phone.trim().split(" ")[1];
          setCountryCode(findCountryCode(editingUser.phone.trim().split(" ")[0]));
        } else {
          phoneNumber = "";
        }
      }

      formik.setValues({
        password: "",
        email: editingUser.email,
        name: editingUser.username,
        phone: phoneNumber,
        role: editingUser.role,
      });

      setCode(dialCode);
    }
  }, [editingUser]);

  return (
    <Modal show={showModal} onHide={onHideModal} centered>
      <form className="modal-addusers" onSubmit={formik.handleSubmit}>
        <XCircle className="icon" onClick={onHideModal} aria-label="Cerrar" />
        <h2>Editar Usuario</h2>
        <div className="c-row">
          <label>Nombre de usuario</label>
          <input
            placeholder="Nombre"
            type="name"
            id="name"
            name="name"
            value={formik.values.name}
            onChange={formik.handleChange}
          />
          {formik.errors.name && <div className="error-formik">{formik.errors.name}</div>}
        </div>
        <div className="c-row">
          <label>Correo</label>
          <input
            placeholder="Correo electrónico"
            type="email"
            id="email"
            name="email"
            value={formik.values.email}
            onChange={formik.handleChange}
          />
          {formik.errors.email && <div className="error-formik">{formik.errors.email}</div>}
        </div>
        <div className="c-row">
          <label>Tipo de usuario</label>
          <select id="role" defaultValue={formik.values.role} onChange={formik.handleChange}>
            <option value={USER_ROLES.ADMIN} selected={editingUser.role === USER_ROLES.ADMIN}>
              Admin
            </option>
            <option value={USER_ROLES.SUBADMIN} selected={editingUser.role === USER_ROLES.SUBADMIN}>
              Subadmin
            </option>
            <option value={USER_ROLES.EDITOR} selected={editingUser.role === USER_ROLES.EDITOR}>
              Editor
            </option>
            <option value={USER_ROLES.NORMAL} selected={editingUser.role === USER_ROLES.NORMAL}>
              Normal
            </option>
          </select>
        </div>
        <div className="c-row2">
          <PhoneInput
            containerClass="dial-container"
            buttonClass="dial-code"
            country={countryCode}
            placeholder="Teléfono"
            preferredCountries={["mx", "us", "ca", "es"]}
            onlyCountries={twoDigitsCountryCodes.map((c) => c.toLowerCase())}
            localization={es}
            onChange={handlePhoneNumberChange}
          />
          <p className="code">+{code}</p>
          <input
            className="phone"
            placeholder="Teléfono"
            id="phone"
            name="phone"
            value={formik.values.phone}
            onChange={formik.handleChange}
            type="text"
          />
          {formik.errors.phone && <div className="error-formik">{formik.errors.phone}</div>}
        </div>
        <div className="c-row">
          <label>Nueva contraseña (opcional)</label>
          <PasswordInput
            placeholder="Contraseña"
            id="password"
            name="password"
            value={formik.values.password}
            onChange={formik.handleChange}
            inputClassName="modal-password-input"
          />
          {formik.errors.password && <div className="error-formik">{formik.errors.password}</div>}
        </div>
        {!loader ? (
          <button className="btn-option-4" type="submit">
            Editar Usuario
          </button>
        ) : (
          <div style={{ marginBottom: 10 }}>
            <Spinner size={3} width={0.3} color="var(--app-accent)" />
          </div>
        )}
        <button className="btn-cancel" onClick={onHideModal} type="reset">
          Cancelar
        </button>
        <ErrorModal show={show} onHide={closeModal} message={errorMessage} />
        <SuccessModal
          show={showSuccess}
          onHide={closeSuccess}
          message="Se ha actualizado la información del usuario"
          title="Edición Exitosa"
        />
      </form>
    </Modal>
  );
}
