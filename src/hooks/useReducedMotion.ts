import * as React from 'react';

export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback((cb: () => void) => {
    const m = matchMedia(query);
    m.addEventListener('change', cb);
    return () => m.removeEventListener('change', cb);
  }, [query]);
  return React.useSyncExternalStore(subscribe, () => matchMedia(query).matches, () => false);
}

export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
export const useReducedTransparency = () => useMediaQuery('(prefers-reduced-transparency: reduce)');
