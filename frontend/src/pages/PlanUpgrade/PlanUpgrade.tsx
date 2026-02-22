import React, { useEffect, useMemo, useState } from "react";
import trpc from "../../api";
import { IPlans } from "interfaces/Plans";
import { Spinner } from "../../components/Spinner/Spinner";
import PlanCard from "../../components/PlanCard/PlanCard";
import { Link, useNavigate } from "react-router-dom";
import { useUserContext } from "../../contexts/UserContext";
import { Button, EmptyState, Alert } from "../../components/ui";
import { ArrowRight, RefreshCw, Shield, Sparkles, TrendingUp, HardDriveDownload } from "src/icons";
import "./PlanUpgrade.scss";

export const PlanUpgrade = () => {
  const { currentUser } = useUserContext();
  const [plans, setPlans] = useState<IPlans[]>([]);
  const [loader, setLoader] = useState<boolean>(true);
  const [currentPlan, setCurrentPlan] = useState<IPlans | null>(null);
  const [loadError, setLoadError] = useState<string>("");
  const navigate = useNavigate();

  const toPlanGb = (value: unknown): number => {
    if (typeof value === "bigint") return Number(value);
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  const formatPlanQuota = (value: unknown): string => {
    const gb = toPlanGb(value);
    if (gb >= 1000) {
      const tb = gb / 1000;
      const hasDecimal = Math.round(tb) !== tb;
      return `${hasDecimal ? tb.toFixed(1) : tb.toFixed(0)} TB/mes`;
    }
    return `${Math.trunc(gb)} GB/mes`;
  };

  const formatPlanPrice = (price: unknown, currency: unknown): string => {
    const amount = Number(price ?? 0);
    const code = String(currency ?? "MXN").toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0) return `${code} $0`;
    try {
      return new Intl.NumberFormat(code === "USD" ? "en-US" : "es-MX", {
        style: "currency",
        currency: code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${code} $${amount.toFixed(2)}`;
    }
  };

  const toBigInt = (value: unknown): bigint => {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && Number.isFinite(value))
      return BigInt(Math.trunc(value));
    if (typeof value === "string" && value.trim()) {
      try {
        return BigInt(value.trim());
      } catch {
        return BigInt(0);
      }
    }
    return BigInt(0);
  };

  const mapPlan = (raw: any): IPlans | null => {
    if (!raw || typeof raw !== "object") return null;
    const id = Number(raw.id);
    if (!Number.isFinite(id) || id <= 0) return null;
    return {
      activated: Number(raw.activated ?? 0),
      audio_ilimitado: null,
      conekta_plan_id: null,
      conekta_plan_id_test: null,
      description: String(raw.description ?? ""),
      duration: String(raw.duration ?? ""),
      gigas: toBigInt(raw.gigas),
      homedir: String(raw.homedir ?? ""),
      id,
      ilimitado_activo: null,
      ilimitado_dias: null,
      karaoke_ilimitado: null,
      moneda: String(raw.moneda ?? ""),
      name: String(raw.name ?? ""),
      price: String(raw.price ?? ""),
      stripe_prod_id: String(raw.stripe_prod_id ?? ""),
      stripe_prod_id_test: String(raw.stripe_prod_id_test ?? ""),
      paypal_plan_id: String(raw.paypal_plan_id ?? ""),
      paypal_plan_id_test: String(raw.paypal_plan_id_test ?? ""),
      tokens: null,
      tokens_karaoke: null,
      tokens_video: null,
      video_ilimitado: null,
      vip_activo: null,
    };
  };

  const loadUpgradeOptions = async () => {
    setLoader(true);
    setLoadError("");
    try {
      const response: any = await trpc.plans.getUpgradeOptions.query();
      const nextCurrentPlan = mapPlan(response?.currentPlan);
      const upgradesRaw = Array.isArray(response?.upgradePlans)
        ? response.upgradePlans
        : [];
      const nextPlans = upgradesRaw
        .map((planRaw: any) => mapPlan(planRaw))
        .filter((plan: IPlans | null): plan is IPlans => Boolean(plan));

      setCurrentPlan(nextCurrentPlan);
      setPlans(nextPlans);
    } catch {
      setCurrentPlan(null);
      setPlans([]);
      setLoadError(
        "No pudimos cargar las opciones para actualizar tu plan. Revisa tu conexión e intenta de nuevo.",
      );
    } finally {
      setLoader(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      void loadUpgradeOptions();
    }
  }, [currentUser]);

  const sortedPlans = useMemo(() => {
    const list = [...plans];
    return list.sort((a, b) => {
      const byQuota = toPlanGb(a.gigas) - toPlanGb(b.gigas);
      if (byQuota !== 0) return byQuota;
      const byPrice = Number(a.price ?? 0) - Number(b.price ?? 0);
      if (byPrice !== 0) return byPrice;
      return a.id - b.id;
    });
  }, [plans]);

  const featuredPlan = useMemo(() => {
    if (sortedPlans.length === 0) return null;
    const withTwoTb = sortedPlans.find((plan) => toPlanGb(plan.gigas) >= 2000);
    if (withTwoTb) return withTwoTb;
    return sortedPlans[sortedPlans.length - 1] ?? null;
  }, [sortedPlans]);

  const otherUpgradePlans = useMemo(() => {
    if (!featuredPlan) return sortedPlans;
    return sortedPlans.filter((plan) => plan.id !== featuredPlan.id);
  }, [featuredPlan, sortedPlans]);

  if (loader) {
    return (
      <div
        className="global-loader"
        style={{
          height: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <h1 className="sr-only">Actualizar plan</h1>
        <Spinner size={5} width={0.5} color="var(--app-accent)" />
      </div>
    );
  }
  return (
    <div className="plan-upgrade plans-main-container bb-app-page">
      <section className="plan-upgrade__hero" aria-label="Actualizar membresía">
        <div className="plan-upgrade__heroCopy">
          <span className="plan-upgrade__kicker">Upgrade inteligente</span>
          <h1>Actualizar plan</h1>
          <p>
            Escala tu membresía cuando ya estás descargando al límite. Más cuota mensual, misma
            experiencia y activación inmediata.
          </p>
        </div>
        <div className="plan-upgrade__heroActions">
          <Link to="/micuenta" className="plan-upgrade__ghostLink">
            <HardDriveDownload size={16} aria-hidden />
            Comprar GB extra
          </Link>
          <Button
            variant="primary"
            leftIcon={<TrendingUp size={18} />}
            onClick={() => {
              const target = document.getElementById("upgrade-options");
              target?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            Ver upgrades
          </Button>
        </div>
      </section>

      {loadError ? (
        <div className="mb-6">
          <Alert tone="danger" title="No se pudo cargar">
            {loadError}
          </Alert>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant="secondary"
              leftIcon={<RefreshCw size={18} />}
              onClick={() => void loadUpgradeOptions()}
            >
              Reintentar
            </Button>
            <Button
              variant="primary"
              leftIcon={<ArrowRight size={18} />}
              onClick={() => navigate("/planes")}
            >
              Ver planes
            </Button>
          </div>
        </div>
      ) : null}

      {!loadError && !currentPlan ? (
        <EmptyState
          icon={<Shield size={22} />}
          title="Aún no tienes un plan activo para actualizar"
          description="Primero elige un plan. En cuanto tu compra se active, aquí verás las opciones para subir de nivel."
          action={
            <Button
              variant="primary"
              leftIcon={<ArrowRight size={18} />}
              onClick={() => navigate("/planes")}
            >
              Ir a Planes
            </Button>
          }
        />
      ) : null}

      {currentPlan && (
        <section className="plan-upgrade__current" aria-label="Plan actual">
          <div className="plan-upgrade__sectionHead">
            <h2>Tu plan actual</h2>
            <p>
              {currentPlan.name} · {formatPlanQuota(currentPlan.gigas)} ·{" "}
              {formatPlanPrice(currentPlan.price, currentPlan.moneda)}
            </p>
          </div>
          <PlanCard
            currentPlan={true}
            plan={currentPlan}
            getCurrentPlan={() => {}}
            userEmail={currentUser?.email}
            userPhone={currentUser?.phone}
          />
        </section>
      )}

      {currentPlan && featuredPlan && (
        <section className="plan-upgrade__featured" aria-label="Plan recomendado">
          <div className="plan-upgrade__sectionHead">
            <h2>
              <Sparkles size={18} aria-hidden />
              Recomendado para alto consumo
            </h2>
            <p>
              {featuredPlan.name} · {formatPlanQuota(featuredPlan.gigas)} ·{" "}
              {formatPlanPrice(featuredPlan.price, featuredPlan.moneda)}
            </p>
          </div>
          <PlanCard
            plan={featuredPlan}
            getCurrentPlan={loadUpgradeOptions}
            userEmail={currentUser?.email}
            userPhone={currentUser?.phone}
          />
        </section>
      )}

      {currentPlan && otherUpgradePlans.length > 0 && (
        <section
          id="upgrade-options"
          className="plan-upgrade__list"
          aria-label="Más opciones de upgrade"
        >
          <div className="plan-upgrade__sectionHead">
            <h2>Más opciones de upgrade</h2>
            <p>Elige la cuota que mejor se adapta a tu ritmo de descarga mensual.</p>
          </div>
          {otherUpgradePlans.map((plan: IPlans, index) => (
            <PlanCard
              plan={plan}
              key={`plan_${plan.id}_${index}`}
              getCurrentPlan={loadUpgradeOptions}
              userEmail={currentUser?.email}
              userPhone={currentUser?.phone}
            />
          ))}
        </section>
      )}

      {currentPlan && sortedPlans.length === 0 && !loadError && (
        <section className="plan-upgrade__empty">
          <Alert tone="info" title="Aún no hay upgrades disponibles para tu perfil">
            Cuando habilitemos una opción superior compatible con tu método de pago, aparecerá aquí.
          </Alert>
        </section>
      )}
    </div>
  );
};
