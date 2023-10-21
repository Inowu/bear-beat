import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js"
import './AddCard.scss';
interface IAddCard {

}
function AddCard(props: IAddCard) {
    const stripe: any = useStripe();
    const elements = useElements();
    return (
        <div className="add-card">
            <CardElement
                className="card-input"
                options={{ hidePostalCode: true }}
            />
        </div>
    )
}
export default AddCard;