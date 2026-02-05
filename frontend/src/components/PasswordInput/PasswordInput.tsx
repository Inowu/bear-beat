import { useState } from "react";
import { HiOutlineEye, HiOutlineEyeOff } from "react-icons/hi";
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
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        tabIndex={-1}
      >
        {show ? (
          <HiOutlineEyeOff size={22} aria-hidden />
        ) : (
          <HiOutlineEye size={22} aria-hidden />
        )}
      </button>
    </span>
  );
}
