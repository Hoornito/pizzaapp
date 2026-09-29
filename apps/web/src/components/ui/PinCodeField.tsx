'use client';

import TextField, { type TextFieldProps } from '@mui/material/TextField';

type PinCodeFieldProps = Omit<TextFieldProps, 'value' | 'onChange' | 'type'> & {
  value: string;
  onChange: (value: string) => void;
  /** Se llama con Enter cuando ya están los 4 dígitos. */
  onComplete?: () => void;
};

/**
 * Campo para códigos de 4 dígitos (login admin, secciones bloqueadas).
 *
 * Un código que el navegador autocompleta no protege nada, así que:
 * - Es `type="text"` (no "password") para que el gestor de contraseñas no lo
 *   ofrezca guardar ni lo rellene; los dígitos se tapan con `text-security`.
 * - `autoComplete="off"` + nombre propio para que Chrome no sugiera lo que se
 *   tipeó antes, y los `data-*-ignore` para las extensiones (LastPass,
 *   1Password, Bitwarden, Dashlane).
 */
export function PinCodeField({ value, onChange, onComplete, inputProps, ...props }: PinCodeFieldProps) {
  return (
    <TextField
      {...props}
      type="text"
      fullWidth
      autoComplete="off"
      name="pin-no-autofill"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
      onKeyDown={(e) => { if (e.key === 'Enter' && value.length === 4) onComplete?.(); }}
      inputProps={{
        inputMode: 'numeric',
        maxLength: 4,
        spellCheck: false,
        autoCorrect: 'off',
        autoCapitalize: 'off',
        'data-lpignore': 'true',
        'data-1p-ignore': 'true',
        'data-bwignore': 'true',
        'data-form-type': 'other',
        ...inputProps,
        style: {
          letterSpacing: '0.5em',
          textAlign: 'center',
          fontSize: '1.4rem',
          WebkitTextSecurity: 'disc',
          ...inputProps?.style,
        } as React.CSSProperties,
      }}
    />
  );
}
