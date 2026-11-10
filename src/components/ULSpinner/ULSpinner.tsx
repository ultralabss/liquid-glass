import * as React from 'react';
import './ULSpinner.css';

export interface ULSpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Announced to screen readers. Omit when the parent already sets aria-busy (buttons, fields). */
  label?: string;
}

/** Busy indicator in currentColor. Reduced motion slows it down instead of stopping it. */
export function ULSpinner({ label, className, ...rest }: ULSpinnerProps) {
  return (
    <span {...rest} className={className ? `ul-spinner ${className}` : 'ul-spinner'} role={label ? 'status' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />
  );
}
