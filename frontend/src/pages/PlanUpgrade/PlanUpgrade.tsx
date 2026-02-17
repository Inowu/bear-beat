import React, { useEffect, useState } from "react";
import trpc from "../../api";
import { IPlans } from "interfaces/Plans";
import { Spinner } from "../../components/Spinner/Spinner";
import PlanCard from "../../components/PlanCard/PlanCard";
import { useNavigate } from "react-router-dom";
import { useUserContext } from "../../contexts/UserContext";
import { Button, EmptyState, Alert } from "../../components/ui";
import { ArrowRight, RefreshCw, Shield } from "src/icons";

export const PlanUpgrade = () => {
  const { currentUser } = useUserContext();
  const [plans, setPlans] = useState<IPlans[]>([]);
  const [loader, setLoader] = useState<boolean>(true);
  const [currentPlan, setCurrentPlan] = useState<IPlans | null>(null);
  const [loadError, setLoadError] = useState<string>("");
  const navigate = useNavigate();

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
    <div className="plans-main-container bb-app-page">
      <header className="mb-6">
        <h1 className="text-text-main font-bold">Actualizar plan</h1>
        <p className="text-text-muted mt-2">
          Sube de nivel cuando lo necesites. Si no tienes un plan activo, ve a
          Planes.
        </p>
      </header>

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
        <PlanCard
          currentPlan={true}
          plan={currentPlan}
          getCurrentPlan={() => {}}
          userEmail={currentUser?.email}
          userPhone={currentUser?.phone}
        />
      )}
      {plans.map((plan: IPlans, index) => {
        return (
          <PlanCard
            plan={plan}
            key={`plan_${plan.id}_${index}`}
            getCurrentPlan={loadUpgradeOptions}
            userEmail={currentUser?.email}
            userPhone={currentUser?.phone}
          />
        );
      })}
    </div>
  );
};
