import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './Plans.scss';
import { Modal } from 'react-bootstrap';
import trpc from "../../../api";
import { XCircle } from "src/icons";
import { IGBPlans } from '../../../interfaces/Plans';
import { useUserContext } from "../../../contexts/UserContext";
import { IPaymentMethod } from 'interfaces/User';
import { Spinner } from '../../../components/Spinner/Spinner';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
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

  const choosePlan = (val: IGBPlans) => {
    setSelectPlan(val);
    // Default to the first saved card (fast path) or "new" if none exist.
    const firstPm = paymentMethods?.[0]?.id;
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

  return (
    <Modal show={show} onHide={close} centered>
      <div className='modal-container success-modal modal-container-plans'>
        <div className='header'>
          <p className='title'>Recargar GB extra</p>
          <XCircle className='icon' onClick={close} aria-label="Cerrar" />
        </div>
        {
          selectPlan === null ?
            <div className='bottom'>
              <p className='content'>
                {intro?.trim()
                  ? intro
                  : '¿Te quedaste sin GB? Recarga GB extra para seguir descargando al momento.'}
              </p>
              <div className='button-container-2' style={{ flexDirection: 'column' }}>
                {
                  plans.map((x: IGBPlans, index: number) => {
                    const price = normalizePrice(x.price);
                    const currency = (x.moneda ?? 'MXN').toUpperCase();
                    const amount = Number(x.amount);
                    const amountLabel = Number.isFinite(amount) ? `${amount} GB` : `${x.amount} GB`;
                    const priceLabel = formatMoney(price, currency);
                    return (
                      <button className='btn-option-5' onClick={() => choosePlan(x)} key={"buttons_pay_" + index}>
                        {x.name} · {amountLabel}{priceLabel ? ` · ${priceLabel}` : ''}
                      </button>
                    )
                  })
                }
              </div>
            </div> :
            <div className='bottom'>
              <p className='go-back' onClick={seePlans}>Regresar</p>
              <p className='title'>{selectedPlanLabel}</p>
              {paymentMethods.length > 0 && (
                <>
                  <p className='title'>Método de pago</p>
                  <select
                    onChange={(e: any) => setPaymentMethodId(String(e.target.value))}
                    value={paymentMethodId}
                  >
                    <option value={'new'}>Nueva tarjeta</option>
                    {paymentMethods.map((card: IPaymentMethod, idx: number) => (
                      <option value={card.id} key={"cards" + idx}>
                        {card.card.brand} termina en {card.card.last4}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {(paymentMethods.length === 0 || isNewCard) && (
                <>
                  <p className='title'>Nueva tarjeta</p>
                  <CardElement
                    className='card-input'
                    options={{ hidePostalCode: true }}
                  />
                </>
              )}
              <p className='content' style={{ marginTop: 10 }}>
                El saldo se refleja en tu cuenta en 1 a 2 minutos.
              </p>
              <div className='button-container-2'>
                {
                  loader ?
                    <Spinner size={4} width={0.4} color="var(--app-accent)" />
                    :
                    <button className='btn-success' onClick={buyPlan}>
                      Comprar
                    </button>
                }

              </div>
            </div>
        }
      </div>
    </Modal>
  )
}
