import * as React from 'react';
import { cx } from '../shared/icons.tsx';
import { ULSkeleton } from '../ULData/ULData.tsx';
import './batch2.css';

/* ---------------- ULAspectRatio (CSS aspect-ratio, no JS) ---------------- */
export interface ULAspectRatioProps {
  /** width / height, e.g. 16 / 9 (default), 1, 4 / 3. */
  ratio?: number;
  /** object-fit for img / video / iframe / canvas children. Default cover. */
  fit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  /** Loading placeholder (shared ULSkeleton shimmer) instead of children. */
  skeleton?: boolean;
  /** Rounded corners (default true, --ul-radius-md). */
  rounded?: boolean;
  children?: React.ReactNode;
  className?: string; style?: React.CSSProperties;
}
export function ULAspectRatio({ ratio = 16 / 9, fit = 'cover', skeleton, rounded = true, children, className, style }: ULAspectRatioProps) {
  return (
    <div className={cx('ul-ar', className)} data-fit={fit} data-rounded={rounded ? '' : undefined} aria-busy={skeleton || undefined}
      style={{ aspectRatio: String(ratio), ...style }}>
      {skeleton ? <ULSkeleton shape="rect" className="ul-ar-skel" /> : children}
    </div>
  );
}
