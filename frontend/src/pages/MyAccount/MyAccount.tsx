import "./MyAccount.scss";
import {
  ConditionModal,
  ErrorModal,
  PaymentMethodModal,
  PlansModal,
  SuccessModal,
} from "../../components/Modals";
import { Elements } from "@stripe/react-stripe-js";
import {
  User,
  CreditCard,
  Server,
  Clock,
  Copy,
  Eye,
  EyeOff,
  FileDown,
  Trash2,
} from "lucide-react";
import { getCompleted, transformBiteToGb } from "../../functions/functions";
import { IOrders, IQuota, IFtpAccount } from "interfaces/User";
import { Link } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { saveAs } from "file-saver";
import { Spinner } from "../../components/Spinner/Spinner";
import { useEffect, useMemo, useState } from "react";
import { useUserContext } from "../../contexts/UserContext";
import { useTheme } from "../../contexts/ThemeContext";
import { getStripeAppearance } from "../../utils/stripeAppearance";
import Amex from "../../assets/images/cards/express.png";
import filezillaIcon from "../../assets/images/filezilla_icon.png";
import Logo from "../../assets/images/osonuevo.png";
import Mastercard from "../../assets/images/cards/master.png";
import trpc from "../../api";
import Visa from "../../assets/images/cards/visa.png";

const stripeKey =
  process.env.REACT_APP_ENVIRONMENT === "development"
    ? (process.env.REACT_APP_STRIPE_TEST_KEY as string)
    : (process.env.REACT_APP_STRIPE_KEY as string);

const stripePromise = loadStripe(stripeKey);

