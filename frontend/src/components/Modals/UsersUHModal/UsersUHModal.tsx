import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import '../Modal.scss';
import { Modal } from 'react-bootstrap';
import { RiBankCardFill, RiCloseLine, RiRefreshLine } from 'react-icons/ri';
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
  const { paymentMethods, cardLoad, getPaymentMethods, currentUser } =
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
      const suscribeMethod =
        await trpc.subscriptions.subscribeWithStripe.query(body_stripe);
      if (elements && stripe) {
        console.log(card);
        const result = await stripe.confirmCardPayment(
          suscribeMethod.clientSecret,
          card === null
            ? {
                payment_method: {
                  card: elements.getElement('card')!,
                },
              }
            : {
                payment_method: card,
              }
        );
        getPaymentMethods();
        if (result.error) {
          setLoader(false);
          setErrorMessage(result.error.message);
          setShow(true);
        } else {
          if (currentUser) {
            fbq('track', 'PagoExitoso', {
              email: currentUser.email,
              phone: currentUser.phone,
            });
          }
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
            <RiCloseLine className="icon" />
          </div>
          <div className="container">
            <div className="left">
              <RiRefreshLine className="icon" />
              <h2>¡Estamos renovando nuestro sitio!</h2>
              <p>
                Nuestro sitio está en pleno proceso de renovación para mejorar
                tu experiencia. Mientras tanto, te invitamos a unirte a nuestro
                Plan de Migración para que puedas disfrutar de beneficios
                exclusivos como:
                <ul>
                  <li>Acceso a contenido exclusivo.</li>
                  <li>Descargas ilimitadas de música y videos.</li>
                  <li>Nuevas canciones diariamente.</li>
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
                <p className="blue">Comunícate al 55224347.</p>
              </div>
            </div>
            <div className="right">
              <div className="top-side">
                <h3>PLAN DE MIGRACIÓN</h3>
                <h3 className="blue">
                  <span>$199 </span> MXN
                </h3>
                <h3>500 GB al mes</h3>
              </div>
              <form className="checkout-form" onSubmit={onSubmit}>
                <div className="c-row">
                  {cardLoad ? (
                    <Spinner size={2} width={0.2} color="#00e2f7" />
                  ) : (
                    <>
                      {card === null ? (
                        <div
                          className="icon-contain"
                          onClick={() => setCard('')}
                        >
                          <RiBankCardFill className="icon color-blue" />
                          <p>Seleccionar tarjeta</p>
                        </div>
                      ) : (
                        <div
                          className="icon-contain"
                          onClick={() => setCard(null)}
                        >
                          <RiBankCardFill className="icon color-blue" />
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
                      style={{ color: '#fff' }}
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
                    <Spinner size={4} width={0.4} color="#00e2f7" />
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
