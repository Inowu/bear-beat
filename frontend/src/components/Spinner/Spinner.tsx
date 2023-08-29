import "./Spinner.scss";

interface SpinnerProps {
    size: number;
    width: number;
    color?: string;
}
export function Spinner(props: SpinnerProps) {
    return (
        <div>
            <div className="d-flex w-100 h-100 justify-content-center align-items-center">
                <div
                    className={
                        "spinner-border " + (props.color === undefined ? "text-info" : "")
                    }
                    style={{
                        width: `${props.size}rem`,
                        height: `${props.size}rem`,
                        borderWidth: `${props.width}rem`,
                        color: props.color,
                    }}
                    role="status"
                >
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        </div>
    );
}