function MyAccount() {
  const { theme } = useTheme();
  const {
    currentUser,
    startUser,
    paymentMethods,
    cardLoad,
    getPaymentMethods,
  } = useUserContext();
  const stripeOptions = useMemo(() => ({ appearance: getStripeAppearance(theme) }), [theme]);
  const [quota, setQuota] = useState({} as IQuota);
  const [orders, setOrders] = useState<IOrders[]>([]);
  const [showCondition, setShowCondition] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successTitle, setSuccessTitle] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showPaymentMethod, setShowPaymentMethod] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<any>();
  const [conditionMessage, setConditionMessage] = useState("");
  const [conditionTitle, setConditionTitle] = useState("");
  const [condition, setCondition] = useState(0);
  const [showPlan, setShowPlan] = useState<boolean>(false);
  const [showFtpPass, setShowFtpPass] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const closeCondition = () => setShowCondition(false);
  const openCondition = () => setShowCondition(true);
  const closeSuccess = () => setShowSuccess(false);
  const closeError = () => setShowError(false);
  const closePlan = () => setShowPlan(false);
  const openPlan = () => setShowPlan(true);

  const startCancel = () => {
    setConditionTitle("Cancelación de suscripción");
    setConditionMessage("¿Estás seguro que quieres cancelar tu suscripción?");
    openCondition();
    setCondition(1);
  };

  const deletePaymentMethod = (card: any) => {
    setPaymentMethod(card);
    setConditionTitle("Eliminar método de pago");
    setConditionMessage(
      "¿Estás seguro que quieres eliminar este método de pago?"
    );
    openCondition();
    setCondition(3);
  };

  const setDefaultPaymentMethod = (card: any) => {
    setPaymentMethod(card);
    setConditionTitle("Usar esta tarjeta");
    setConditionMessage("¿Usar esta tarjeta para los próximos cobros?");
    openCondition();
    setCondition(2);
  };

  const finishSubscription = async () => {
    closeCondition();
    try {
      await trpc.subscriptions.requestSubscriptionCancellation.mutate();
      startUser();
      setShowSuccess(true);
      setSuccessMessage("Su suscripción se ha cancelado con éxito.");
      setSuccessTitle("Suscripción Cancelada");
    } catch (error) {
      setErrorMessage("Ha habido un error");
      setShowError(true);
      console.log(error);
    }
  };

  const changeDefault = async () => {
    closeCondition();
    if (!paymentMethod?.id) return;
    try {
      await trpc.subscriptions.setDefaultStripePm.mutate({
        paymentMethodId: paymentMethod.id,
      });
      getPaymentMethods();
      setSuccessTitle("Tarjeta actualizada");
      setSuccessMessage("Esta tarjeta se usará para los próximos cobros.");
      setShowSuccess(true);
    } catch (error) {
      setErrorMessage("No se pudo establecer la tarjeta. Intenta de nuevo.");
      setShowError(true);
    }
  };

  const deleteCard = async () => {
    try {
      if (paymentMethod) {
        await trpc.subscriptions.removeStripeCard.mutate({
          paymentMethodId: paymentMethod.id,
        });
        getPaymentMethods();
        closeCondition();
      }
    } catch (error) {}
  };

  const getQuota = async () => {
    if (currentUser !== null) {
      let body: any = {
        isExtended: currentUser.extendedFtpAccount,
      };
      try {
        const quota: any = await trpc.ftp.quota.query(body);
        if (getCompleted(quota.used, quota.available) >= 99) {
          openPlan();
        }
        setQuota(quota);
      } catch (error) {
        console.log(error);
      }
    }
  };

  const getOrders = async () => {
    let body = {};
    try {
      const user_downloads: any =
        await trpc.descargasuser.ownDescargas.query(body);
      let allorders: any = [];
      await Promise.all(
        user_downloads.map(async (orders: any) => {
          if (orders.order_id) {
            let order_body = { where: { id: orders.order_id } };
            const order: any = await trpc.orders.ownOrders.query(order_body);
            if (order.length > 0) allorders.push(order[0]);
          }
        })
      );
      setOrders(allorders);
    } catch (error: any) {
      console.log(error.message);
    }
  };

  const handlePaymentMethod = (value: boolean) => {
    if (!value) {
      setShowPaymentMethod(false);
      getPaymentMethods();
    } else {
      setShowPaymentMethod(false);
      setShowError(true);
      setErrorMessage("Ha habido un error");
    }
  };

  const openBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const returnUrl = `${window.location.origin}/micuenta`;
      const { url } = await trpc.subscriptions.createBillingPortalSession.mutate({
        returnUrl,
      });
      if (url) window.open(url, "_blank");
    } catch {
      setErrorMessage("No se pudo abrir el portal de pagos. Intenta más tarde.");
      setShowError(true);
    } finally {
      setPortalLoading(false);
    }
  };

  const downloadXMLFile = (ftpAccount: IFtpAccount) => {
    const { host, passwd, port, userid } = ftpAccount;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <FileZilla3>
        <Servers>
          <Server>
            <Host>${host}</Host>
            <Port>${port}</Port>
            <Protocol>0</Protocol>
            <Type>0</Type>
            <User>${userid}</User>
            <Pass>${passwd}</Pass>
            <Logontype>1</Logontype>
            <EncodingType>UTF-8</EncodingType>
            <TimezoneOffset>0</TimezoneOffset>
            <PasvMode>MODE_DEFAULT</PasvMode>
            <MaximumMultipleConnections>0</MaximumMultipleConnections>
            <EncodingType>Auto</EncodingType>
            <BypassProxy>0</BypassProxy>
            <Name>Bear Beat FTP</Name>
            <Comments>Home: https://thebearbeat.com/</Comments>
            <LocalDir/>
            <RemoteDir/>
            <SyncBrowsing>0</SyncBrowsing>
          </Server>
        </Servers>
      </FileZilla3>`;
    const blob = new Blob([xml], { type: "text/xml" });
    saveAs(blob, "bearbeat.xml");
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(label);
      setTimeout(() => setCopyFeedback(null), 1500);
    });
  };

  useEffect(() => {
    if (currentUser) {
      getQuota();
      getOrders();
    }
  }, [currentUser]);

  const usedGb = quota?.regular ? transformBiteToGb(quota.regular.used) : 0;
  const availableGb = quota?.regular
    ? transformBiteToGb(quota.regular.available)
    : 10240;
  const storagePercent = quota?.regular
    ? getCompleted(quota.regular.used, quota.regular.available)
    : 0;
  const initials = currentUser?.username
    ? currentUser.username.slice(0, 2).toUpperCase()
    : "??";

  const getStatusBadge = (status: number) => {
    const map: Record<number, { label: string; varColor: string }> = {
      0: { label: "Pendiente", varColor: "var(--ma-badge-pending)" },
      1: { label: "Pagada", varColor: "var(--ma-badge-success)" },
      2: { label: "Fallida", varColor: "var(--ma-badge-fail)" },
      3: { label: "Cancelada", varColor: "var(--ma-badge-neutral)" },
      4: { label: "Expirada", varColor: "var(--ma-badge-neutral)" },
    };
    const { label, varColor } = map[status] ?? { label: "—", varColor: "var(--ma-text-muted)" };
    return (
      <span
        className="inline-flex items-center rounded-full border px-2 py-0.5 font-medium ma-badge"
        style={{
          fontSize: "var(--app-font-size-body)",
          color: varColor,
          borderColor: varColor,
          background: "transparent",
        }}
      >
        {label}
      </span>
    );
  };

  return (
    <div
      className="my-account-main-container min-h-screen"
      style={{ background: "var(--ma-bg)" }}
    >
      <div className="max-w-7xl mx-auto w-full p-4 md:p-6">
        <h1
          className="font-bold mb-1"
          style={{ fontFamily: "Poppins, sans-serif", color: "var(--ma-title)", fontSize: "var(--app-font-size-h1)" }}
        >
          Panel de Control
        </h1>
        <div
          className="h-1 w-24 rounded-full mb-8"
          style={{ background: "var(--ma-accent)" }}
        />

        {/* Module 1: Profile + Consumption (col-span-full) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          <div
            className="lg:col-span-full rounded-xl border p-6 flex flex-col sm:flex-row items-center sm:items-start gap-6"
            style={{
              background: "var(--ma-card-bg)",
              borderColor: "var(--ma-card-border)",
            }}
          >
            <div
              className="flex-shrink-0 w-20 h-20 rounded-full flex items-center justify-center border-2 ring-2"
              style={{
                background: "var(--ma-progress-bg)",
                borderColor: "var(--ma-avatar-ring)",
                boxShadow: "0 0 0 2px var(--ma-avatar-ring)",
              }}
            >
              {currentUser?.profileImg ? (
                <img
                  src={currentUser.profileImg}
                  alt=""
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span
                  className="text-2xl font-bold"
                  style={{ color: "var(--ma-accent)" }}
                >
                  {initials}
                </span>
              )}
            </div>
            <div className="flex-1 w-full text-center sm:text-left">
              <p
                className="font-semibold text-lg"
                style={{ color: "var(--ma-text)" }}
              >
                {currentUser?.username}
              </p>
              <p
                className="mt-0.5"
                style={{ color: "var(--ma-text-muted)", fontSize: "var(--app-font-size-body)" }}
              >
                {currentUser?.email}
              </p>
              {currentUser?.phone && (
                <p
                  className="mt-0.5"
                  style={{ color: "var(--ma-text-muted)", fontSize: "var(--app-font-size-body)" }}
                >
                  {currentUser.phone}
                </p>
              )}
              <div className="mt-4">
                <p
                  className="uppercase tracking-wider mb-2"
                  style={{ color: "var(--ma-text-muted)", fontSize: "var(--app-font-size-body)" }}
                >
                  Almacenamiento Usado: {storagePercent}%
                </p>
                <div
                  className="h-2 w-full rounded-full overflow-hidden"
                  style={{ background: "var(--ma-progress-bg)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(2, storagePercent))}%`,
                      background: "var(--ma-progress-fill)",
                    }}
                  />
                </div>
                <p
                  className="font-mono mt-1"
                  style={{ color: "var(--ma-text-muted)", fontSize: "var(--app-font-size-body)" }}
                >
                  {usedGb} GB de {availableGb} GB
                </p>
              </div>
            </div>
            {currentUser?.hasActiveSubscription &&
              !currentUser.isSubscriptionCancelled && (
                <button
                  type="button"
                  onClick={startCancel}
                  className="flex-shrink-0 px-4 py-2 rounded-full font-semibold transition-colors ma-btn-cancel"
                style={{ fontSize: "var(--app-font-size-body)" }}
                >
                  Cancelar suscripción
                </button>
              )}
          </div>
        </div>

        {/* Module 2: FTP - The Vault */}
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-6 mb-6">
          <div
            className="lg:col-span-3 rounded-xl border p-6"
            style={{
              background: "var(--ma-card-bg)",
              borderColor: "var(--ma-card-border)",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Server className="w-5 h-5" style={{ color: "var(--ma-accent)" }} />
              <h2
                className="text-lg font-bold"
                style={{ color: "var(--ma-text)" }}
              >
                Credenciales FTP (The Vault)
              </h2>
            </div>
            {currentUser?.ftpAccount ? (
              <>
                <div className="space-y-3">
                  <FtpRow
                    label="HOST"
                    value={currentUser.ftpAccount.host}
                    copyToClipboard={copyToClipboard}
                    copyFeedback={copyFeedback}
                  />
                  <FtpRow
                    label="USUARIO"
                    value={currentUser.ftpAccount.userid}
                    copyToClipboard={copyToClipboard}
                    copyFeedback={copyFeedback}
                  />
                  <FtpRow
                    label="PASSWORD"
                    value={currentUser.ftpAccount.passwd}
                    copyToClipboard={copyToClipboard}
                    copyFeedback={copyFeedback}
                    secret
                    showSecret={showFtpPass}
                    onToggleSecret={() => setShowFtpPass((s) => !s)}
                  />
                  <FtpRow
                    label="PUERTO"
                    value={String(currentUser.ftpAccount.port)}
                    copyToClipboard={copyToClipboard}
                    copyFeedback={copyFeedback}
                  />
                  <div
                    className="pt-2"
                    style={{ color: "var(--ma-text-muted)", fontSize: "var(--app-font-size-body)" }}
                  >
                    Expiración:{" "}
                    {currentUser.ftpAccount.expiration?.toDateString?.() ?? "—"}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => downloadXMLFile(currentUser.ftpAccount!)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ma-btn-secondary"
                    style={{ fontSize: "var(--app-font-size-body)" }}
                  >
                    <FileDown className="w-4 h-4" />
                    Descargar FileZilla XML
                  </button>
                  <Link
                    to="/instrucciones"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors font-medium ma-btn-accent"
                    style={{ fontSize: "var(--app-font-size-body)" }}
                  >
                    Instrucciones de conexión
                  </Link>
                </div>
              </>
            ) : (
              <div
                className="rounded-lg border p-4"
                style={{
                  fontSize: "var(--app-font-size-body)",
                  borderColor: "var(--ma-card-border)",
                  background: "var(--ma-progress-bg)",
                  color: "var(--ma-text-muted)",
                }}
              >
                <p>
                  Aún no tienes un plan activo.{" "}
                  <Link
                    to="/planes"
                    className="hover:underline"
                    style={{ color: "var(--ma-accent)" }}
                  >
                    Ver planes
                  </Link>
                </p>
              </div>
            )}
          </div>

          {/* Module 3: Historial de Órdenes */}
          <div
            className="lg:col-span-3 rounded-xl border p-6 overflow-hidden"
            style={{
              background: "var(--ma-card-bg)",
              borderColor: "var(--ma-card-border)",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5" style={{ color: "var(--ma-accent)" }} />
              <h2
                className="text-lg font-bold"
                style={{ color: "var(--ma-text)" }}
              >
                Historial de órdenes
              </h2>
            </div>
            <div className="overflow-x-auto -mx-2">
              <table className="w-full min-w-[320px] ma-table">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--ma-card-border)" }}>
                    <th className="text-left py-3 px-2 uppercase tracking-wider font-semibold" style={{ color: "var(--ma-text-muted)", fontSize: "var(--app-font-size-body)" }}>
                      Fecha
                    </th>
                    <th className="text-left py-3 px-2 uppercase tracking-wider font-semibold" style={{ color: "var(--ma-text-muted)", fontSize: "var(--app-font-size-body)" }}>
                      Orden #
                    </th>
                    <th className="text-left py-3 px-2 uppercase tracking-wider font-semibold" style={{ color: "var(--ma-text-muted)", fontSize: "var(--app-font-size-body)" }}>
                      Precio
                    </th>
                    <th className="text-left py-3 px-2 uppercase tracking-wider font-semibold" style={{ color: "var(--ma-text-muted)", fontSize: "var(--app-font-size-body)" }}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length > 0 ? (
                    orders.map((order: IOrders, index: number) => (
                      <tr
                        key={"order_" + index}
                        className="border-b ma-table-row"
                        style={{ borderColor: "var(--ma-card-border)" }}
                      >
                        <td className="py-3 px-2" style={{ color: "var(--ma-text)", fontSize: "var(--app-font-size-body)" }}>
                          {order.date_order.toDateString()}
                        </td>
                        <td className="py-3 px-2 font-mono" style={{ color: "var(--ma-text)", fontSize: "var(--app-font-size-body)" }}>
                          {order.id}
                        </td>
                        <td className="py-3 px-2" style={{ color: "var(--ma-text)", fontSize: "var(--app-font-size-body)" }}>
                          ${order.total_price}.00
                        </td>
                        <td className="py-3 px-2">
                          {getStatusBadge(order.status)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-8 px-2 text-center"
                        style={{ color: "var(--ma-text-muted)", fontSize: "var(--app-font-size-body)" }}
                      >
                        No hay órdenes en tu historial.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Module 4: Métodos de pago (Wallet) */}
        <div
          className="rounded-xl border p-6"
          style={{
            background: "var(--ma-card-bg)",
            borderColor: "var(--ma-card-border)",
          }}
        >
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5" style={{ color: "var(--ma-accent)" }} />
            <h2 className="text-lg font-bold" style={{ color: "var(--ma-text)" }}>
              Tarjetas
            </h2>
            {paymentMethods.length > 0 && (
              <button
                type="button"
                onClick={openBillingPortal}
                disabled={portalLoading}
                className="ml-auto min-h-[44px] px-4 py-2 rounded-lg font-medium border transition-colors ma-btn-accent"
                style={{ fontSize: "var(--app-font-size-body)" }}
              >
                {portalLoading ? "Abriendo…" : "Gestionar pagos y facturas"}
              </button>
            )}
          </div>
          {!cardLoad ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paymentMethods.map((x: any, index: number) => (
                <div
                  key={"cards_" + index}
                  className="relative rounded-xl border p-4 min-h-[120px] flex flex-col justify-between ma-card-item"
                  style={{
                    borderColor: "var(--ma-card-border)",
                    background: "var(--ma-progress-bg)",
                  }}
                >
                  <div className="flex justify-between items-start">
                    <img
                      src={
                        x.card.brand === "visa"
                          ? Visa
                          : x.card.brand === "mastercard"
                            ? Mastercard
                            : Amex
                      }
                      alt=""
                      className="h-8 w-auto object-contain opacity-90"
                    />
                    <div className="flex items-center gap-1">
                      {paymentMethods.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setDefaultPaymentMethod(x)}
                          className="p-1.5 rounded-lg font-medium transition-colors ma-btn-accent"
                          style={{ fontSize: "var(--app-font-size-body)" }}
                          aria-label="Usar esta tarjeta"
                        >
                          Usar esta
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deletePaymentMethod(x)}
                        className="p-1.5 rounded-lg transition-colors ma-btn-delete"
                        aria-label="Eliminar tarjeta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <p
                      className="font-mono"
                      style={{ color: "var(--ma-text)", fontSize: "var(--app-font-size-body)" }}
                    >
                      •••• •••• •••• {x.card.last4}
                    </p>
                    <p
                      className="mt-1"
                      style={{ color: "var(--ma-text-muted)", fontSize: "var(--app-font-size-body)" }}
                    >
                      {x.card.exp_month}/{x.card.exp_year}
                    </p>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setShowPaymentMethod(!showPaymentMethod)}
                className="min-h-[120px] rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-colors ma-add-card"
                style={{
                  borderColor: "var(--ma-add-card-border)",
                  color: "var(--ma-text-muted)",
                }}
              >
                <CreditCard className="w-6 h-6" />
                <span className="font-medium">Agregar tarjeta</span>
              </button>
            </div>
          ) : (
            <div className="flex justify-center py-12">
              <Spinner size={4} width={0.4} color="var(--ma-accent)" />
            </div>
          )}
        </div>
      </div>

      <ErrorModal show={showError} onHide={closeError} message={errorMessage} />
      <SuccessModal
        show={showSuccess}
        onHide={closeSuccess}
        message={successMessage}
        title={successTitle}
      />
      <Elements stripe={stripePromise} options={stripeOptions}>
        <PaymentMethodModal
          show={showPaymentMethod}
          onHide={handlePaymentMethod}
          message=""
          title="Ingresa una nueva tarjeta"
        />
      </Elements>
      <ConditionModal
        title={conditionTitle}
        message={conditionMessage}
        show={showCondition}
        onHide={closeCondition}
        action={
          condition === 1
            ? finishSubscription
            : condition === 2
              ? changeDefault
              : deleteCard
        }
      />
      <Elements stripe={stripePromise} options={stripeOptions}>
        <PlansModal
          show={showPlan}
          onHide={closePlan}
          dataModals={{
            setShowError: setShowError,
            setShowSuccess: setShowSuccess,
            setSuccessMessage: setSuccessMessage,
            setErrorMessage: setErrorMessage,
            setSuccessTitle: setSuccessTitle,
          }}
        />
      </Elements>
    </div>
  );
}

function FtpRow({
  label,
  value,
  copyToClipboard,
  copyFeedback,
  secret,
  showSecret,
  onToggleSecret,
}: {
  label: string;
  value: string;
  copyToClipboard: (text: string, label: string) => void;
  copyFeedback: string | null;
  secret?: boolean;
  showSecret?: boolean;
  onToggleSecret?: () => void;
}) {
  const displayValue = secret ? (showSecret ? value : "••••••••••••") : value;
  const copied = copyFeedback === label;
  return (
    <div
      className="flex items-center justify-between gap-2 py-2 border-b last:border-0"
      style={{ borderColor: "var(--ma-card-border)" }}
    >
      <span
        className="font-mono uppercase tracking-wider flex-shrink-0"
        style={{ color: "var(--ma-text-muted)", fontSize: "var(--app-font-size-body)" }}
      >
        {label}:
      </span>
      <code
        className="font-mono truncate flex-1 text-right mr-2"
        style={{ color: "var(--ma-text)", fontSize: "var(--app-font-size-body)" }}
      >
        {displayValue}
      </code>
      <div className="flex items-center gap-1 flex-shrink-0">
        {secret && onToggleSecret && (
          <button
            type="button"
            onClick={onToggleSecret}
            className="p-1.5 rounded transition-colors ma-ftp-icon"
            aria-label={showSecret ? "Ocultar" : "Mostrar"}
          >
            {showSecret ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => copyToClipboard(value, label)}
          className="p-1.5 rounded transition-colors ma-ftp-icon"
          aria-label="Copiar"
        >
          <Copy className="w-4 h-4" />
        </button>
        {copied && (
          <span style={{ color: "var(--ma-accent)", fontSize: "var(--app-font-size-body)" }}>
            Copiado
          </span>
        )}
      </div>
    </div>
  );
}

export default MyAccount;
