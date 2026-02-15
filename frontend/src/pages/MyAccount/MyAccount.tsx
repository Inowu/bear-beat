import "./MyAccount.scss";
import {
  CancellationReasonModal,
  type CancellationReasonCode,
  ConditionModal,
  ErrorModal,
  PaymentMethodModal,
  PlansModal,
  SuccessModal,
} from "../../components/Modals";
import { Elements } from "@stripe/react-stripe-js";
import {
  CreditCard,
  Server,
  Clock,
  Copy,
  Eye,
  EyeOff,
  FileDown,
  Mail,
  Trash2,
} from "src/icons";
import visaLogo from "../../assets/images/cards/visa.png";
import mastercardLogo from "../../assets/images/cards/master.png";
import amexLogo from "../../assets/images/cards/express.png";
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
import trpc from "../../api";

import { GROWTH_METRICS, getGrowthAttribution, trackGrowthMetric } from "../../utils/growthMetrics";
import { formatDateShort, formatInt } from "../../utils/format";

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
  const [showCancelReasonModal, setShowCancelReasonModal] = useState(false);
  const [emailPrefs, setEmailPrefs] = useState<null | {
    enabled: boolean;
    news: boolean;
    offers: boolean;
    digest: boolean;
    updatedAt: Date | null;
  }>(null);
  const [emailPrefsLoading, setEmailPrefsLoading] = useState(false);
  const [emailPrefsSaving, setEmailPrefsSaving] = useState(false);
  const [emailPrefsNotice, setEmailPrefsNotice] = useState<string | null>(null);

  const closeCondition = () => setShowCondition(false);
  const openCondition = () => setShowCondition(true);
  const closeSuccess = () => setShowSuccess(false);
  const closeError = () => setShowError(false);
  const closePlan = () => setShowPlan(false);
  const openPlan = () => setShowPlan(true);

  const startCancel = () => {
    setShowCancelReasonModal(true);
    trackGrowthMetric(GROWTH_METRICS.SUBSCRIPTION_CANCEL_STARTED, { surface: "my_account" });
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

  const finishSubscription = async (reasonCode: CancellationReasonCode, reasonText: string) => {
    try {
      await trpc.subscriptions.requestSubscriptionCancellation.mutate({
        reasonCode,
        reasonText: reasonText?.trim() ? reasonText.trim() : null,
        attribution: getGrowthAttribution(),
      });
      trackGrowthMetric(GROWTH_METRICS.SUBSCRIPTION_CANCEL_CONFIRMED, {
        surface: "my_account",
        reasonCode,
      });
      startUser();
      setShowSuccess(true);
      setSuccessMessage("Su suscripción se ha cancelado con éxito.");
      setSuccessTitle("Suscripción Cancelada");
    } catch (error) {
      trackGrowthMetric(GROWTH_METRICS.SUBSCRIPTION_CANCEL_FAILED, {
        surface: "my_account",
        reasonCode,
        reason: error instanceof Error ? error.message : "unknown-error",
      });
      throw error;
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
      try {
        const quota: any = await trpc.ftp.quota.query();
        const regularRemaining: bigint =
          (quota?.regular?.available ?? BigInt(0)) - (quota?.regular?.used ?? BigInt(0));
        const extendedRemaining: bigint =
          (quota?.extended?.available ?? BigInt(0)) - (quota?.extended?.used ?? BigInt(0));

        // Modal de recarga: solo cuando ya no quedan GB (regular + extra).
        if (currentUser?.hasActiveSubscription && regularRemaining <= BigInt(0) && extendedRemaining <= BigInt(0)) {
          openPlan();
        }
        setQuota(quota);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("[MYACCOUNT] Failed to load quota.");
        }
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
      if (import.meta.env.DEV) {
        console.warn("[MYACCOUNT] Failed to load orders.");
      }
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

  const loadEmailPreferences = async () => {
    if (!currentUser) return;
    setEmailPrefsLoading(true);
    try {
      const result = await trpc.comms.getEmailPreferences.query();
      const marketing = result?.marketingEmail;
      if (marketing) {
        setEmailPrefs({
          enabled: Boolean(marketing.enabled),
          news: Boolean(marketing.news),
          offers: Boolean(marketing.offers),
          digest: Boolean(marketing.digest),
          updatedAt: marketing.updatedAt ? new Date(marketing.updatedAt) : null,
        });
      }
    } catch {
      // Non-blocking: keep the account page usable.
      setEmailPrefsNotice("No se pudieron cargar tus preferencias de email.");
    } finally {
      setEmailPrefsLoading(false);
    }
  };

  const updateEmailPreferences = async (patch: {
    enabled?: boolean;
    news?: boolean;
    offers?: boolean;
    digest?: boolean;
  }) => {
    setEmailPrefsSaving(true);
    try {
      const result = await trpc.comms.updateEmailPreferences.mutate(patch);
      const marketing = result?.marketingEmail;
      if (marketing) {
        setEmailPrefs({
          enabled: Boolean(marketing.enabled),
          news: Boolean(marketing.news),
          offers: Boolean(marketing.offers),
          digest: Boolean(marketing.digest),
          updatedAt: marketing.updatedAt ? new Date(marketing.updatedAt) : null,
        });
      }
      setEmailPrefsNotice("Guardado.");
      window.setTimeout(() => setEmailPrefsNotice(null), 2000);
    } catch {
      setEmailPrefsNotice("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setEmailPrefsSaving(false);
    }
  };

  useEffect(() => {
    loadEmailPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

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
    const onSuccess = () => {
      setCopyFeedback(label);
      window.setTimeout(() => setCopyFeedback(null), 1500);
    };

    const fallbackCopy = () => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "-9999px";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (!ok) throw new Error("copy_failed");
      onSuccess();
    };

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(onSuccess)
        .catch(() => {
          try {
            fallbackCopy();
          } catch {
            setErrorMessage("No se pudo copiar. Intenta copiar manualmente.");
            setShowError(true);
          }
        });
      return;
    }

    try {
      fallbackCopy();
    } catch {
      setErrorMessage("No se pudo copiar. Intenta copiar manualmente.");
      setShowError(true);
    }
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
  const remainingRegularBytes: bigint = quota?.regular
    ? quota.regular.available - quota.regular.used
    : BigInt(0);
  const remainingExtendedBytes: bigint = quota?.extended
    ? quota.extended.available - quota.extended.used
    : BigInt(0);
  const remainingRegularGb = quota?.regular
    ? transformBiteToGb(remainingRegularBytes > BigInt(0) ? remainingRegularBytes : BigInt(0))
    : 0;
  const remainingExtendedGb = quota?.extended
    ? transformBiteToGb(remainingExtendedBytes > BigInt(0) ? remainingExtendedBytes : BigInt(0))
    : 0;
  const initialsSource = (currentUser?.username ?? currentUser?.email ?? "DJ").trim();
  const normalizedInitials = initialsSource
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase();
  const initials = normalizedInitials === "" ? "DJ" : normalizedInitials;
  const membershipStatus = currentUser?.hasActiveSubscription
    ? currentUser.isSubscriptionCancelled
      ? "Cancela al final del ciclo"
      : "Membresía activa"
    : "Sin membresía activa";
  const membershipTone = currentUser?.hasActiveSubscription
    ? currentUser.isSubscriptionCancelled
      ? "warning"
      : "success"
    : "muted";
  const ftpStatus = currentUser?.ftpAccount ? "FTP habilitado" : "Sin acceso FTP";

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
        className="ma-badge"
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

  if (!currentUser) {
    return (
      <div className="my-account-main-container">
        <div className="ma-shell">
          <div className="global-loader" aria-busy="true" aria-live="polite">
            <div className="app-state-panel is-loading" role="status">
              <span className="app-state-icon" aria-hidden>
                <Spinner size={2.8} width={0.25} color="var(--ma-accent)" />
              </span>
              <h2 className="app-state-title">Cargando tu cuenta</h2>
              <p className="app-state-copy">Estamos preparando tus credenciales y tus métodos de pago.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-account-main-container">
      <div className="ma-shell">
        <header className="ma-page-head">
          <span className="ma-page-kicker">Panel de cuenta</span>
          <h1>Mi cuenta</h1>
          <p>Gestiona tu acceso, FTP y métodos de pago desde un solo lugar.</p>
        </header>

        <section className="ma-panel ma-profile-panel">
          <div className="ma-avatar-block">
            <div className="ma-avatar">
              {currentUser?.profileImg ? (
                <img
                  src={currentUser.profileImg}
                  alt={`Foto de perfil de ${currentUser?.username ?? "usuario"}`}
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
          </div>
          <div className="ma-profile-content">
            <p className="ma-user-name">{currentUser?.username ?? "Usuario"}</p>
            <p className="ma-user-meta">{currentUser?.email ?? "Sin correo"}</p>
            {currentUser?.phone && (
              <p className="ma-user-meta">{currentUser.phone}</p>
            )}
            <div className="ma-status-row" aria-label="Estado de la cuenta">
              <span className={`ma-status-pill ma-status-pill--${membershipTone}`}>
                {membershipStatus}
              </span>
              <span className="ma-status-pill ma-status-pill--neutral">{ftpStatus}</span>
            </div>
            <div className="ma-storage">
              <div className="ma-storage-head">
                <span>Cuota mensual / usado este ciclo</span>
                <strong>{storagePercent}%</strong>
              </div>
              <div className="ma-progress-track">
                <div
                  className="ma-progress-fill"
                  style={{ width: `${Math.min(100, Math.max(2, storagePercent))}%` }}
                />
              </div>
              <p className="ma-storage-amount">
                {formatInt(availableGb)} GB/mes · usados: {formatInt(usedGb)} GB este ciclo
              </p>
              <p className="ma-storage-amount">
                La cuota mensual es lo que puedes descargar cada ciclo. El catálogo total es lo disponible para elegir.
              </p>
              {currentUser?.hasActiveSubscription && (
                <>
                  <p className="ma-storage-amount">
                    Te quedan: {formatInt(remainingRegularGb)} GB este ciclo · GB extra disponibles: {formatInt(remainingExtendedGb)} GB
                  </p>
                  <button type="button" onClick={openPlan} className="ma-btn ma-btn-soft">
                    Recargar GB extra
                  </button>
                </>
              )}
            </div>
          </div>
          {currentUser?.hasActiveSubscription &&
            !currentUser.isSubscriptionCancelled && (
              <button type="button" onClick={startCancel} className="ma-btn ma-btn-danger">
                Cancelar suscripción
              </button>
            )}
        </section>

        <div className="ma-grid-two">
          <section className="ma-panel ma-ftp-panel">
            <div className="ma-panel-head">
              <Server size={18} />
              <h2>Credenciales FTP</h2>
            </div>
            {currentUser?.ftpAccount ? (
              <>
                <div className="ma-ftp-list">
                  <FtpRow
                    label="Host"
                    value={currentUser.ftpAccount.host}
                    copyToClipboard={copyToClipboard}
                    copyFeedback={copyFeedback}
                  />
                  <FtpRow
                    label="Usuario"
                    value={currentUser.ftpAccount.userid}
                    copyToClipboard={copyToClipboard}
                    copyFeedback={copyFeedback}
                  />
                  <FtpRow
                    label="Contraseña"
                    value={currentUser.ftpAccount.passwd}
                    copyToClipboard={copyToClipboard}
                    copyFeedback={copyFeedback}
                    secret
                    showSecret={showFtpPass}
                    onToggleSecret={() => setShowFtpPass((s) => !s)}
                  />
                  <FtpRow
                    label="Puerto"
                    value={String(currentUser.ftpAccount.port)}
                    copyToClipboard={copyToClipboard}
                    copyFeedback={copyFeedback}
                  />
                </div>
                <p className="ma-ftp-expiration">
                  Expiración: {formatDateShort(currentUser.ftpAccount.expiration ?? null)}
                </p>
                <div className="ma-ftp-actions">
                  <button
                    type="button"
                    onClick={() => downloadXMLFile(currentUser.ftpAccount!)}
                    className="ma-btn ma-btn-soft"
                  >
                    <FileDown size={16} />
                    Descargar XML FileZilla
                  </button>
                  <Link to="/instrucciones" className="ma-btn ma-btn-outline">
                    Ver instrucciones
                  </Link>
                </div>
              </>
            ) : (
              <div className="ma-empty-card">
                <p>
                  Aún no tienes un plan activo.{" "}
                  <Link to="/planes">Ver planes</Link>
                </p>
              </div>
            )}
          </section>

          <section className="ma-panel ma-orders-panel">
            <div className="ma-panel-head">
              <Clock size={18} />
              <h2>Historial de órdenes</h2>
            </div>
            <div
              className="ma-table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Historial de órdenes (desliza para ver más columnas)"
              data-scroll-region
            >
              <table className="ma-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Orden #</th>
                    <th>Precio</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length > 0 ? (
                    orders.map((order: IOrders, index: number) => (
                      <tr key={"order_" + index} className="ma-table-row">
                        <td>{formatDateShort(order.date_order)}</td>
                        <td className="ma-mono">{order.id}</td>
                        <td>${order.total_price}.00</td>
                        <td>{getStatusBadge(order.status)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="ma-table-empty">
                        No hay órdenes en tu historial.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section className="ma-panel ma-wallet-panel">
          <div className="ma-panel-head">
            <CreditCard size={18} />
            <h2>Tarjetas</h2>
            {paymentMethods.length > 0 && (
              <button
                type="button"
                onClick={openBillingPortal}
                disabled={portalLoading}
                className="ma-btn ma-btn-outline ma-head-action"
              >
                {portalLoading ? "Abriendo…" : "Gestionar pagos y facturas"}
              </button>
            )}
          </div>
              {!cardLoad ? (
            <div className="ma-cards-grid">
              {paymentMethods.map((x: any, index: number) => (
                <article key={"cards_" + index} className="ma-card-item">
                  <div className="ma-card-top">
                    {(() => {
                      const rawBrand = `${x?.card?.brand ?? ""}`.toLowerCase();
                      const brandKey =
                        rawBrand === "visa"
                          ? "visa"
                          : rawBrand === "mastercard"
                            ? "mastercard"
                            : rawBrand === "amex" || rawBrand === "american_express"
                              ? "amex"
                              : "amex";
                      const brandLogo =
                        brandKey === "visa"
                          ? visaLogo
                          : brandKey === "mastercard"
                            ? mastercardLogo
                            : amexLogo;
                      const brandLabel =
                        brandKey === "visa"
                          ? "Visa"
                          : brandKey === "mastercard"
                            ? "Mastercard"
                            : "American Express";

                      return (
                        <img
                          src={brandLogo}
                          alt={brandLabel}
                          className={`ma-card-brand ma-card-brand--${brandKey}`}
                        />
                      );
                    })()}
                    <div className="ma-card-actions">
                      {paymentMethods.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setDefaultPaymentMethod(x)}
                          className="ma-btn ma-btn-outline ma-btn-small"
                          aria-label="Usar esta tarjeta"
                        >
                          Usar esta
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deletePaymentMethod(x)}
                        className="ma-icon-btn ma-btn-delete"
                        aria-label="Eliminar tarjeta"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <p className="ma-card-number">•••• •••• •••• {x.card.last4}</p>
                  <p className="ma-card-date">{x.card.exp_month}/{x.card.exp_year}</p>
                </article>
              ))}
              <button
                type="button"
                onClick={() => setShowPaymentMethod(!showPaymentMethod)}
                className="ma-add-card"
              >
                <CreditCard size={20} />
                <span>Agregar tarjeta</span>
              </button>
            </div>
          ) : (
            <div className="ma-loading-cards">
              <Spinner size={4} width={0.4} color="var(--ma-accent)" />
            </div>
          )}
        </section>

        <section className="ma-panel ma-comms-panel" aria-label="Preferencias de email">
          <div className="ma-panel-head">
            <Mail size={18} />
            <h2>Preferencias de email</h2>
          </div>
          <p className="ma-pref-note">
            Los correos transaccionales (seguridad, pagos, cancelación y soporte) son necesarios para operar el servicio y siempre estarán activos.
          </p>

          {emailPrefsLoading ? (
            <div className="ma-loading-cards">
              <Spinner size={3.2} width={0.35} color="var(--ma-accent)" />
            </div>
          ) : !emailPrefs ? (
            <div className="ma-empty-card">
              <p>{emailPrefsNotice ?? "No se pudieron cargar tus preferencias de email."}</p>
              <button
                type="button"
                className="ma-btn ma-btn-soft"
                onClick={loadEmailPreferences}
                disabled={emailPrefsSaving}
              >
                Reintentar
              </button>
            </div>
          ) : (
            <>
              <div className="ma-pref-list">
                <PrefToggle
                  id="bb-email-marketing-enabled"
                  title="Promociones y novedades por email"
                  description="Activa o desactiva todos los correos de marketing."
                  checked={emailPrefs.enabled}
                  disabled={emailPrefsSaving}
                  onChange={(next) => updateEmailPreferences({ enabled: next })}
                />
                <div className={`ma-pref-sublist ${emailPrefs.enabled ? "" : "is-disabled"}`}>
                  <PrefToggle
                    id="bb-email-marketing-news"
                    title="Novedades y tips"
                    description="Guías rápidas, recordatorios y mejoras del servicio."
                    checked={emailPrefs.news}
                    disabled={!emailPrefs.enabled || emailPrefsSaving}
                    onChange={(next) => updateEmailPreferences({ news: next })}
                  />
                  <PrefToggle
                    id="bb-email-marketing-offers"
                    title="Ofertas y cupones"
                    description="Descuentos, cupones personales y winback."
                    checked={emailPrefs.offers}
                    disabled={!emailPrefs.enabled || emailPrefsSaving}
                    onChange={(next) => updateEmailPreferences({ offers: next })}
                  />
                  <PrefToggle
                    id="bb-email-marketing-digest"
                    title="Digest"
                    description="Resumen periódico de novedades (si aplica)."
                    checked={emailPrefs.digest}
                    disabled={!emailPrefs.enabled || emailPrefsSaving}
                    onChange={(next) => updateEmailPreferences({ digest: next })}
                  />
                </div>
              </div>

              <p className="ma-pref-meta" aria-live="polite">
                {emailPrefsNotice
                  ? emailPrefsNotice
                  : emailPrefs.updatedAt
                    ? `Última actualización: ${formatDateShort(emailPrefs.updatedAt)}`
                    : "Puedes cambiar tus preferencias cuando quieras."}
              </p>
            </>
          )}
        </section>
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
          condition === 2 ? changeDefault : deleteCard
        }
      />
      <CancellationReasonModal
        title="Cancelación de suscripción"
        message="Antes de cancelar, dinos el motivo (nos ayuda a mejorar)."
        show={showCancelReasonModal}
        onHide={() => setShowCancelReasonModal(false)}
        onReasonChange={(reasonCode) => {
          trackGrowthMetric(GROWTH_METRICS.SUBSCRIPTION_CANCEL_REASON_SELECTED, {
            surface: "my_account",
            reasonCode,
          });
        }}
        onConfirm={({ reasonCode, reasonText }) => finishSubscription(reasonCode, reasonText)}
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

function PrefToggle({
  id,
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label htmlFor={id} className={`ma-pref-row ${disabled ? "is-disabled" : ""}`}>
      <span className="ma-pref-copy">
        <span className="ma-pref-title">{title}</span>
        <span className="ma-pref-desc">{description}</span>
      </span>
      <span className="ma-pref-control">
        <input
          id={id}
          className="ma-switch-input"
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="ma-switch" aria-hidden="true" />
      </span>
    </label>
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
    <div className="ma-ftp-row">
      <span className="ma-ftp-label">{label}:</span>
      <span className="ma-ftp-value">{displayValue}</span>
      <div className="ma-ftp-actions-inline">
        {secret && onToggleSecret && (
          <button
            type="button"
            onClick={onToggleSecret}
            className="ma-icon-btn ma-ftp-icon"
            aria-label={showSecret ? "Ocultar" : "Mostrar"}
          >
            {showSecret ? (
              <EyeOff size={16} />
            ) : (
              <Eye size={16} />
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => copyToClipboard(value, label)}
          className="ma-icon-btn ma-ftp-icon"
          aria-label="Copiar"
        >
          <Copy size={16} />
        </button>
        {copied && <span className="ma-copy-ok">Copiado</span>}
      </div>
    </div>
  );
}

export default MyAccount;
