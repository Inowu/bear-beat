import React, { useEffect, useState } from "react";
import trpc from "../../api";
import { IPlans } from "interfaces/Plans";
import { Spinner } from "../../components/Spinner/Spinner";
import PlanCard from "../../components/PlanCard/PlanCard";
import { useNavigate } from "react-router-dom";
import { useUserContext } from "../../contexts/UserContext";
import { Button, EmptyState, Alert } from "../../components/ui";
import { ArrowRight, RefreshCw, Shield } from "lucide-react";

export const PlanUpgrade = () => {
  const { currentUser } = useUserContext();
  const [plans, setPlans] = useState<IPlans[]>([]);
  const [loader, setLoader] = useState<boolean>(true);
  const [currentPlan, setCurrentPlan] = useState<IPlans | null>(null);
  const [loadError, setLoadError] = useState<string>("");
  const navigate = useNavigate();

  const toBigInt = (value: unknown): bigint => {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
    if (typeof value === "string" && value.trim()) {
      try {
        return BigInt(value.trim());
      } catch {
        return BigInt(0);
      }
    }
    return BigInt(0);
  };

  const getPlans = async (
    plan_id: number,
    stripe: string | null,
    quotaBytes: bigint,
    product_id: string | null,
    moneda: string
  ) => {
    const gbSpend = quotaBytes / BigInt(1000000000);
    try {
      if (stripe !== null) {
        const body = {
          where: {
            activated: 1,
            paypal_plan_id: null,
            moneda: moneda,
            NOT: {
              id: plan_id,
            },
          },
        };
        const fetchPlans: any = await trpc.plans.findManyPlans.query(body);
        const filtered: any[] = (fetchPlans ?? []).filter((p: any) => toBigInt(p?.gigas) > gbSpend);
        setPlans(filtered);
      } else {
        if (product_id === null) {
          return;
        }
        const body = {
          where: {
            activated: 1,
            stripe_prod_id: null,
            moneda: moneda,
            // paypal_product_id: product_id,
            NOT: {
              id: plan_id,
            },
          },
        };
        const fetchPlans: any = await trpc.plans.findManyPlans.query(body);
        const paypalplans = (fetchPlans ?? []).filter(
          (plan: any) => plan.paypal_product_id === product_id
        );
        const filteredPaypal = paypalplans.filter((p: any) => toBigInt(p?.gigas) > gbSpend);
        setPlans(filteredPaypal);
      }
    } catch (error) {
      setPlans([]);
      setLoadError("No pudimos cargar los planes disponibles. Intenta de nuevo.");
    } finally {
      setLoader(false);
    }
  };
  const getCurrentPlan = async () => {
    setLoader(true);
    setLoadError("");
    try {
      if (currentUser !== null) {
        let body: any = {
          isExtended: currentUser.extendedFtpAccount,
        };
        const tempPlan = await trpc.auth.getCurrentSubscriptionPlan.query();
        if (!tempPlan) {
          setCurrentPlan(null);
          setPlans([]);
          setLoader(false);
          return;
        }

        const quota: any = await trpc.ftp.quota.query(body);
        const constructedPlan: IPlans = {
          activated: tempPlan.activated,
          audio_ilimitado: null,
          conekta_plan_id: null,
          conekta_plan_id_test: null,
          description: tempPlan.description,
          duration: tempPlan.duration,
          gigas: tempPlan.gigas,
          homedir: tempPlan.homedir,
          id: tempPlan.id,
          ilimitado_activo: null,
          ilimitado_dias: null,
          karaoke_ilimitado: null,
          moneda: tempPlan.moneda,
          name: tempPlan.name,
          price: tempPlan.price.toString(),
          stripe_prod_id: tempPlan.stripe_prod_id!,
          stripe_prod_id_test: tempPlan.stripe_prod_id_test!,
          paypal_plan_id: tempPlan.paypal_plan_id!,
          paypal_plan_id_test: tempPlan.paypal_plan_id_test!,
          tokens: null,
          tokens_karaoke: null,
          tokens_video: null,
          video_ilimitado: null,
          vip_activo: null,
        }
        getPlans(
          tempPlan.id,
          tempPlan.stripe_prod_id ? tempPlan.stripe_prod_id : tempPlan.stripe_prod_id_test,
          toBigInt(quota?.regular?.used?.toString?.() ?? "0"),
          tempPlan.paypal_product_id,
          tempPlan.moneda
        );
        setCurrentPlan(constructedPlan);
      }
    } catch (error: any) {
      setCurrentPlan(null);
      setPlans([]);
      setLoadError("No pudimos cargar tu plan actual. Revisa tu conexión e intenta de nuevo.");
      setLoader(false);
    }
  };
  useEffect(() => {
    if (currentUser) {
      getCurrentPlan();
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
        <h1 className="visually-hidden">Actualizar plan</h1>
        <Spinner size={5} width={0.5} color="var(--app-accent)" />
      </div>
    );
  }
  return (
    <div className="plans-main-container">
      <header className="mb-6">
        <h1 className="text-text-main font-bold">Actualizar plan</h1>
        <p className="text-text-muted mt-2">
          Sube de nivel cuando lo necesites. Si no tienes un plan activo, ve a Planes.
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
              onClick={() => void getCurrentPlan()}
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
          getCurrentPlan={() => { }}
          userEmail={currentUser?.email}
          userPhone={currentUser?.phone}
        />
      )}
      {plans.map((plan: IPlans, index) => {
        return (
          <PlanCard
            plan={plan}
            key={"plan_" + index}
            getCurrentPlan={getCurrentPlan}
            userEmail={currentUser?.email}
            userPhone={currentUser?.phone}
          />
        );
      })}
    </div>
  );
};
