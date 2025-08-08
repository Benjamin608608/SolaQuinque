(function(){
  const STORAGE_KEY = 'ecclesia_prefs';
  const defaultPrefs = { theme: true, candle: false, motion: true, initial: true };

  function readPrefs() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { ...defaultPrefs }; } catch { return { ...defaultPrefs }; }
  }
  function savePrefs(p) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {} }

  function apply(prefs) {
    const body = document.body;
    body.classList.toggle('theme-ecclesia', !!prefs.theme);
    body.classList.toggle('theme-candle', !!prefs.theme && !!prefs.candle);
    body.classList.toggle('motion-off', !prefs.motion);
    body.classList.toggle('enable-initial', !!prefs.initial);
  }

  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k,v]) => {
      if (k === 'class') n.className = v; else if (k === 'html') n.innerHTML = v; else n.setAttribute(k, v);
    });
    children.forEach(c => n.appendChild(c));
    return n;
  }

  function switchEl(active) {
    const sw = el('div', { class: 'ec-switch' }, [ el('div', { class: 'dot' }) ]);
    if (active) sw.classList.add('active');
    return sw;
  }

  function buildPanel(prefs) {
    const panel = el('div', { class: 'ec-panel', style: 'display:none' });

    const h = el('h4', { html: '外觀設定 Appearance' });

    const r1 = el('div', { class: 'ec-row' }, [
      el('label', { html: '啟用神學典雅主題' }),
      (function(){ const s = switchEl(prefs.theme); s.onclick = () => { prefs.theme = !prefs.theme; s.classList.toggle('active'); apply(prefs); savePrefs(prefs); }; return s; })()
    ]);

    const r2 = el('div', { class: 'ec-row' }, [
      el('label', { html: '燭光模式（深色）' }),
      (function(){ const s = switchEl(prefs.candle); s.onclick = () => { prefs.candle = !prefs.candle; s.classList.toggle('active'); apply(prefs); savePrefs(prefs); }; return s; })()
    ]);

    const div = el('div', { class: 'gold-divider' });

    const r3 = el('div', { class: 'ec-row' }, [
      el('label', { html: '動效（可關閉）' }),
      (function(){ const s = switchEl(prefs.motion); s.onclick = () => { prefs.motion = !prefs.motion; s.classList.toggle('active'); apply(prefs); savePrefs(prefs); }; return s; })()
    ]);

    const r4 = el('div', { class: 'ec-row' }, [
      el('label', { html: '文章落下首字（Illuminated）' }),
      (function(){ const s = switchEl(prefs.initial); s.onclick = () => { prefs.initial = !prefs.initial; s.classList.toggle('active'); apply(prefs); savePrefs(prefs); }; return s; })()
    ]);

    panel.append(h, r1, r2, div, r3, r4);
    return panel;
  }

  function buildFab(panel) {
    const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/></svg>';
    const btn = el('button', { class: 'ec-fab', title: '外觀設定', html: icon });
    btn.onclick = () => { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; };
    return btn;
  }

  document.addEventListener('DOMContentLoaded', function(){
    const prefs = readPrefs();
    apply(prefs);
    const panel = buildPanel(prefs);
    const fab = buildFab(panel);
    document.body.appendChild(panel);
    document.body.appendChild(fab);
  });
})();