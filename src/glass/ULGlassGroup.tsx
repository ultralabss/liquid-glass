import * as React from 'react';
import './ULGlassGroup.css';

export interface GlassGroupContextValue { spacing?: number }
export const GlassGroupContext = React.createContext<GlassGroupContextValue | null>(null);

export interface ULGlassGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Gap between members in px; also the merge distance for the stage-3 goo/morph system. */
  spacing?: number;
  direction?: 'row' | 'column';
}

/**
 * Groups sibling glass so they share one sampling region. Members must not overlap
 * (glass never samples glass). Merge/split morphing is added in stage 3.
 */
export function ULGlassGroup({ spacing, direction = 'row', className, style, children, ...rest }: ULGlassGroupProps) {
  const value = React.useMemo(() => ({ spacing }), [spacing]);
  const vars = spacing != null ? { '--ul-glass-group-spacing': `${spacing}px` } : {};
  return (
    <GlassGroupContext.Provider value={value}>
      <div
        {...rest}
        className={className ? `ul-glass-group ${className}` : 'ul-glass-group'}
        data-direction={direction}
        style={{ ...vars, ...style } as React.CSSProperties}
      >
        {children}
      </div>
    </GlassGroupContext.Provider>
  );
}
