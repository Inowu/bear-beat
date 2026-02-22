import "./MyAccount.scss";
import { CancellationReasonModal, type CancellationReasonCode, ConditionModal, ErrorModal, PlansModal, SuccessModal, } from "../../components/Modals";
import { Elements } from "@stripe/react-stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import {
  CreditCard, Server, HardDriveDownload, Clock, Copy, Eye, EyeOff, FileDown, Mail, Trash2, } from "src/icons";
import visaLogo from "../../assets/images/cards/visa.png";
import mastercardLogo from "../../assets/images/cards/master.png";
import amexLogo from "../../assets/images/cards/express.png";
import { getCompleted, transformBiteToGb } from "../../functions/functions";
import { IOrders, IQuota, IFtpAccount } from "interfaces/User";
import { Link, useNavigate } from "react-router-dom";
import { saveAs } from "file-saver";
import { Spinner } from "../../components/Spinner/Spinner";
import { useEffect, useMemo, useRef, useState } from "react";
import { useUserContext } from "../../contexts/UserContext";
import { useTheme } from "../../contexts/ThemeContext";
import { getStripeAppearance } from "../../utils/stripeAppearance";
import trpc from "../../api";

import { GROWTH_METRICS, getGrowthAttribution, trackGrowthMetric } from "../../utils/growthMetrics";
import { formatDateShort, formatInt } from "../../utils/format";
import {
  ensureStripeReady, getStripeLoadFailureReason, } from "../../utils/stripeLoader";
import {
  openManyChatWidget, syncManyChatWidgetVisibility, } from "../../utils/manychatLoader";
import { SkeletonCard, SkeletonRow, Button, Input } from "../../components/ui";
import { appToast } from "../../utils/toast";

type WorkspaceTabId = "orders" | "payments" | "email";

