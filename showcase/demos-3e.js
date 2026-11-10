// Task 3C demos: ULDemos.Forms (ULField, ULLabel, ULFieldError, ULFieldGroup / ULFieldSet, ULInputGroup) + the form recipe.
(function () {
  function define() {
    const React = window.React, h = React.createElement, UL = window.UL;
    const cap = { margin: 0, font: '12px/1.4 var(--ul-font-mono, ui-monospace, monospace)', letterSpacing: '.04em', color: 'var(--ul-color-text-2)' };
    const panel = { display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, padding: 20, borderRadius: 20, background: 'var(--ul-color-graphite)', boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / .08)' };
    const Cell = ({ label, children, span, id }) => h('div', { 'data-demo': id, style: Object.assign({ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }, span ? { gridColumn: '1 / -1' } : null) }, h('p', { style: cap }, label), h('div', { style: panel }, children));
    const pill = (on) => ({ minHeight: 32, padding: '0 12px', borderRadius: 999, border: 0, cursor: 'pointer', font: '500 13px/1 var(--ul-font-sans)', color: 'var(--ul-color-text)', background: on ? 'rgb(255 255 255 / .2)' : 'rgb(255 255 255 / .06)' });
    const T = {
      en: { email: 'Email', emailD: 'We send the sign-in link here.', emailE: 'Enter a valid email address.', name: 'Display name', site: 'Website', search: 'Search projects', weight: 'Weight', amount: 'Amount', currency: 'Currency', bio: 'Short bio', key: 'API key', team: 'Team', role: 'Role', legend: 'Billing address', street: 'Street', city: 'City', zip: 'Postal code', country: 'Country', long: 'This address is outside the delivery area for the selected plan; choose another address or contact support to change the plan.' },
      sk: { email: 'E-mail', emailD: 'Sem pošleme odkaz na prihlásenie.', emailE: 'Zadajte platnú e-mailovú adresu.', name: 'Zobrazované meno', site: 'Web', search: 'Hľadať projekty', weight: 'Hmotnosť', amount: 'Suma', currency: 'Mena', bio: 'Krátke bio', key: 'API kľúč', team: 'Tím', role: 'Rola', legend: 'Fakturačná adresa', street: 'Ulica', city: 'Mesto', zip: 'PSČ', country: 'Krajina', long: 'Táto adresa je mimo oblasti doručenia pre zvolený plán; zvoľte inú adresu alebo kontaktujte podporu pre zmenu plánu.' },
      de: { email: 'E-Mail', emailD: 'Wir senden den Anmeldelink hierher.', emailE: 'Geben Sie eine gültige E-Mail-Adresse ein.', name: 'Anzeigename', site: 'Website', search: 'Projekte suchen', weight: 'Gewicht', amount: 'Betrag', currency: 'Währung', bio: 'Kurzbiografie', key: 'API-Schlüssel', team: 'Team', role: 'Rolle', legend: 'Rechnungsadresse', street: 'Straße', city: 'Stadt', zip: 'Postleitzahl', country: 'Land', long: 'Diese Adresse liegt außerhalb des Liefergebiets für den gewählten Tarif; wählen Sie eine andere Adresse oder wenden Sie sich an den Support.' },
      cs: { email: 'E-mail', emailD: 'Sem pošleme odkaz pro přihlášení.', emailE: 'Zadejte platnou e-mailovou adresu.', name: 'Zobrazované jméno', site: 'Web', search: 'Hledat projekty', weight: 'Hmotnost', amount: 'Částka', currency: 'Měna', bio: 'Krátké bio', key: 'API klíč', team: 'Tým', role: 'Role', legend: 'Fakturační adresa', street: 'Ulice', city: 'Město', zip: 'PSČ', country: 'Země', long: 'Tato adresa je mimo oblast doručení pro zvolený plán; zvolte jinou adresu nebo kontaktujte podporu kvůli změně plánu.' },
    };
    const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

    // react-hook-form-style hook (README recipe): validate on blur, then on change; submit validates everything.
    function useForm(initial, rules) {
      const [values, setValues] = React.useState(initial), [touched, setTouched] = React.useState({}), [errors, setErrors] = React.useState({});
      const check = (name, v) => { const r = rules[name]; return r ? r(v) || null : null; };
      const register = (name) => ({
        value: values[name],
        onValueChange: (v) => { setValues((s) => Object.assign({}, s, { [name]: v })); if (touched[name]) setErrors((e) => Object.assign({}, e, { [name]: check(name, v) })); },
        onBlur: () => { setTouched((t) => Object.assign({}, t, { [name]: true })); setErrors((e) => Object.assign({}, e, { [name]: check(name, values[name]) })); },
      });
      const dirty = Object.keys(initial).some((k) => values[k] !== initial[k]);
      const validateAll = () => { const e = {}; Object.keys(rules).forEach((k) => { e[k] = check(k, values[k]); }); setErrors(e); setTouched(Object.fromEntries(Object.keys(rules).map((k) => [k, true]))); return !Object.values(e).some(Boolean); };
      return { values, errors, register, dirty, validateAll, reset: () => { setValues(initial); setErrors({}); setTouched({}); } };
    }

    function Recipe({ t, locale }) {
      const [saved, setSaved] = React.useState({ name: 'Ada Lovelace', email: '' });
      const f = useForm(saved, { name: (v) => (!v.trim() ? (locale === 'en' ? 'Enter a name.' : '—') : null), email: (v) => (!emailOk(v) ? t.emailE : null) });
      const guard = UL.useUnsavedChangesGuard(f.dirty, { message: 'unsaved' });
      React.useEffect(() => { window.__formGuard = guard; }, [guard]);
      const n = f.register('name'), e = f.register('email');
      return h('form', { noValidate: true, onSubmit: (ev) => ev.preventDefault(), style: { display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 } },
        h(UL.ULField, { label: t.name, required: true, error: f.errors.name, locale }, h(UL.ULTextField, { label: t.name, floating: false, size: 'compact', value: n.value, onValueChange: n.onValueChange, onBlur: n.onBlur, autoComplete: 'name' })),
        h(UL.ULField, { label: t.email, required: true, description: t.emailD, error: f.errors.email, locale }, h(UL.ULTextField, { label: t.email, type: 'email', floating: false, size: 'compact', value: e.value, onValueChange: e.onValueChange, onBlur: e.onBlur, autoComplete: 'email' })),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' } },
          h(UL.ULSubmitButton, { locale, onSubmit: async () => { if (!f.validateAll()) throw UL.ACTION_CANCEL; await new Promise((r) => setTimeout(r, 700)); setSaved(f.values); } }),
          h(UL.ULSaveStatus, { status: f.dirty ? 'dirty' : 'clean', locale })));
    }

    function Forms() {
      const [locale, setLocale] = React.useState(new URLSearchParams(location.search).get('locale') || 'en');
      const [err, setErr] = React.useState(true), [loading, setLoading] = React.useState(false);
      const t = T[locale] || T.en;
      const [site, setSite] = React.useState('studio'), [q, setQ] = React.useState('glass'), [bio, setBio] = React.useState('Designs calm interfaces.'), [kg, setKg] = React.useState(72), [cur, setCur] = React.useState('eur'), [amt, setAmt] = React.useState('120');
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 } },
        h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' } },
          h('span', { style: cap }, 'locale'), ['en', 'sk', 'de', 'cs'].map((l) => h('button', { key: l, type: 'button', 'aria-pressed': locale === l, style: pill(locale === l), onClick: () => setLocale(l) }, l.toUpperCase())),
          h('span', { style: cap }, ' state'), h('button', { type: 'button', 'aria-pressed': err, style: pill(err), onClick: () => setErr((x) => !x), 'data-demo-toggle': 'error' }, 'errors'), h('button', { type: 'button', 'aria-pressed': loading, style: pill(loading), onClick: () => setLoading((x) => !x) }, 'loading')),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))', gap: 20, minWidth: 0 } },
          h(Cell, { label: 'ULField · vertical · required · description · error (announced)', id: 'field' },
            h(UL.ULField, { label: t.email, required: true, description: t.emailD, error: err ? t.emailE : null, locale, id: 'demo-email' }, h(UL.ULTextField, { label: t.email, type: 'email', floating: false, size: 'compact', defaultValue: 'ada@' })),
            h(UL.ULField, { label: t.bio, optional: true, locale }, h('textarea', { rows: 3, defaultValue: 'Native textarea, wired by ULField.' }))),
          h(Cell, { label: 'ULField · horizontal (stacks < 480px) · native input · ULSelect', id: 'field-h' },
            h(UL.ULField, { label: t.name, orientation: 'horizontal', required: true, locale }, h('input', { defaultValue: 'Ada Lovelace', autoComplete: 'name' })),
            h(UL.ULField, { label: t.role, orientation: 'horizontal', optional: true, locale }, h(UL.ULSelect, { label: t.role, options: [{ value: 'owner', label: 'Owner' }, { value: 'editor', label: 'Editor' }, { value: 'viewer', label: 'Viewer' }], defaultValue: 'editor', fullWidth: true }))),
          h(Cell, { label: 'ULFieldError · wrapped · one line (truncate + tooltip) · list', id: 'ferr' },
            h('div', { style: { width: '100%', maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 10 } },
              h(UL.ULFieldError, { locale }, t.long), h(UL.ULFieldError, { truncate: true, locale }, t.long), h(UL.ULFieldError, { errors: [t.emailE, t.long], locale }))),
          h(Cell, { label: 'ULFieldSet · legend · 2 responsive columns', id: 'fieldset', span: true },
            h(UL.ULFieldSet, { legend: t.legend, columns: 2, required: true, locale, error: err ? t.long : null },
              h(UL.ULField, { label: t.street, required: true, locale }, h(UL.ULTextField, { label: t.street, floating: false, size: 'compact', defaultValue: 'Hlavná 12' })),
              h(UL.ULField, { label: t.city, required: true, locale }, h(UL.ULTextField, { label: t.city, floating: false, size: 'compact', defaultValue: 'Bratislava' })),
              h(UL.ULField, { label: t.zip, required: true, locale }, h(UL.ULTextField, { label: t.zip, floating: false, size: 'compact', defaultValue: '811 01', inputMode: 'numeric' })),
              h(UL.ULField, { label: t.country, locale }, h(UL.ULSelect, { label: t.country, options: [{ value: 'sk', label: 'Slovakia' }, { value: 'cz', label: 'Czechia' }, { value: 'de', label: 'Germany' }], defaultValue: 'sk', fullWidth: true })))),
          h(Cell, { label: 'ULInputGroup · prefix / suffix addons · ULTextField', id: 'ig-addons' },
            h(UL.ULField, { label: t.site, locale }, h(UL.ULInputGroup, { prefix: 'https://', suffix: '.ultralabs.app', size: 'compact', locale }, h(UL.ULTextField, { label: t.site, floating: false, value: site, onValueChange: setSite }))),
            h(UL.ULField, { label: t.search, locale }, h(UL.ULInputGroup, { prefix: h(UL.ULIcon, { name: 'search', size: 'md' }), suffix: h(UL.ULKbd, { keys: 'Mod+K', size: 'sm' }), clearable: true, loading, shape: 'capsule', size: 'compact', locale }, h(UL.ULInputGroupInput, { value: q, onValueChange: setQ, type: 'search' })))),
          h(Cell, { label: 'ULInputGroup · counter · ULNumberField · ULSelect + amount · ULCopyButton', id: 'ig-controls' },
            h(UL.ULField, { label: t.bio, description: 'max 40', locale, error: bio.length > 40 ? '—' : null }, h(UL.ULInputGroup, { maxLength: 40, clearable: true, size: 'compact', locale }, h(UL.ULInputGroupInput, { value: bio, onValueChange: setBio }))),
            h(UL.ULField, { label: t.weight, locale }, h(UL.ULInputGroup, { suffix: 'kg', size: 'compact', locale }, h(UL.ULNumberField, { label: t.weight, floating: false, size: 'compact', value: kg, onValueChange: setKg, min: 0, max: 400 }))),
            h(UL.ULField, { label: t.amount, locale }, h(UL.ULInputGroup, { size: 'compact', locale, prefix: h('span', { style: { display: 'flex', width: 92 } }, h(UL.FieldCtx.Provider, { value: null }, h(UL.ULSelect, { label: t.currency, options: [{ value: 'eur', label: 'EUR' }, { value: 'usd', label: 'USD' }, { value: 'czk', label: 'CZK' }], value: cur, onValueChange: setCur }))) }, h(UL.ULInputGroupInput, { value: amt, onValueChange: setAmt, inputMode: 'decimal' }))),
            h(UL.ULField, { label: t.key, locale }, h(UL.ULInputGroup, { size: 'compact', locale, actions: h(UL.ULCopyButton, { value: 'ul_live_9f2c41', variant: 'icon', sensitive: true, locale }) }, h(UL.ULInputGroupInput, { value: 'ul_live_9f2c41', readOnly: true, spellCheck: false, style: { fontFamily: 'var(--ul-font-mono)' } })))),
          h(Cell, { label: 'Recipe · validate on blur, then on change · ULSubmitButton · unsaved guard', id: 'recipe' }, h(Recipe, { t, locale }))));
    }
    window.ULDemos = Object.assign(window.ULDemos || {}, { Forms });
  }
  if (window.UL) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
