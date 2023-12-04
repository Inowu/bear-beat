import React, { useEffect, useState } from 'react'
import './Plans.scss'
import { Modal } from 'react-bootstrap'
import trpc from "../../../api";
import { RiCloseCircleLine } from 'react-icons/ri';
import { IGBPlans } from '../../../interfaces/Plans';
import { useUserContext } from "../../../contexts/UserContext";
import { IPaymentMethod } from 'interfaces/User';
import { Spinner } from '../../../components/Spinner/Spinner';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
interface IPlan {
  show: boolean;
  onHide: () => void;
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
  const { show, onHide, dataModals } = props;
  const [selectPlan, setSelectPlan] = useState<IGBPlans | null>(null);
  const stripe: any = useStripe();
  const elements = useElements();
  const [plans, setPlans] = useState<IGBPlans[]>([]);
  const [card, setCard] = useState('');
  const [loader, setLoader] = useState(false);
  const { setShowError, setShowSuccess, setSuccessMessage, setErrorMessage, setSuccessTitle } = dataModals;
  const choosePlan = (val: IGBPlans) => {
    setSelectPlan(val)
  }
  const seePlans = () => {
    setCard('');
    setSelectPlan(null);
  }
  const close = () => {
    setSelectPlan(null);
    onHide();
  }
  const getPlans = async () => {
    try {
      const plans: any = await trpc.products.getProducts.query()
      console.log(plans);
      setPlans(plans);
    }
    catch (error) {
      console.log(error);
    }
  }
  const selectCard = (card: string) => {
    setCard(card);
  }
  const buyPlan = async () => {
    setLoader(true);
    if (selectPlan !== null) {
      let body = {
        productId: selectPlan.id,
        paymentMethod: card,
      }
      try {
        const plans = await trpc.products.buyMoreGB.mutate(body)
        if (elements && stripe) {
          console.log(card);
          const result = await stripe.confirmCardPayment(
            plans.clientSecret,
            card === '' ?
              {
                payment_method: {
                  card: elements.getElement("card")!,
                },
              }
              : {
                payment_method: card
              }
          );
          if (result.error) {
            setLoader(false);
            setErrorMessage(result.error.message);
            setShowError(true);
          } else {
            close();
            setShowSuccess(true)
            setSuccessTitle('Pago Exitoso')
            startUser();
            setSuccessMessage(plans.message)
            setLoader(false);
          }
        }
      }
      catch (error) {
        setShowError(true);
        setErrorMessage(error);
      }
    }
    setLoader(false);
  }
  useEffect(() => {
    getPlans();
  }, [])

  return (
    <Modal show={show} onHide={close} centered>
      <div className='modal-container success-modal modal-container-plans'>
        <div className='header'>
          <p className='title'>Comprar Gbs Extra</p>
          <RiCloseCircleLine className='icon' onClick={close} />
        </div>
        {
          selectPlan === null ?
            <div className='bottom'>
              <p className='content'>
                ¿Necesitas más espacio?, elige el plan que deseas comprar.
              </p>
              <div className='button-container-2' style={{ flexDirection: 'column' }}>
                {
                  plans.map((x: IGBPlans, index: number) => {
                    return (
                      <button className='btn-option-5' onClick={() => choosePlan(x)} key={"buttons_pay_" + index}>
                        Plan: {x.name} - ${x.id === 1 ? 350 : 500}.00 MXN
                      </button>
                    )
                  })
                }
              </div>
            </div> :
            <div className='bottom'>
              <p className='go-back' onClick={seePlans}>Regresar</p>
              <p className='title'>Plan de: {selectPlan.name}</p>
              <p className='title'>Costo: $ {selectPlan.id === 1 ? 350 : 500}.00 MXN</p>
              <p className='add-card'>Nueva Tarjeta</p>
              <select onChange={(e: any) => selectCard(e.target.value)} defaultValue={''}>
                <option disabled value={''}>Seleccione una tarjeta</option>
                {
                  paymentMethods.map((card: IPaymentMethod, idx: number) => {
                    return (
                      <option value={card.id} key={"cards" + idx}>{card.card.brand} termina en {card.card.last4}</option>
                    )
                  })
                }
              </select>
              <div className='button-container-2'>
                {
                  loader ?
                    <Spinner size={4} width={0.4} color="#00e2f7" />
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