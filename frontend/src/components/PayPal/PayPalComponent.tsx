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
import { useEffect, useRef, useState } from 'react'
import trpc from "../../api";
import "./PayPalComponent.scss";

interface Props {
    onApprove: (order: any) => void;
    onClick: () => void;
    canProceed?: boolean;
    onBlocked?: () => void;
    onCancel?: () => void;
    onError?: (error: unknown) => void;
    type: 'subscription' | 'order',
    plan: IPlans
}

export default function PayPalComponent(props: Props) {
    const components = "buttons";
    const disableFunding: string[] = ["paylater", "credit", "venmo"];
    const buttonsRef = useRef<{ render: (selector: string) => Promise<unknown> } | null>(null);
    const isMountedRef = useRef(true);
    const canProceedRef = useRef<boolean | undefined>(props.canProceed);
    const onBlockedRef = useRef<(() => void) | undefined>(props.onBlocked);
    const onCancelRef = useRef<(() => void) | undefined>(props.onCancel);
    const onErrorRef = useRef<((error: unknown) => void) | undefined>(props.onError);
    const attemptRef = useRef(0);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [errorCopy, setErrorCopy] = useState("");
    const buttonId = `paypal-button-container-${props.plan.id}`;

    useEffect(() => {
        isMountedRef.current = true;
        loadAndRender();
        return () => {
            isMountedRef.current = false;
            const el = document.getElementById(buttonId);
            if (el) el.replaceChildren();
            buttonsRef.current = null;
        };
    }, []);

    useEffect(() => {
        canProceedRef.current = props.canProceed;
        onBlockedRef.current = props.onBlocked;
        onCancelRef.current = props.onCancel;
        onErrorRef.current = props.onError;
    }, [props.canProceed, props.onBlocked, props.onCancel, props.onError]);

    const handleManyChat = async () => {
        try {
            await manychatApi("USER_CHECKED_PLANS");
        } catch (error) {
            // Best-effort only; do not block PayPal flow.
        }
    };

    const paypalButtonStyle: PayPalButtonsComponentOptions["style"] = {
        color: "blue",
        shape: "pill",
        layout: "vertical",
        label: "paypal",
        height: 48,
        tagline: false,
    };

    function render(options: PayPalButtonsComponentOptions, attemptId: number) {
        if (!isMountedRef.current) return;
        const container = document.getElementById(buttonId);
        if (!container || !container.isConnected) return;
        if (window.paypal && window.paypal.Buttons) {
            // Ensure we only clear our own container (multiple PayPal buttons may exist on the page).
            container.replaceChildren();
            const buttons = window.paypal.Buttons(options);
            buttonsRef.current = buttons;
            buttons.render(`#${buttonId}`).then(() => {
                if (!isMountedRef.current) return;
                if (attemptId !== attemptRef.current) return;
                setStatus("ready");
                setErrorCopy("");
            }).catch((err: any) => {
                if (!isMountedRef.current) return;
                if (attemptId !== attemptRef.current) return;
                const isContainerRemoved = /container.*removed|removed from DOM/i.test(String(err?.message ?? ""));
                if (isContainerRemoved) return;
                if (import.meta.env.DEV) {
                    console.warn("[PAYPAL] Failed to render buttons.");
                }
                setStatus("error");
                setErrorCopy("No pudimos cargar PayPal. Intenta de nuevo o elige otro método.");
            });
            return;
        }
        if (attemptId !== attemptRef.current) return;
        setStatus("error");
        setErrorCopy("No pudimos cargar PayPal. Intenta de nuevo o elige otro método.");
    }

    function loadAndRender(transactionType = props.type) {
        const attemptId = ++attemptRef.current;
        setStatus("loading");
        setErrorCopy("");

        const isDevEnv = process.env.REACT_APP_ENVIRONMENT === "development";
        const resolvedClientId = isDevEnv ? process.env.REACT_APP_PAYPAL_CLIENT_TEST_ID : process.env.REACT_APP_PAYPAL_CLIENT_ID;
        const clientId = typeof resolvedClientId === "string" && resolvedClientId.trim() ? resolvedClientId.trim() : null;

        if (!clientId) {
            setStatus("error");
            setErrorCopy("PayPal no está disponible en este momento. Elige otro método de pago.");
            return;
        }

        async function onClickButton(data: any, actions: OnClickActions) {
            if (canProceedRef.current === false) {
                onBlockedRef.current?.();
                return actions.reject();
            }
            props.onClick();
            void trpc.checkoutLogs.registerCheckoutLog.mutate().catch(() => { });
            handleManyChat();
            try {
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

                return actions.resolve();
            } catch (err: any) {
                if (!isMountedRef.current) return actions.reject();
                if (attemptId !== attemptRef.current) return actions.reject();
                onErrorRef.current?.(err);
                setStatus("error");
                setErrorCopy("No pudimos validar PayPal. Revisa tu conexión e intenta de nuevo.");
                return actions.reject();
            }
        }

        async function createOrder(data: any, actions: CreateOrderActions) {
            const currentPlan = await trpc.auth.getCurrentSubscriptionPlan.query();
            if (!currentPlan) {
                throw new Error("No tienes un plan activo para actualizar.");
            }
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
            if (!planId) {
                throw new Error("No hay plan de PayPal configurado para este plan.");
            }

            try {
                const sub = await actions.subscription.create({
                    plan_id: planId,
                });
                return sub;
            } catch (e: any) {
                if (import.meta.env.DEV) {
                    console.warn("[PAYPAL] createSubscription failed.");
                }
                if (isMountedRef.current && attemptId === attemptRef.current) {
                    setStatus("error");
                    setErrorCopy("No pudimos completar PayPal. Intenta de nuevo o elige otro método.");
                }
                onErrorRef.current?.(e);
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
                components,
                disableFunding,
            })
                .then(() => {
                    render({
                        style: paypalButtonStyle,
                        // Checkout optimizado: botón único PayPal, sin bloques secundarios.
                        fundingSource: "paypal",
                        onApprove: onApproveOrder,
                        createOrder,
                        onCancel: () => onCancelRef.current?.(),
                        onError: (err: any) => {
                            if (!isMountedRef.current) return;
                            if (attemptId !== attemptRef.current) return;
                            onErrorRef.current?.(err);
                            setStatus("error");
                            setErrorCopy("No pudimos completar PayPal. Intenta de nuevo o elige otro método.");
                        },
                    }, attemptId);
                })
                .catch(() => {
                    if (!isMountedRef.current) return;
                    if (attemptId !== attemptRef.current) return;
                    if (import.meta.env.DEV) {
                        console.warn("[PAYPAL] Failed to load PayPal SDK.");
                    }
                    setStatus("error");
                    setErrorCopy("No pudimos cargar PayPal. Revisa tu conexión e intenta de nuevo.");
                });
        } else {
            loadScript({
                clientId,
                vault: true,
                intent: "subscription",
                components,
                disableFunding,
            })
                .then(() => {
                    render({
                        style: paypalButtonStyle,
                        // Checkout optimizado: botón único PayPal, sin bloques secundarios.
                        fundingSource: "paypal",
                        onApprove: onApproveSubsciption,
                        createSubscription,
                        onClick: onClickButton,
                        onCancel: () => onCancelRef.current?.(),
                        onError: (err: any) => {
                            if (!isMountedRef.current) return;
                            if (attemptId !== attemptRef.current) return;
                            onErrorRef.current?.(err);
                            setStatus("error");
                            setErrorCopy("No pudimos completar PayPal. Intenta de nuevo o elige otro método.");
                        },
                    }, attemptId);
                })
                .catch(() => {
                    if (!isMountedRef.current) return;
                    if (attemptId !== attemptRef.current) return;
                    if (import.meta.env.DEV) {
                        console.warn("[PAYPAL] Failed to load PayPal SDK.");
                    }
                    setStatus("error");
                    setErrorCopy("No pudimos cargar PayPal. Revisa tu conexión e intenta de nuevo.");
                });
        }
    }

    const showFallback = status !== "ready";
    const fallbackText =
        status === "loading"
            ? "Cargando PayPal..."
            : errorCopy || "No pudimos cargar PayPal. Intenta de nuevo o elige otro método.";

    return (
        <div className="paypal-root" aria-busy={status === "loading"} aria-live="polite">
            <div className='paypal-container' id={`${buttonId}`}></div>
            {showFallback && (
                <div
                    className={`paypal-fallback paypal-fallback--${status}`}
                    role="status"
                    aria-label={status === "loading" ? "Cargando PayPal" : "Error con PayPal"}
                >
                    <span className="paypal-fallback__text">{fallbackText}</span>
                    {status === "error" && (
                        <button
                            type="button"
                            className="paypal-fallback__retry"
                            onClick={() => loadAndRender()}
                        >
                            Reintentar
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
