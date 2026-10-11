// Küçük DOM yardımcıları: öğe oluşturma, modal, bildirim (toast), onay.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) {
          el.style.setProperty(sk, sv);
          if (sk === '--c') el.style.setProperty('--on', onColor(sv));
        } else el.style[sk] = sv;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// Bir renk zemini üzerinde okunacak yazı rengi (koyu mürekkep ya da beyaz)
export function onColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return '#fff';
  const n = parseInt(m[1], 16);
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // Beyazla kontrast ≥ 3.6 ise beyaz, değilse mürekkep
  return (1.05 / (L + 0.05)) >= 3.6 ? '#FFFFFF' : '#1A1F36';
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let modalStack = [];

export function openModal({ title, body, actions = [], wide = false, onClose }) {
  const root = document.getElementById('modal-root');
  const close = () => {
    overlay.remove();
    modalStack = modalStack.filter((m) => m !== overlay);
    document.removeEventListener('keydown', onKey);
    onClose?.();
    if (prevFocus && document.contains(prevFocus)) prevFocus.focus();
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && modalStack[modalStack.length - 1] === overlay) { e.preventDefault(); close(); }
  };
  const prevFocus = document.activeElement;
  const footer = h('div', { class: 'modal-actions' },
    actions.map((a) => h('button', {
      class: `btn ${a.kind || ''}`, type: a.submit ? 'submit' : 'button',
      onclick: a.submit ? null : (e) => a.onClick?.(e, close),
    }, a.label)));
  const dialog = h('div', { class: `modal ${wide ? 'wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'modal-head' },
      h('h2', {}, title),
      h('button', { class: 'icon-btn', 'aria-label': 'Kapat', onclick: close }, '✕')),
    h('div', { class: 'modal-body' }, body),
    actions.length ? footer : null);
  const overlay = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === overlay) close(); } }, dialog);
  root.append(overlay);
  modalStack.push(overlay);
  document.addEventListener('keydown', onKey);
  setTimeout(() => {
    if (dialog.contains(document.activeElement)) return;
    const f = dialog.querySelector('[autofocus], input, select, textarea, button.primary');
    f?.focus();
  }, 30);
  return { close, dialog };
}

export function confirmDialog({ title, message, okLabel = 'Tamam', cancelLabel = 'Vazgeç', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const m = openModal({
      title,
      body: typeof message === 'string' ? h('p', {}, message) : message,
      actions: [
        { label: cancelLabel, onClick: (e, close) => { done = true; close(); resolve(false); } },
        { label: okLabel, kind: danger ? 'danger' : 'primary', onClick: (e, close) => { done = true; close(); resolve(true); } },
      ],
      onClose: () => { if (!done) resolve(false); },
    });
    return m;
  });
}

let toastTimer;
export function toast(msg, { kind = '', action, ms = 3500 } = {}) {
  const el = document.getElementById('toast');
  el.className = `toast show ${kind}`;
  el.replaceChildren(h('span', {}, msg));
  if (action) el.append(h('button', { class: 'toast-action', onclick: () => { action.onClick(); el.className = 'toast'; } }, action.label));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, ms);
}

export function field(label, input, hint) {
  // Tek bir form öğesi değilse <label> kullanma: içindeki düğmelere tıklama ilk düğmeye de gider.
  const single = input instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(input.tagName);
  return h(single ? 'label' : 'div', { class: 'field', ...(single ? {} : { role: 'group', 'aria-label': label }) }, h('span', { class: 'field-label' }, label), input,
    hint ? h('span', { class: 'field-hint' }, hint) : null);
}

// Küçük kutlama: çini yıldızları ortadan dağılır
export function celebrate(message) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { if (message) toast(message); return; }
  const wrap = h('div', { class: 'celebrate', 'aria-hidden': 'true' });
  const colors = ['#0E8C8A', '#E8553A', '#F2B33D', '#2B47B9', '#7A4C8F', '#3FA34D'];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
    const dist = 110 + Math.random() * 90;
    const star = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    star.setAttribute('viewBox', '0 0 24 24');
    star.innerHTML = '<g fill="currentColor"><rect x="6.5" y="6.5" width="11" height="11"/><rect x="6.5" y="6.5" width="11" height="11" transform="rotate(45 12 12)"/></g>';
    star.style.setProperty('--dx', `${Math.cos(a) * dist}px`);
    star.style.setProperty('--dy', `${Math.sin(a) * dist}px`);
    star.style.setProperty('--r', `${Math.round(Math.random() * 180)}deg`);
    star.style.color = colors[i % colors.length];
    star.style.animationDelay = `${Math.random() * 80}ms`;
    wrap.append(star);
  }
  if (message) wrap.append(h('div', { class: 'celebrate-msg' }, message));
  document.body.append(wrap);
  setTimeout(() => wrap.remove(), 1700);
}
