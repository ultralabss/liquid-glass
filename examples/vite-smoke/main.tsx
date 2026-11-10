// Consumer smoke test: imports the packed package exactly like an app would (dist/esm + dist/types + CSS).
// Owner run: see docs/release-checklist.md step 9. Not published (examples/ is outside "files").
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import '@ultralabs/glass/tokens.css';
import '@ultralabs/glass/dist/ul-glass.css';
import {
  ULProvider, ULAccentScope, ULButton, ULTextField, ULSwitch, ULSegmentedControl, ULModal, ULLineChart,
  type Material,
} from '@ultralabs/glass';

const rows = Array.from({ length: 12 }, (_, i) => ({ month: new Date(2026, i, 1), web: 400 + i * 35 + (i % 3) * 60, app: 260 + i * 22 }));

function App() {
  const [material, setMaterial] = React.useState<Material>('glass');
  const [open, setOpen] = React.useState(false);
  const [sync, setSync] = React.useState(true);
  const trigger = React.useRef<HTMLElement>(null);
  return (
    <ULProvider material={material}>
      <ULAccentScope accent="violet">
        <main style={{ maxWidth: 880, margin: '0 auto', padding: 32, display: 'grid', gap: 24 }}>
          <ULSegmentedControl
            aria-label="Material"
            value={material}
            onValueChange={(v: string) => setMaterial(v as Material)}
            options={[{ value: 'glass', label: 'Glass' }, { value: 'flat', label: 'Flat' }]}
          />
          <ULTextField label="E-mail" type="email" helper="Smoke test field" />
          <ULSwitch label="Sync" checked={sync} onCheckedChange={setSync} />
          <ULButton ref={trigger} variant="primary" onClick={() => setOpen(true)}>Open dialog</ULButton>
          <ULModal open={open} onOpenChange={setOpen} triggerRef={trigger} title="Rename project" size="sm"
            footer={<ULButton variant="primary" onClick={() => setOpen(false)}>Done</ULButton>}>
            <ULTextField label="Name" defaultValue="client-portal" />
          </ULModal>
          <ULLineChart title="Revenue" data={rows} x={(d) => d.month} xScale="time"
            series={[{ key: 'web', name: 'Web', value: (d) => d.web }, { key: 'app', name: 'App', value: (d) => d.app }]} />
        </main>
      </ULAccentScope>
    </ULProvider>
  );
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
