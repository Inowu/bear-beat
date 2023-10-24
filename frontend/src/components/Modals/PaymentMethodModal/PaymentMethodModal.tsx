import React from 'react'
import './../Modal.scss'
import { Modal } from 'react-bootstrap'
import { RiCloseCircleLine } from 'react-icons/ri';
import AddCard from '../../AddCard/AddCard';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import trpc from "../../../api";
interface IError {
    show: boolean;
    onHide: any;
    title: string;
    message?: string;
}

export function PaymentMethodModal(props: IError) {
    const { show, onHide, title, message } = props;
    const stripe: any = useStripe();
    const elements = useElements();
    const random_number: number = Math.random();
    const create = async () => {

        if (elements && stripe) {
            const cardElement = elements.getElement("card");
            try {
                const generateToken: any = await stripe.createToken(cardElement);
                const add: any = await trpc.subscriptions.createNewPaymentMethod.mutate({ cardToken: generateToken.token.id });
                onHide(false);
            } catch (error) {
                onHide(true)
            }

        }
    }

    return (
        <Modal show={show} onHide={onHide} centered>
            <div className='modal-container success-modal'>
                <div className='header'>
                    <p className='title'>{title}</p>
                    <RiCloseCircleLine className='icon' onClick={onHide} />
                </div>
                {random_number > 0 && (
                    <CardElement
                        className="card-input"
                        options={{ hidePostalCode: true }}
                    />
                )}
                <div className='bottom'>
                    <p className='content'>
                        {message?.toString()}
                    </p>
                    <div className='button-container-2'>
                        <button className='btn-success' onClick={() => { create() }}>
                            Aceptar
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    )
}