function parseAccountExpiration(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const endOfDay = new Date(`${trimmed}T23:59:59.999`);
      return Number.isNaN(endOfDay.getTime()) ? null : endOfDay;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function MyAccount() {
  const { theme } = useTheme();
  const navigate = useNavigate();
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
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const stripeWarmupRef = useRef<Promise<boolean> | null>(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTabId>("payments");

  const closeCondition = () => setShowCondition(false);
  const openCondition = () => setShowCondition(true);
  const closeSuccess = () => setShowSuccess(false);
  const closeError = () => setShowError(false);
  const closePlan = () => setShowPlan(false);
  const ensureStripeForSurface = async (
    surface: "my_account_add_card" | "my_account_gb_topup",
  ): Promise<boolean> => {
    if (stripePromise) return true;
    if (stripeWarmupRef.current) return stripeWarmupRef.current;

    const warmup = (async () => {
      try {
        const stripe = await ensureStripeReady({ timeoutMs: 4500 });
        setStripePromise(stripe.stripePromise);
        return true;
      } catch (error) {
        trackGrowthMetric(GROWTH_METRICS.CHECKOUT_ERROR, {
          method: "card",
          reason: "stripe_js_load_failed",
          errorCode: getStripeLoadFailureReason(error),
          surface,
        });
        setErrorMessage(
          "No cargó el pago con tarjeta. Reintenta para abrir el método de pago.",
        );
        setShowError(true);
        return false;
      } finally {
        stripeWarmupRef.current = null;
      }
    })();

    stripeWarmupRef.current = warmup;
    return warmup;
  };
  const openPlan = async () => {
    const ready = await ensureStripeForSurface("my_account_gb_topup");
    if (!ready) return;
    setShowPlan(true);
  };

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
      appToast.success("Tarjeta actualizada.");
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
          void openPlan();
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

  const openBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const returnUrl = `${window.location.origin}/micuenta`;
      const { url } = await trpc.subscriptions.createBillingPortalSession.mutate({
        returnUrl,
      });
      if (url) {
        window.location.assign(url);
        return;
      }
      setErrorMessage("No se pudo abrir el portal de pagos. Intenta más tarde.");
      setShowError(true);
    } catch {
      setErrorMessage("No se pudo abrir el portal de pagos. Intenta más tarde.");
      setShowError(true);
    } finally {
      setPortalLoading(false);
    }
  };

  const openSupportChat = () => {
    let openedWidget = false;
    syncManyChatWidgetVisibility(window.location.pathname);
    openedWidget = openManyChatWidget();

    trackGrowthMetric(GROWTH_METRICS.SUPPORT_CHAT_OPENED, {
      surface: "my_account",
      openedWidget,
    });

    if (!openedWidget) {
      window.location.assign("/legal#faq");
    }
  };

  const openUpgradePlans = () => {
    trackGrowthMetric(GROWTH_METRICS.CTA_CLICK, {
      id: "quota_low_upgrade_plan",
      location: "my_account",
      remainingGb: Math.max(0, Math.trunc(totalRemainingGb)),
    });
    navigate("/actualizar-planes?entry=quota-warning");
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
      appToast.success("Cambios de cuenta guardados.");
      window.setTimeout(() => setEmailPrefsNotice(null), 2000);
    } catch {
      setEmailPrefsNotice("No se pudo guardar. Intenta de nuevo.");
      appToast.error("Error de red — Revisa tu conexión.");
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

  const copyToClipboard = (
    text: string,
    label: string,
    target: "host" | "user" | "password" | "port" | "full_credentials" = "full_credentials",
  ) => {
    const onSuccess = () => {
      setCopyFeedback(label);
      trackGrowthMetric(GROWTH_METRICS.MYACCOUNT_FTP_COPY_CLICK, {
        surface: "my_account",
        target,
      });
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
  const storagePercentRaw = quota?.regular
    ? getCompleted(quota.regular.used, quota.regular.available)
    : 0;
  const storagePercent = Number.isFinite(storagePercentRaw) ? Math.max(0, storagePercentRaw) : 0;
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
  const totalRemainingGb = Math.max(0, remainingRegularGb + remainingExtendedGb);
  const storagePercentLabel = storagePercent > 100 ? "100%+" : `${storagePercent}%`;
  const storageFillPercent = storagePercent <= 0 ? 0 : Math.min(100, Math.max(2, storagePercent));
  const hasQuotaReached = storagePercent >= 100;
  const hasNoQuotaLeft = remainingRegularGb <= 0 && remainingExtendedGb <= 0;
  const lowQuotaThresholdGb = Math.max(40, Math.round(Math.max(availableGb, 1) * 0.2));
  const hasLowQuotaWarning =
    Boolean(currentUser?.hasActiveSubscription) &&
    totalRemainingGb > 0 &&
    totalRemainingGb <= lowQuotaThresholdGb;
  const hasActiveSubscription = Boolean(currentUser?.hasActiveSubscription);
  const hasFtpRecord = Boolean(currentUser?.ftpAccount);
  const ftpExpiration = parseAccountExpiration(currentUser?.ftpAccount?.expiration ?? null);
  const isFtpExpired = Boolean(ftpExpiration && ftpExpiration.getTime() < Date.now());
  const hasFtpAccess = hasFtpRecord && !isFtpExpired;
  const hasAccessWithoutSubscription = !hasActiveSubscription && hasFtpAccess;
  const hasExpiredFtpAccess = !hasActiveSubscription && hasFtpRecord && isFtpExpired;
  const cycleEndLabel = formatDateShort(ftpExpiration ?? currentUser?.ftpAccount?.expiration ?? null);
  const cycleEndOrFallback = cycleEndLabel !== "—" ? cycleEndLabel : "el siguiente ciclo";
  const nextBillingLabel = hasExpiredFtpAccess
    ? cycleEndLabel !== "—"
      ? cycleEndLabel
      : "Vencido"
    : cycleEndLabel !== "—"
      ? cycleEndLabel
      : "Sin fecha disponible";
  const nextBillingTitle = hasActiveSubscription && !currentUser?.isSubscriptionCancelled
    ? "Próximo cobro"
    : hasExpiredFtpAccess
      ? "Acceso vencido"
      : "Próximo vencimiento";
  const initialsSource = (currentUser?.username ?? currentUser?.email ?? "DJ").trim();
  const normalizedInitials = initialsSource
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase();
  const initials = normalizedInitials === "" ? "DJ" : normalizedInitials;
  const membershipStatus = hasActiveSubscription
    ? currentUser.isSubscriptionCancelled
      ? "Cancela al final del ciclo"
      : "Membresía activa"
    : hasAccessWithoutSubscription
      ? "Sin membresía (acceso FTP vigente)"
      : hasExpiredFtpAccess
        ? "Sin membresía (acceso FTP vencido)"
      : "Sin membresía activa";
  const membershipTone = hasActiveSubscription
    ? currentUser.isSubscriptionCancelled
      ? "warning"
      : "success"
    : hasAccessWithoutSubscription
      ? "warning"
      : hasExpiredFtpAccess
        ? "danger"
      : "muted";
  const ftpStatus = hasFtpAccess ? "FTP habilitado" : "Sin acceso FTP";
  const ftpTone = hasFtpAccess ? "success" : hasFtpRecord ? "warning" : "muted";
  const membershipCtaLabel = hasExpiredFtpAccess ? "Reactivar membresía" : "Activar membresía";
  const membershipCtaMessage = hasExpiredFtpAccess
    ? `Tu acceso FTP venció ${cycleEndOrFallback}. Activa tu membresía para recuperar descargas.`
    : "Activa tu membresía para evitar interrupciones en tu acceso.";
  const ftpPriorityMessage = hasFtpAccess
    ? "1) Copia tus credenciales. 2) Abre la guía. 3) Empieza a descargar."
    : hasFtpRecord
      ? `Tu acceso venció ${cycleEndOrFallback}. Reactiva tu membresía para volver a descargar.`
      : "Aún no tienes credenciales FTP activas. Activa tu membresía y aquí aparecerán.";
  const shouldShowQuota = hasFtpAccess || hasActiveSubscription;
  const workspaceTabs: Array<{ id: WorkspaceTabId; label: string; helper: string }> = [
    {
      id: "orders",
      label: "Órdenes",
      helper: "Tu historial de pagos y estados.",
    },
    {
      id: "payments",
      label: "Pagos",
      helper: "Tarjetas, método por defecto y facturas.",
    },
    {
      id: "email",
      label: "Emails",
      helper: "Control de promociones y novedades.",
    },
  ];
  const activeWorkspaceHelper =
    workspaceTabs.find((tab) => tab.id === activeWorkspaceTab)?.helper ??
    "";

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
      <div className="my-account-main-container bb-app-page">
        <div className="ma-shell">
          <div className="global-loader" aria-busy="true" aria-live="polite">
            <div className="app-state-panel is-loading bb-skeleton-shell" role="status">
              <span className="sr-only">Actualizando datos de tu cuenta</span>
              <SkeletonCard />
              <SkeletonRow width="58%" />
              <SkeletonRow width="72%" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-account-main-container bb-app-page bb-skeleton-fade-in">
      <div className="ma-shell">
        <header className="ma-page-head">
          <span className="ma-page-kicker">Panel de cuenta</span>
          <h1>Mi cuenta</h1>
          <p>Gestiona tu acceso, FTP y métodos de pago desde un solo lugar.</p>
        </header>

        {!hasActiveSubscription && (
          <section className="ma-top-cta" aria-label="Activar membresía">
            <div className="ma-top-cta__group">
              <p>
                {membershipCtaMessage}
              </p>
              <Link to="/planes" className="ma-btn ma-btn-outline">
                {membershipCtaLabel}
              </Link>
            </div>
          </section>
        )}

        <section className="ma-grid-two ma-overview-grid" aria-label="Resumen principal de la cuenta">
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
              <p className="ma-profile-eyebrow">Perfil y estado</p>
              <p className="ma-user-name">{currentUser?.username ?? "Usuario"}</p>
              <p className="ma-user-meta">{currentUser?.email ?? "Sin correo"}</p>
              {currentUser?.phone && (
                <p className="ma-user-meta">{currentUser.phone}</p>
              )}
              <div className="ma-status-row" aria-label="Estado de la cuenta">
                <span className={`ma-status-pill ma-status-pill--${membershipTone}`}>
                  {membershipStatus}
                </span>
                <span className={`ma-status-pill ma-status-pill--${ftpTone}`}>{ftpStatus}</span>
              </div>
              {hasAccessWithoutSubscription && (
                <p className="ma-status-note">
                  Tu FTP sigue vigente hasta {cycleEndOrFallback}. Activa tu membresía para mantener el acceso.
                </p>
              )}
              {hasExpiredFtpAccess && (
                <p className="ma-status-note">
                  Tu acceso FTP venció {cycleEndOrFallback}. Al reactivar tu membresía recuperas acceso y cuota.
                </p>
              )}
            </div>
          </section>

          <section className="ma-control-center" aria-label="Acciones rápidas y estado">
            <div className="ma-control-head">
              <h2>Acciones rápidas</h2>
              <p>Todo lo importante de tu cuenta en un solo bloque.</p>
            </div>
            <div className="ma-control-stats">
              <article className="ma-control-stat">
                <span>Estado de membresía</span>
                <strong>{membershipStatus}</strong>
              </article>
              <article className="ma-control-stat">
                <span>{nextBillingTitle}</span>
                <strong>{nextBillingLabel}</strong>
              </article>
              <article className="ma-control-stat">
                <span>Acceso FTP</span>
                <strong>{ftpStatus}</strong>
              </article>
            </div>
            <div className="ma-control-actions">
              {hasActiveSubscription && !currentUser.isSubscriptionCancelled && (
                <Button unstyled type="button" onClick={startCancel} className="ma-btn ma-btn-danger">
                  Cancelar
                </Button>
              )}
              <Button unstyled
                type="button"
                onClick={openBillingPortal}
                disabled={portalLoading}
                className="ma-btn ma-btn-outline"
              >
                {portalLoading ? "Abriendo..." : "Actualizar método"}
              </Button>
              <Button unstyled type="button" onClick={() => void openSupportChat()} className="ma-btn ma-btn-soft">
                Soporte / Abrir chat
              </Button>
            </div>
          </section>
        </section>

        <section className="ma-grid-two ma-access-grid" aria-label="Acceso FTP y cuota">
          <section className="ma-panel ma-ftp-quick-panel" aria-label="Acceso FTP rápido">
            <div className="ma-panel-head">
              <Server size={18} />
              <h2>Acceso FTP rápido</h2>
            </div>
            {currentUser?.ftpAccount ? (
              <>
                <div className="ma-ftp-priority">
                  <span className={`ma-status-pill ma-status-pill--${ftpTone}`}>
                    {ftpStatus}
                  </span>
                  <p>{ftpPriorityMessage}</p>
                </div>
                <p className="ma-ftp-quick-note">
                  {hasFtpAccess
                    ? "Copia estas credenciales y conecta en FileZilla o Air Explorer."
                    : `Estas credenciales vencieron ${cycleEndOrFallback}. Reactiva tu membresía para volver a usarlas.`}
                </p>
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
                  <Button unstyled
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `Host: ${currentUser.ftpAccount.host}\nUsuario: ${currentUser.ftpAccount.userid}\nContraseña: ${currentUser.ftpAccount.passwd}\nPuerto: ${currentUser.ftpAccount.port}`,
                        "Acceso FTP",
                        "full_credentials",
                      )
                    }
                    className="ma-btn ma-btn-outline"
                  >
                    Copiar acceso completo
                  </Button>
                  <Button unstyled
                    type="button"
                    onClick={() => downloadXMLFile(currentUser.ftpAccount!)}
                    className="ma-btn ma-btn-soft"
                  >
                    <FileDown size={16} />
                    Descargar XML FileZilla
                  </Button>
                  <Link to="/instrucciones" className="ma-btn ma-btn-outline">
                    Ver instrucciones
                  </Link>
                  {hasFtpAccess && (
                    <Link to="/descargas" className="ma-btn ma-btn-soft">
                      Ir a mis descargas
                    </Link>
                  )}
                  {!hasFtpAccess && (
                    <Link to="/planes" className="ma-btn ma-btn-outline">
                      Reactivar membresía
                    </Link>
                  )}
                </div>
                <ol className="ma-ftp-steps" aria-label="Pasos rápidos de FTP">
                  <li>Copiar host, usuario, contraseña y puerto.</li>
                  <li>Conectar en FileZilla o Air Explorer.</li>
                  <li>Entrar a descargas y continuar tu flujo.</li>
                </ol>
              </>
            ) : (
              <div className="ma-empty-card">
                <p>
                  Activa tu membresía para generar tus accesos FTP y descargar.
                </p>
                <Link to="/planes" className="ma-btn ma-btn-outline">
                  Ver planes
                </Link>
              </div>
            )}
          </section>

          <section className="ma-panel ma-quota-panel" aria-label="Cuota de descarga">
            <div className="ma-panel-head">
              <HardDriveDownload size={18} />
              <h2>Cuota de descarga</h2>
            </div>
            <div className="ma-storage">
              {shouldShowQuota ? (
                <>
                  <div className="ma-storage-head">
                    <span>Uso del ciclo actual</span>
                    <strong>{storagePercentLabel}</strong>
                  </div>
                  <div className="ma-progress-track">
                    <div
                      className="ma-progress-fill"
                      style={{ width: `${storageFillPercent}%` }}
                    />
                  </div>
                  <p className="ma-storage-amount">
                    Usados este ciclo: {formatInt(usedGb)} GB de {formatInt(availableGb)} GB
                  </p>
                  {hasActiveSubscription && (
                    <p className="ma-storage-amount">
                      Disponibles: {formatInt(remainingRegularGb)} GB · GB extra: {formatInt(remainingExtendedGb)} GB
                    </p>
                  )}
                  <p className="ma-quota-meta">Cierre de ciclo: {cycleEndOrFallback}</p>
                  <details className="ma-storage-details">
                    <summary>¿Cómo funciona esta cuota?</summary>
                    <p>
                      La cuota de descarga es lo que puedes bajar en cada ciclo. El catálogo total es lo que puedes elegir.
                    </p>
                  </details>
                  {hasLowQuotaWarning && (
                    <section className="ma-quota-upsell" aria-label="Pocos GB disponibles">
                      <p className="ma-quota-upsell__title">Te quedan pocos GB en este ciclo.</p>
                      <p className="ma-quota-upsell__copy">
                        Tienes {formatInt(totalRemainingGb)} GB disponibles entre cuota mensual y GB extra.
                        Para no pausar descargas, elige upgrade o recarga ahora.
                      </p>
                      <div className="ma-quota-upsell__actions">
                        <Button
                          unstyled
                          type="button"
                          onClick={openUpgradePlans}
                          className="ma-btn ma-btn-outline"
                        >
                          Hacer upgrade de membresía
                        </Button>
                        <Button
                          unstyled
                          type="button"
                          onClick={() => void openPlan()}
                          className="ma-btn ma-btn-soft"
                        >
                          Comprar GB extra
                        </Button>
                      </div>
                    </section>
                  )}
                  {hasQuotaReached && (
                    <p className="ma-storage-alert">
                      {hasNoQuotaLeft
                        ? `Límite alcanzado. No puedes descargar más hasta ${cycleEndOrFallback}.`
                        : "Llegaste a 100% de tu cuota regular. Puedes seguir usando GB extra si tienes disponibles."}
                    </p>
                  )}
                  {hasActiveSubscription && !hasLowQuotaWarning && (
                    <Button unstyled type="button" onClick={() => void openPlan()} className="ma-btn ma-btn-soft">
                      Comprar extra 100 GB
                    </Button>
                  )}
                </>
              ) : (
                <div className="ma-empty-card">
                  <p>
                    No tienes cuota activa porque no hay acceso FTP vigente. Reactiva tu membresía para habilitar descargas.
                  </p>
                </div>
              )}
            </div>
          </section>
        </section>

        <section className="ma-workspace" aria-label="Opciones adicionales de tu cuenta">
          <div className="ma-workspace-head">
            <h2>Más opciones de cuenta</h2>
            <p>{activeWorkspaceHelper}</p>
          </div>
          <nav className="ma-workspace-tabs" role="tablist" aria-label="Secciones de cuenta">
            {workspaceTabs.map((tab) => {
              const isActive = activeWorkspaceTab === tab.id;
              return (
                <Button unstyled
                  key={tab.id}
                  id={`ma-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`ma-panel-${tab.id}`}
                  className={`ma-workspace-tab ${isActive ? "is-active" : ""}`}
                  onClick={() => setActiveWorkspaceTab(tab.id)}
                >
                  {tab.label}
                </Button>
              );
            })}
          </nav>

          {activeWorkspaceTab === "orders" && (
            <section
              id="ma-panel-orders"
              role="tabpanel"
              aria-labelledby="ma-tab-orders"
              className="ma-panel ma-orders-panel"
            >
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
          )}

          {activeWorkspaceTab === "payments" && (
            <section
              id="ma-panel-payments"
              role="tabpanel"
              aria-labelledby="ma-tab-payments"
              className="ma-panel ma-wallet-panel"
            >
              <div className="ma-panel-head">
                <CreditCard size={18} />
                <h2>Tarjetas</h2>
                {paymentMethods.length > 0 && (
                  <Button unstyled
                    type="button"
                    onClick={openBillingPortal}
                    disabled={portalLoading}
                    className="ma-btn ma-btn-outline ma-head-action"
                  >
                    {portalLoading ? "Abriendo…" : "Gestionar pagos y facturas"}
                  </Button>
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
                            <Button unstyled
                              type="button"
                              onClick={() => setDefaultPaymentMethod(x)}
                              className="ma-btn ma-btn-outline ma-btn-small"
                              aria-label="Usar esta tarjeta"
                            >
                              Usar esta
                            </Button>
                          )}
                          <Button unstyled
                            type="button"
                            onClick={() => deletePaymentMethod(x)}
                            className="ma-icon-btn ma-btn-delete"
                            aria-label="Eliminar tarjeta"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                      <p className="ma-card-number">•••• •••• •••• {x.card.last4}</p>
                      <p className="ma-card-date">{x.card.exp_month}/{x.card.exp_year}</p>
                    </article>
                  ))}
                  <Button unstyled
                    type="button"
                    onClick={openBillingPortal}
                    disabled={portalLoading}
                    className="ma-add-card"
                  >
                    <CreditCard size={20} />
                    <span>{portalLoading ? "Abriendo..." : "Agregar tarjeta"}</span>
                  </Button>
                </div>
              ) : (
                <div className="ma-loading-cards">
                  <Spinner size={4} width={0.4} color="var(--ma-accent)" />
                </div>
              )}
            </section>
          )}

          {activeWorkspaceTab === "email" && (
            <section
              id="ma-panel-email"
              role="tabpanel"
              aria-labelledby="ma-tab-email"
              className="ma-panel ma-comms-panel"
              aria-label="Preferencias de email"
            >
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
                  <Button unstyled
                    type="button"
                    className="ma-btn ma-btn-soft"
                    onClick={loadEmailPreferences}
                    disabled={emailPrefsSaving}
                  >
                    Reintentar
                  </Button>
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
                      disabledReason={emailPrefsSaving ? "Estamos guardando tus cambios." : undefined}
                      onChange={(next) => updateEmailPreferences({ enabled: next })}
                    />
                    <div className={`ma-pref-sublist ${emailPrefs.enabled ? "" : "is-disabled"}`}>
                      <PrefToggle
                        id="bb-email-marketing-news"
                        title="Novedades y tips"
                        description="Guías rápidas, recordatorios y mejoras del servicio."
                        checked={emailPrefs.news}
                        disabled={!emailPrefs.enabled || emailPrefsSaving}
                        disabledReason={
                          !emailPrefs.enabled
                            ? "Activa 'Promociones y novedades por email' para editar esta opción."
                            : emailPrefsSaving
                              ? "Estamos guardando tus cambios."
                              : undefined
                        }
                        onChange={(next) => updateEmailPreferences({ news: next })}
                      />
                      <PrefToggle
                        id="bb-email-marketing-offers"
                        title="Ofertas y cupones"
                        description="Descuentos, cupones personales y winback."
                        checked={emailPrefs.offers}
                        disabled={!emailPrefs.enabled || emailPrefsSaving}
                        disabledReason={
                          !emailPrefs.enabled
                            ? "Activa 'Promociones y novedades por email' para editar esta opción."
                            : emailPrefsSaving
                              ? "Estamos guardando tus cambios."
                              : undefined
                        }
                        onChange={(next) => updateEmailPreferences({ offers: next })}
                      />
                      <PrefToggle
                        id="bb-email-marketing-digest"
                        title="Digest"
                        description="Resumen periódico de novedades (si aplica)."
                        checked={emailPrefs.digest}
                        disabled={!emailPrefs.enabled || emailPrefsSaving}
                        disabledReason={
                          !emailPrefs.enabled
                            ? "Activa 'Promociones y novedades por email' para editar esta opción."
                            : emailPrefsSaving
                              ? "Estamos guardando tus cambios."
                              : undefined
                        }
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
      {stripePromise && (
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
      )}
    </div>
  );
}

function PrefToggle({
  id,
  title,
  description,
  checked,
  disabled,
  disabledReason,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  disabledReason?: string;
  onChange: (next: boolean) => void;
}) {
  const switchStateLabel = disabled ? "No editable" : checked ? "Activo" : "Inactivo";

  return (
    <label htmlFor={id} className={`ma-pref-row ${disabled ? "is-disabled" : ""} ${checked ? "is-active" : ""}`}>
      <span className="ma-pref-copy">
        <span className="ma-pref-title">{title}</span>
        <span className="ma-pref-desc">{description}</span>
        {disabled && disabledReason && (
          <span className="ma-pref-disabled-reason">No editable: {disabledReason}</span>
        )}
      </span>
      <span className="ma-pref-control">
        <span className={`ma-switch-flag ${checked ? "is-on" : "is-off"} ${disabled ? "is-disabled" : ""}`}>
          {switchStateLabel}
        </span>
        <Input
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
  copyToClipboard: (
    text: string,
    label: string,
    target?: "host" | "user" | "password" | "port" | "full_credentials",
  ) => void;
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
          <Button unstyled
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
          </Button>
        )}
        <Button unstyled
          type="button"
          onClick={() =>
            copyToClipboard(
              value,
              label,
              label === "Host"
                ? "host"
                : label === "Usuario"
                  ? "user"
                  : label === "Contraseña"
                    ? "password"
                    : "port",
            )
          }
          className="ma-icon-btn ma-ftp-icon"
          aria-label="Copiar"
        >
          <Copy size={16} />
        </Button>
        {copied && <span className="ma-copy-ok">Copiado</span>}
      </div>
    </div>
  );
}

export default MyAccount;
