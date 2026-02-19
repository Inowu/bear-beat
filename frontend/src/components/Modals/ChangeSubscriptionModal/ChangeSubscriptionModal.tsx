import './../Modal.scss'
import { Modal } from "src/components/ui"
import { XCircle } from "src/icons"
import { Spinner } from '../../../components/Spinner/Spinner';
import { useState } from 'react'
import { IPlans } from "../../../interfaces/Plans";
import PayPalComponent from '../../PayPal/PayPalComponent';
import { Button } from "src/components/ui";
interface ICondition {
    show: boolean;
    onHide: () => void;
    action: () => void;
    title: string;
    message?: string;
    plan: IPlans;
}

export function ChangeSubscriptionModal(props: ICondition) {
    const { show, onHide, message, action, title, plan } = props;
    const [loader, setLoader] = useState<boolean>(false);

    const startAction = async () => {
        setLoader(true);
        await action();
        setLoader(false);
        onHide();
    }

    const confirmButton = () => {
        if (plan.stripe_prod_id || plan.stripe_prod_id_test) {
            return (
                <Button unstyled className='btn-option-4' onClick={startAction}>
                    Confirmar
                </Button>
            )
        }

        return (
            <PayPalComponent
                type="order"
                plan={plan}
                onClick={() => { }}
                onApprove={startAction}
            />
        )
    }

    return (
        <Modal show={show} onHide={onHide} centered>
            <div className='modal-container success-modal'>
                <div className='header'>
                    <p className='title'>{title}</p>
                    <XCircle className='icon' onClick={onHide} aria-label="Cerrar" />
                </div>
                <div className='bottom'>
                    <p className='content'>
                        {message?.toString()}
                    </p>
                    <div className='button-container'>
                        <Button unstyled className='btn-option-5' onClick={onHide}>
                            Cancelar
                        </Button>
                        {
                            !loader
                                ? confirmButton()
                                : <div style={{ width: 189 }}><Spinner size={3} width={.3} color="var(--app-accent)" /></div>
                        }
                    </div>
                </div>
            </div>
        </Modal>
    )
}
