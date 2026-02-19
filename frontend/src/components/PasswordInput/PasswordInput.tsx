import { useState } from "react";
import { Eye, EyeOff } from "src/icons";
import "./PasswordInput.scss";
import { Button, Input } from "src/components/ui";

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  inputClassName?: string;
  wrapperClassName?: string;
}

export function PasswordInput({ inputClassName, wrapperClassName, ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <span className={`password-input-wrap ${wrapperClassName ?? ""}`.trim()}>
      <Input
        {...props}
        type={show ? "text" : "password"}
        className={`password-input ${inputClassName ?? ""}`.trim()}
      />
      <Button unstyled
        type="button"
        onClick={() => setShow((s) => !s)}
        className="password-input-toggle"
        aria-pressed={show}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
      >
        {show ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
      </Button>
    </span>
  );
}
