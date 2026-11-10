import * as React from 'react';
import { ULIcon } from '../components/shared/icons.tsx';
import type { LiveSource, LiveStatus } from './liveSource.ts';
import { useLiveStatus } from './liveStore.ts';
import './ULLive.css';

export interface ULLiveStatusProps {
  /** Live source (createLiveSource) whose status is shown; null = offline. */ source: LiveSource | null;
  /** Visible pause / resume control (WCAG 2.2.2 moving content). Default true. */
  pauseControl?: boolean;
  /** Override labels per status ("connecting", "live", "paused", "reconnecting", "offline", "stale"). */ labels?: Partial<Record<LiveStatus, string>> & { pause?: string; resume?: string; retry?: (s: number) => string };
  /** Extra stores / tables paused together with the source. */
  onPausedChange?: (paused: boolean) => void;
  /** Extra class on the root element. */ className?: string;
}
const DEFAULT: Record<LiveStatus, string> = { connecting: 'Connecting', live: 'Live', reconnecting: 'Reconnecting', stale: 'Stale', offline: 'Offline', paused: 'Paused', error: 'Connection error' };

/** Dot + label (+ pause / resume). The status is announced politely on change; the dot pulses only while live (not under reduced motion). */
export function ULLiveStatus({ source, pauseControl = true, labels = {}, onPausedChange, className }: ULLiveStatusProps) {
  const { status, info } = useLiveStatus(source);
  const st = status as LiveStatus;
  const txt = labels[st] ?? DEFAULT[st] ?? status;
  const retry = st === 'reconnecting' && info?.retryIn != null ? (labels.retry ? labels.retry(Math.ceil(info.retryIn / 1000)) : ` · retry in ${Math.max(1, Math.ceil(info.retryIn / 1000))} s`) : '';
  const paused = !!source?.paused;
  const toggle = () => { if (!source) return; if (source.paused) source.resume(); else source.pause(); onPausedChange?.(source.paused); };
  return (
    <span className={'ul-live-status' + (className ? ' ' + className : '')} data-status={st}>
      <span className="ul-live-dot" aria-hidden="true"></span>
      <span className="ul-live-label" role="status" aria-live="polite">{txt}{retry}</span>
      {pauseControl ? (
        <button type="button" className="ul-live-pause" aria-pressed={paused} onClick={toggle}>
          <ULIcon size={14} filled>{paused ? <path d="M8 5.5v13l10-6.5z" /> : <g><rect x="6.5" y="5.5" width="4" height="13" rx="1" /><rect x="13.5" y="5.5" width="4" height="13" rx="1" /></g>}</ULIcon>
          <span>{paused ? labels.resume ?? 'Resume live updates' : labels.pause ?? 'Pause live updates'}</span>
        </button>
      ) : null}
    </span>
  );
}
