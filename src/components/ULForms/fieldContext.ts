import * as React from 'react';

/** ULField → control wiring (ids + aria). Controls read it; ULField owns the label, description and error. */
export interface FieldCtxValue {
  id: string; labelId: string; descId?: string; errId?: string;
  invalid: boolean; required: boolean; disabled: boolean;
  /** space-separated ids for aria-describedby (description, addons, counter, error) */
  describedBy?: string;
}
export const FieldCtx = React.createContext<FieldCtxValue | null>(null);
export const useFieldCtx = () => React.useContext(FieldCtx);

/** ULInputGroup → inner control. The group owns the one well; inner controls drop their own well chrome. */
export interface InputGroupCtxValue {
  /** inner control reports its current text (clear button, counter) */
  report: (value: string) => void;
  /** inner control registers how to clear itself + its focus target */
  register: (api: { clear: () => void; focus: () => void } | null) => void;
  extraDescribedBy?: string;
  maxLength?: number;
}
export const InputGroupCtx = React.createContext<InputGroupCtxValue | null>(null);
export const useInputGroupCtx = () => React.useContext(InputGroupCtx);

/** aria attributes for a control inside ULField / ULInputGroup (merged with the control's own). */
export function fieldAria(ctx: FieldCtxValue | null, group: InputGroupCtxValue | null, own?: { describedBy?: string; invalid?: boolean }) {
  const desc = [own?.describedBy, ctx?.describedBy, group?.extraDescribedBy].filter(Boolean).join(' ') || undefined;
  const invalid = !!(own?.invalid || ctx?.invalid);
  return {
    'aria-describedby': desc,
    'aria-invalid': invalid || undefined,
    'aria-errormessage': invalid && ctx?.errId ? ctx.errId : undefined,
    'aria-required': ctx?.required || undefined,
  } as const;
}
