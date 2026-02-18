import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import '../Modal.scss';
import { Modal } from 'react-bootstrap';
import { CreditCard, RefreshCw, X } from "src/icons";
import { IPaymentMethod } from 'interfaces/User';
import { useState } from 'react';
import { useUserContext } from '../../../contexts/UserContext';
import { Spinner } from '../../../components/Spinner/Spinner';
import trpc from '../../../api';
import { useCookies } from 'react-cookie';
import { SuccessModal } from '../SuccessModal/SuccessModal';
import { ErrorModal } from '../ErrorModal/ErrorModal';

interface IUsersUHModal {
  showModal: boolean;
  onHideModal: () => void;
}

export function UsersUHModal(props: IUsersUHModal) {
  const { showModal, onHideModal } = props;
  const [show, setShow] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<any>('');
  const [card, setCard] = useState<any>(null);
  const { paymentMethods, cardLoad, startUser } =
    useUserContext();
  const [loader, setLoader] = useState<boolean>(false);
  const [cookies] = useCookies(['_fbp']);
  const stripe = useStripe();
  const elements = useElements();

  const closeError = () => {
    setShow(false);
  };
  const closeSuccess = () => {
    setShowSuccess(false);
    onHideModal();
    startUser();
  };

  const suscribetext = async () => {
    let body_stripe = {
      planId: 41,
      coupon: '',
      fbp: cookies._fbp,
      url: window.location.href,
    };
    setLoader(true);
    try {
      if (elements && stripe) {
        const paymentMethod = await stripe.createPaymentMethod({
          type: 'card',
          card: elements.getElement(CardElement)!,
        });

        if (paymentMethod.paymentMethod?.id) {
          await trpc.subscriptions.subscribeWithStripe.query({
            ...body_stripe,
            paymentMethod: paymentMethod.paymentMethod.id,
          });
          setShowSuccess(true);
          onHideModal();
          setLoader(false);
        }
      }
    } catch (error: any) {
      setLoader(false);
      setShow(true);
      setErrorMessage(error.message);
    }
  };
  const onSubmit = async (e: any) => {
    e.preventDefault();
    suscribetext();
  };

  return (
    <>
      <Modal show={showModal} centered size="xl">
        <div className="modal-UHREMIX">
          <div className="top-side">
            <X className="icon" onClick={onHideModal} aria-label="Cerrar" />
          </div>
          <div className="container">
            <div className="left">
              <RefreshCw className="icon" aria-hidden />
              <h2>¡Tranquil@! No te preocupes, no vamos a cobrarte nada.</h2>
              <p>
                Solo queremos asegurarnos de ponerte al corriente con el nuevo
                plan. Por ejemplo, si tu suscripción actual vence en 10 días,
                esta misma fecha se mantendrá en el nuevo sistema. Nos
                encargaremos de que sigas disfrutando de tu experiencia sin
                interrupciones. ¡Estamos aquí para ayudarte!
              </p>
              <p>
                Nuestro sitio está en pleno proceso de renovación para mejorar
                tu experiencia. Mientras tanto, te invitamos a unirte a nuestro
                Plan de Migración para que puedas disfrutar de beneficios
                exclusivos como:
                <ul>
                  <li>Acceso a contenido exclusivo.</li>
                  <li>Cuota de descarga: 500 GB/mes.</li>
                  <li>Actualizaciones: semanales (nuevos packs).</li>
                  <li>Listas de reproducción personalizadas.</li>
                  <li>Cancelación sin compromiso.</li>
                </ul>
              </p>
              <div className="div-text">
                <h3>Aún estás a tiempo.</h3>
                <h3 className="blue">¡Contrata tu plan hoy mismo!</h3>
              </div>
              <div className="div-bottom">
                <p>¿Todavía tienes dudas?</p>
                <span className="blue">Te ayudamos desde tu panel de cuenta</span>
              </div>
            </div>
            <div className="right">
              <div className="top-side">
                <h3>PLAN DE MIGRACIÓN</h3>
                <h3 className="blue">
                  <span>$199 </span> MXN
                </h3>
                <h3>Cuota de descarga: 500 GB/mes</h3>
              </div>
              <form className="checkout-form" onSubmit={onSubmit}>
                <div className="c-row">
                  {cardLoad ? (
                    <Spinner size={2} width={0.2} color="var(--app-accent)" />
                  ) : (
                    <>
                      {card === null ? (
                        <div
                          className="icon-contain"
                          onClick={() => setCard('')}
                        >
                          <CreditCard className="icon color-blue" aria-hidden />
                          <p>Seleccionar tarjeta</p>
                        </div>
                      ) : (
                        <div
                          className="icon-contain"
                          onClick={() => setCard(null)}
                        >
                          <CreditCard className="icon color-blue" aria-hidden />
                          <p>Agregar nueva tarjeta</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="c-row">
                  {card === null ? (
                    <CardElement
                      className="card-input"
                      options={{ hidePostalCode: true }}
                    />
                  ) : (
                    <select
                      onChange={(e: any) => setCard(e.target.value)}
                      defaultValue={''}
                      style={{ color: 'var(--app-text-heading)' }}
                    >
                      <option disabled value={''}>
                        Seleccione una tarjeta
                      </option>
                      {paymentMethods.map(
                        (card: IPaymentMethod, idx: number) => {
                          return (
                            <option value={card.id} key={'cards' + idx}>
                              {card.card.brand} termina en {card.card.last4}
                            </option>
                          );
                        }
                      )}
                    </select>
                  )}
                </div>
                <div className="div-bottom">
                  {loader ? (
                    <Spinner size={4} width={0.4} color="var(--app-accent)" />
                  ) : (
                    <button className="btn">CONTRATAR PLAN AHORA</button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </Modal>
      <ErrorModal show={show} onHide={closeError} message={errorMessage} />
      <SuccessModal
        show={showSuccess}
        onHide={closeSuccess}
        message="Se ha realizado el pago exitosamente del plan de migración."
        title="Pago exitoso!"
      />
    </>
  );
}
