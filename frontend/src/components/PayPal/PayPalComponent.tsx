import { IPlans } from '../../interfaces/Plans';
import { loadScript } from "@paypal/paypal-js";
import { manychatApi } from "../../api/manychat";
import {
    PayPalButtonsComponentOptions,
    OnApproveData,
    OnApproveActions,
    CreateSubscriptionActions,
    CreateOrderActions,
    OnClickActions
} from "@paypal/paypal-js/types/components/buttons"
import { useEffect, useRef } from 'react'
import trpc from "../../api";

interface Props {
    onApprove: (order: any) => void;
    onClick: () => void;
    type: 'subscription' | 'order',
    plan: IPlans
}

export default function PayPalComponent(props: Props) {
    const components = "buttons";
    const buttonsRef = useRef<{ render: (selector: string) => Promise<unknown> } | null>(null);
    const isMountedRef = useRef(true);
    const buttonId = `paypal-button-container-${props.plan.id}`;

    useEffect(() => {
        isMountedRef.current = true;
        loadAndRender();
        return () => {
            isMountedRef.current = false;
            const el = document.getElementById(buttonId);
            if (el) el.innerHTML = "";
            buttonsRef.current = null;
        };
    }, []);

    const handleManyChat = async () => {
        try {
            await manychatApi("USER_CHECKED_PLANS");
        } catch (error) {
            console.log(error);
        }
    };

    function render(options: PayPalButtonsComponentOptions) {
        if (!isMountedRef.current) return;
        const container = document.getElementById(buttonId);
        if (!container || !container.isConnected) return;
        if (window.paypal && window.paypal.Buttons) {
            const previousPayPalButton = document.querySelector('.paypal-container');
            if (previousPayPalButton && previousPayPalButton !== container) {
                previousPayPalButton.innerHTML = "";
            }
            const buttons = window.paypal.Buttons(options);
            buttonsRef.current = buttons;
            buttons.render(`#${buttonId}`).catch((err: any) => {
                if (!isMountedRef.current) return;
                const isContainerRemoved = /container.*removed|removed from DOM/i.test(String(err?.message ?? ""));
                if (isContainerRemoved) return;
                console.warn("Warning - Caught an error when attempting to render component", err);
            });
        }
    }

    function loadAndRender(transactionType = props.type) {
        const clientId = process.env.REACT_APP_ENVIRONMENT === 'development'
            ? process.env.REACT_APP_PAYPAL_CLIENT_TEST_ID!
            : process.env.REACT_APP_PAYPAL_CLIENT_ID!;

        async function onClickButton(data: any, actions: OnClickActions) {
            trpc.checkoutLogs.registerCheckoutLog.mutate();
            handleManyChat();
            // Revisar si el usuario tiene una suscripcion activa
            const me = await trpc.auth.me.query();
            if (me.hasActiveSubscription) return actions.reject();
            const existingOrder = await trpc.orders.ownOrders.query({
                where: {
                    AND: [
                        {
                            status: 0,
                        },
                        {
                            payment_method: "Paypal",
                        },
                    ],
                },
            });

            if (existingOrder.length > 0) {
                return actions.reject();
            }

            actions.resolve();
        }

        async function createOrder(data: any, actions: CreateOrderActions) {
            const currentPlan = await trpc.auth.getCurrentSubscriptionPlan.query();
            const priceDifference = Number(props.plan.price) - Number(currentPlan.price);

            return await actions.order.create({
                intent: 'CAPTURE',
                purchase_units: [
                    {
                        amount: {
                            currency_code: currentPlan.moneda.toUpperCase(),
                            value: priceDifference.toString()
                        },
                    },
                ],
            });
        };
        async function createSubscription(data: any, actions: CreateSubscriptionActions) {
            const planId = process.env.REACT_APP_ENVIRONMENT === 'development'
                ? props.plan.paypal_plan_id_test
                : props.plan.paypal_plan_id;

            try {
                const sub = await actions.subscription.create({
                    plan_id: planId,
                });
                return sub;
            } catch (e: any) {
                console.log(e?.message);
            }
            return "";
        }

        async function onApproveOrder(data: OnApproveData, actions: OnApproveActions) {
            if (actions.order) {
                await actions.order.capture();
                let body = {
                    newPlanId: props.plan.id,
                };
                if (props.plan.paypal_plan_id || props.plan.paypal_plan_id_test) {
                    const changeplan: any =
                        await trpc.subscriptions.changeSubscriptionPlan.mutate(body);
                    const url = changeplan.data.links[0].href;
                    window.open(url, "_blank");
                    // actions.redirect(url);
                }
            }
        };

        async function onApproveSubsciption(data: OnApproveData, actions: OnApproveActions) {
            props.onApprove(data)
        };

        if (transactionType === "order") {
            loadScript({
                clientId,
                vault: false,
                components
            })
                .then(() => {
                    render({
                        style: {
                            color: "silver",
                            shape: "pill",
                            layout: "horizontal",
                            height: 46,
                            tagline: false,
                        },
                        onApprove: onApproveOrder,
                        createOrder,
                    });
                });
        } else {
            loadScript({
                clientId,
                vault: true,
                intent: "subscription",
                components,
            })
                .then(() => {
                    render({
                        style: {
                            color: "silver",
                            shape: "pill",
                            layout: "horizontal",
                            height: 46,
                            tagline: false,
                        },
                        onApprove: onApproveSubsciption,
                        createSubscription,
                        onClick: onClickButton,
                    });
                });
        }
    }

    return (
        <div className='paypal-container' id={`${buttonId}`}></div>
    );
}