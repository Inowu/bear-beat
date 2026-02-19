import { useState } from 'react';
import { Modal } from "src/components/ui";
import { XCircle } from "src/icons";
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import './../Modal.scss';
import trpc from '../../../api';
import { Spinner } from '../../../components/Spinner/Spinner';
import { Button } from "src/components/ui";
interface IError {
  show: boolean;
  onHide: any;
  title: string;
  message?: string;
}

export function PaymentMethodModal(props: IError) {
  const { show, onHide, title, message } = props;
  const stripe = useStripe();
  const elements = useElements();
  const [loader, setLoader] = useState<boolean>(false);

  const create = async () => {
    if (!elements || !stripe) return;
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    setLoader(true);
    try {
      const result = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });
      const paymentMethodId = result.paymentMethod?.id;
      if (result.error || !paymentMethodId) {
        throw new Error(result.error?.message || 'No se pudo crear el método de pago');
      }

      await trpc.subscriptions.createNewPaymentMethod.mutate({
        paymentMethodId,
      });
      onHide(false);
    } catch {
      onHide(true);
    } finally {
      setLoader(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <div className='modal-container success-modal'>
        <div className='header'>
          <p className='title'>{title}</p>
          <XCircle className='icon' onClick={onHide} aria-label="Cerrar" />
        </div>

        <CardElement
          className='card-input'
          options={{ hidePostalCode: true }}
        />

        <div className='bottom'>
          <p className='content'>{message?.toString()}</p>
          <div className='button-container-2'>
            {loader ? (
              <Spinner size={4} width={0.4} color='var(--app-accent)' />
            ) : (
              <Button unstyled className='btn-success' onClick={create}>
                Aceptar
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
