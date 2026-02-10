import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import "./PasswordInput.scss";

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  inputClassName?: string;
  wrapperClassName?: string;
}

export function PasswordInput({ inputClassName, wrapperClassName, ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <span className={`password-input-wrap ${wrapperClassName ?? ""}`.trim()}>
      <input
        {...props}
        type={show ? "text" : "password"}
        className={`password-input ${inputClassName ?? ""}`.trim()}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="password-input-toggle"
        aria-pressed={show}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
      >
        {show ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
      </button>
    </span>
  );
}
