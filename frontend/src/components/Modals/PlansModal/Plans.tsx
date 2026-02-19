import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './Plans.scss';
import { Modal } from "src/components/ui";
import trpc from "../../../api";
import { XCircle } from "src/icons";
import { IGBPlans } from '../../../interfaces/Plans';
import { useUserContext } from "../../../contexts/UserContext";
import { IPaymentMethod } from 'interfaces/User';
import { Spinner } from '../../../components/Spinner/Spinner';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Button, Select } from "src/components/ui";
interface IPlan {
  show: boolean;
  onHide: () => void;
  /** Copy opcional (ej. cuando se abre al intentar descargar sin GB). */
  intro?: string;
  dataModals: {
    setShowError: any;
    setShowSuccess: any;
    setSuccessMessage: any;
    setErrorMessage: any;
    setSuccessTitle: any;
  };
}

export function PlansModal(props: IPlan) {
  const { startUser, paymentMethods } = useUserContext();
  const { show, onHide, dataModals, intro } = props;
  const [selectPlan, setSelectPlan] = useState<IGBPlans | null>(null);
  const stripe: any = useStripe();
  const elements = useElements();
  const [plans, setPlans] = useState<IGBPlans[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState<string>('new');
  const [loader, setLoader] = useState(false);
  const { setShowError, setShowSuccess, setSuccessMessage, setErrorMessage, setSuccessTitle } = dataModals;

  const formatMoney = useCallback((amount: number | null, currency: string | null): string => {
    if (amount == null || !Number.isFinite(amount)) return '';
    const c = (currency || 'MXN').toUpperCase();
    try {
      return new Intl.NumberFormat(c === 'USD' ? 'en-US' : 'es-MX', {
        style: 'currency',
        currency: c,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `$${amount.toFixed(2)} ${c}`;
    }
  }, []);

  const normalizePrice = (value: unknown): number | null => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const sortedPlans = useMemo(() => {
    const list = Array.isArray(plans) ? [...plans] : [];
    return list.sort((a, b) => Number(a.amount ?? 0) - Number(b.amount ?? 0));
  }, [plans]);

  const bestValuePlanId = useMemo(() => {
    let bestId: number | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const p of sortedPlans) {
      const amount = Number(p.amount ?? 0);
      const price = normalizePrice(p.price);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      if (price == null || !Number.isFinite(price) || price <= 0) continue;
      const perGb = price / amount;
      if (perGb < bestScore) {
        bestScore = perGb;
        bestId = p.id;
      }
    }
    return bestId;
  }, [sortedPlans]);

  const savedCards = Array.isArray(paymentMethods) ? paymentMethods : [];

  const choosePlan = (val: IGBPlans) => {
    setSelectPlan(val);
    // Default to the first saved card (fast path) or "new" if none exist.
    const firstPm = savedCards?.[0]?.id;
    setPaymentMethodId(firstPm ? String(firstPm) : 'new');
  };

  const seePlans = () => {
    setSelectPlan(null);
    setPaymentMethodId('new');
  };

  const close = () => {
    setLoader(false);
    setSelectPlan(null);
    setPaymentMethodId('new');
    onHide();
  };

  const getPlans = async () => {
    try {
      const result: any = await trpc.products.getProducts.query();
      setPlans(Array.isArray(result) ? (result as IGBPlans[]) : []);
    } catch {
      setPlans([]);
    }
  };

  const isNewCard = paymentMethodId === 'new';

  const selectedPlanLabel = useMemo(() => {
    if (!selectPlan) return '';
    const amount = Number(selectPlan.amount);
    const amountLabel = Number.isFinite(amount) ? `${amount} GB` : `${selectPlan.amount} GB`;
    const price = normalizePrice(selectPlan.price);
    const priceLabel = formatMoney(price, selectPlan.moneda ?? 'MXN');
    return `${selectPlan.name} · ${amountLabel}${priceLabel ? ` · ${priceLabel}` : ''}`;
  }, [formatMoney, selectPlan]);

  const buyPlan = async () => {
    if (!selectPlan) return;
    if (!stripe) return;
    if (!elements && isNewCard) return;

    setLoader(true);
    try {
      const body: any = {
        productId: selectPlan.id,
        service: 'Stripe',
        ...(isNewCard ? {} : { paymentMethod: paymentMethodId }),
      };

      const result = await trpc.products.buyMoreGB.mutate(body);
      const clientSecret = result?.clientSecret;
      if (!clientSecret) {
        throw new Error('No se pudo preparar el pago. Intenta de nuevo.');
      }

      const confirmPayload = isNewCard
        ? (() => {
            const cardElement = elements?.getElement(CardElement);
            if (!cardElement) {
              throw new Error('Ingresa los datos de tu tarjeta para continuar.');
            }
            return {
              payment_method: {
                card: cardElement,
              },
            };
          })()
        : {
            payment_method: paymentMethodId,
          };

      const confirm = await stripe.confirmCardPayment(clientSecret, confirmPayload);
      if (confirm?.error) {
        throw new Error(confirm.error.message || 'No se pudo completar el pago.');
      }

      close();
      setShowSuccess(true);
      setSuccessTitle('Pago exitoso');
      setSuccessMessage(result?.message || 'Tu recarga se está aplicando. En unos momentos verás el saldo actualizado.');
      startUser();
    } catch (e: any) {
      setErrorMessage(e?.message ?? e);
      setShowError(true);
    } finally {
      setLoader(false);
    }
  };

  useEffect(() => {
    getPlans();
  }, []);

  const modalIntro = intro?.trim()
    ? intro
    : '¿Te quedaste sin GB? Recarga GB extra para seguir descargando al momento.';

  return (
    <Modal show={show} onHide={close} centered>
      <div className="modal-container modal-container-plans bb-plans-modal">
        <header className="bb-plans-modal__header">
          <div className="bb-plans-modal__headCopy">
            <span className="bb-plans-modal__kicker">Recarga</span>
            <h2 className="bb-plans-modal__title">Recargar GB extra</h2>
          </div>
          <Button unstyled type="button" className="bb-plans-modal__close" onClick={close} aria-label="Cerrar">
            <XCircle className="bb-plans-modal__closeIcon" aria-hidden />
          </Button>
        </header>

        {selectPlan === null ? (
          <div className="bb-plans-modal__step" aria-label="Elige un paquete">
            <p className="bb-plans-modal__intro">{modalIntro}</p>
            {sortedPlans.length > 0 ? (
              <div className="bb-plans-modal__grid" role="list" aria-label="Paquetes de GB extra">
                {sortedPlans.map((x) => {
                  const price = normalizePrice(x.price);
                  const currency = (x.moneda ?? 'MXN').toUpperCase();
                  const amount = Number(x.amount);
                  const amountLabel = Number.isFinite(amount) ? `${amount} GB` : `${x.amount} GB`;
                  const priceLabel = formatMoney(price, currency);
                  const isBestValue = bestValuePlanId != null && x.id === bestValuePlanId;
                  const perGb =
                    price != null && Number.isFinite(amount) && amount > 0
                      ? price / amount
                      : null;
                  const perGbLabel =
                    perGb != null && Number.isFinite(perGb)
                      ? `~${formatMoney(perGb, currency)}/GB`
                      : null;

                  return (
                    <Button unstyled
                      key={x.id}
                      type="button"
                      className={`bb-gb-card ${isBestValue ? "is-best" : ""}`}
                      onClick={() => choosePlan(x)}
                      role="listitem"
                      aria-label={`${x.name}, ${amountLabel}${priceLabel ? `, ${priceLabel}` : ""}`}
                    >
                      <div className="bb-gb-card__top">
                        <span className="bb-gb-card__name">{x.name}</span>
                        {isBestValue && <span className="bb-gb-card__badge">Mejor valor</span>}
                      </div>
                      <div className="bb-gb-card__mid">
                        <strong className="bb-gb-card__amount">{amountLabel}</strong>
                        {priceLabel && <span className="bb-gb-card__price">{priceLabel}</span>}
                      </div>
                      <div className="bb-gb-card__sub">
                        <span>Se aplica en 1 a 2 minutos</span>
                        {perGbLabel && <span className="bb-gb-card__pergb">{perGbLabel}</span>}
                      </div>
                    </Button>
                  );
                })}
              </div>
            ) : (
              <div className="bb-plans-modal__empty" role="status" aria-live="polite">
                <p>No hay paquetes disponibles en este momento. Intenta más tarde.</p>
              </div>
            )}
            <p className="bb-plans-modal__foot">Pago seguro con Stripe. Sin cambiar tu membresía.</p>
          </div>
        ) : (
          <div className="bb-plans-modal__step" aria-label="Pagar recarga">
            <Button unstyled type="button" className="bb-plans-modal__back" onClick={seePlans}>
              Volver
            </Button>

            <div className="bb-plans-modal__summary" role="note" aria-label="Paquete seleccionado">
              <span>Paquete seleccionado</span>
              <strong>{selectedPlanLabel}</strong>
            </div>

            {savedCards.length > 0 && (
              <div className="bb-plans-modal__field">
                <label className="bb-plans-modal__label" htmlFor="bb-gb-payment-method">
                  Método de pago
                </label>
                <Select
                  id="bb-gb-payment-method"
                  onChange={(e: any) => setPaymentMethodId(String(e.target.value))}
                  value={paymentMethodId}
                >
                  <option value={'new'}>Nueva tarjeta</option>
                  {savedCards.map((card: IPaymentMethod) => (
                    <option value={card.id} key={card.id}>
                      {card.card.brand} termina en {card.card.last4}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {(savedCards.length === 0 || isNewCard) && (
              <div className="bb-plans-modal__field">
                <p className="bb-plans-modal__label">Nueva tarjeta</p>
                <div className="bb-plans-modal__cardInput">
                  <CardElement className="card-input" options={{ hidePostalCode: true }} />
                </div>
              </div>
            )}

            <div className="bb-plans-modal__ctaRow">
              <Button unstyled
                type="button"
                className="bb-plans-modal__cta"
                onClick={buyPlan}
                disabled={loader}
                aria-busy={loader || undefined}
              >
                {loader ? (
                  <span className="bb-plans-modal__ctaSpinner">
                    <Spinner size={3.2} width={0.35} color="var(--app-btn-text)" />
                  </span>
                ) : (
                  "Confirmar recarga"
                )}
              </Button>
              <p className="bb-plans-modal__ctaHint">El saldo se refleja en tu cuenta en 1 a 2 minutos.</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
