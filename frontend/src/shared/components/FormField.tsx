import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}

/**
 * Label + campo + error. El input de adentro tiene que llevar:
 *   id={htmlFor}  className="campo"  aria-invalid={!!error}
 *   aria-describedby={error ? `${htmlFor}-error` : undefined}
 */
export function FormField({ label, htmlFor, error, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-tinta">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className="text-sm text-peligro">
          {error}
        </p>
      )}
    </div>
  );
}
