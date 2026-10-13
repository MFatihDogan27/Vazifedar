// İlk açılış kurulumu: yeni bir kullanıcıya 3 adımda şehrini (namaz vakitleri), hangi plan türlerini
// kullanacağını ve dönem tarihlerini sorar. Yalnız hiç kaydı olmayan tarayıcıda bir kez çıkar
// (settings.onboarded). Her adım atlanabilir; hepsi sonra Ayarlar'dan değişir.
import { h, openModal, toast } from './ui.js';
import { state, commit, uid, PALET } from './store.js';
import { ILLER } from './prayer.js';
import { ic } from './icons.js';

// Kullanıcının seçebileceği hazır türler (Sınav, Görev zamanı ve Diğer uygulamanın işleyişinde
// kullanıldığı için hep kalır)
const SECMELI = ['konser', 'halisaha', 'arkadas', 'roket'];
const ADIMLAR = ['Şehrin', 'Neler yapıyorsun?', 'Dönemin'];

export function openOnboarding(go) {
  const s = state.settings;
  const sec = {
    city: ILLER.some(([n]) => n === s.prayer?.city) ? s.prayer.city : 'Ankara',
    prayer: s.prayer?.enabled !== false,
    cats: new Set(SECMELI.filter((id) => id !== 'roket' && state.categories.some((c) => c.id === id))),
    custom: [],
    start: state.term.start || '',
    end: state.term.end || '',
  };
  let step = 0;
  let finished = false;
  const body = h('div', { class: 'ob' });

  const steps = () => h('ol', { class: 'ob-steps', 'aria-label': `Adım ${step + 1} / 3` },
    ADIMLAR.map((n, i) => h('li', { class: i === step ? 'on' : i < step ? 'done' : '' }, h('span', { class: 'ob-num' }, i < step ? ic('tick', { size: 13 }) : String(i + 1)), h('span', { class: 'ob-name' }, n))));

  function cityStep() {
    const city = h('select', { 'aria-label': 'Şehir' }, ILLER.map(([n]) => h('option', { value: n }, n)));
    city.value = sec.city;
    city.onchange = () => { sec.city = city.value; };
    const sw = h('input', { type: 'checkbox', role: 'switch', checked: sec.prayer });
    sw.onchange = () => { sec.prayer = sw.checked; };
    return [
      h('p', { class: 'ob-lead' }, 'Vazifedar\'ı birkaç adımda kendine göre ayarlayalım. Hepsini sonra Ayarlar\'dan değiştirebilirsin.'),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Hangi şehirdesin?'), city,
        h('span', { class: 'field-hint' }, 'Namaz vakitleri ve kadrandaki gündüz/gece için.')),
      h('label', { class: 'switch' }, sw, h('span', {}, 'Namaz vakitlerini göster')),
      h('div', { class: 'ob-note' }, ic('device', { size: 18 }),
        h('p', {}, 'Vazifedar\'ı başka bir cihazda zaten kullanıyorsan bunları geçebilirsin: aynı Google hesabıyla bağlanınca derslerin, görevlerin ve türlerin buraya da gelir. ',
          h('button', { type: 'button', class: 'link', onclick: () => finish({ skip: true, toSettings: true }) }, 'Google ile bağlan'))),
    ];
  }

  function catsStep() {
    const chips = h('div', { class: 'ob-cats' });
    const draw = () => chips.replaceChildren(
      ...SECMELI.map((id) => state.categories.find((c) => c.id === id)).filter(Boolean).map((c) => {
        const on = sec.cats.has(c.id);
        return h('button', {
          type: 'button', class: `chip ${on ? 'on' : ''}`, style: { '--c': c.color }, 'aria-pressed': String(on),
          onclick: () => { if (on) sec.cats.delete(c.id); else sec.cats.add(c.id); draw(); },
        }, h('span', { class: 'chip-icon' }, ic(c.icon, { size: 15 })), c.name);
      }),
      ...sec.custom.map((c) => h('button', {
        type: 'button', class: 'chip on', style: { '--c': c.color }, title: 'Kaldır', 'aria-label': `${c.name} türünü kaldır`,
        onclick: () => { sec.custom = sec.custom.filter((x) => x !== c); draw(); },
      }, h('span', { class: 'chip-icon' }, ic('pin', { size: 15 })), c.name, ' ✕')));
    draw();
    const inp = h('input', { type: 'text', placeholder: 'Örn. Spor salonu, Kurs, Gönüllülük', maxlength: 40, 'aria-label': 'Kendi türün' });
    const add = () => {
      const name = inp.value.trim();
      if (!name) return;
      const taken = new Set([...state.categories.map((c) => c.color), ...sec.custom.map((c) => c.color)]);
      const color = PALET.find((p) => !taken.has(p)) || PALET[(state.categories.length + sec.custom.length) % PALET.length];
      sec.custom.push({ name, color });
      inp.value = ''; inp.focus(); draw();
    };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    return [
      h('p', { class: 'ob-lead' }, 'Planlarının türlerini seç. Her tür takvimde kendi rengi ve deseniyle görünür; hızlı ekleme kutusu da türü yazdığından anlar.'),
      chips,
      h('div', { class: 'row grow' }, inp, h('button', { type: 'button', class: 'btn', onclick: add }, 'Ekle')),
      h('p', { class: 'muted small' }, 'Sınav, Görev zamanı ve Diğer her zaman var. Rengini, ikonunu ve süresini Ayarlar → Kategoriler\'den değiştirebilirsin.'),
    ];
  }

  function termStep() {
    const st = h('input', { type: 'date', value: sec.start });
    const en = h('input', { type: 'date', value: sec.end });
    st.onchange = () => { sec.start = st.value; };
    en.onchange = () => { sec.end = en.value; };
    return [
      h('p', { class: 'ob-lead' }, 'Öğrenciysen dönemin başlangıç ve bitiş tarihlerini yaz. Ders programın bu tarihler arasında her hafta takvimde görünür; bitince kendiliğinden kalkar.'),
      h('div', { class: 'grid-2' },
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Dönem başlangıcı'), st),
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Dönem sonu'), en)),
      h('p', { class: 'muted small' }, 'Öğrenci değilsen boş bırak. Tatilleri ve derslerini Dersler sayfasından eklersin.'),
    ];
  }

  function draw() {
    body.replaceChildren(steps(), ...[cityStep, catsStep, termStep][step]());
    const [skip, back, next] = m.dialog.querySelectorAll('.modal-actions button');
    back.hidden = step === 0;
    skip.hidden = step === 2;
    next.textContent = step === 2 ? 'Bitir' : 'İleri';
    m.dialog.querySelector('.modal-head h2').textContent = step === 0 ? 'Hoş geldin' : ADIMLAR[step];
    setTimeout(() => body.querySelector('select, input:not([type=checkbox])')?.focus(), 30);
  }

  function finish({ skip = false, toSettings = false } = {}) {
    if (finished) return;
    finished = true;
    if (!skip) {
      // Şehir ve namaz vakitleri (cihaza özel)
      const il = ILLER.find(([n]) => n === sec.city);
      if (il) [s.prayer.city, s.prayer.lat, s.prayer.lng] = il;
      s.prayer.enabled = sec.prayer;
      // Plan türleri: seçilmeyen hazır türleri kaldır (kullanan bir plan varsa kalsın)
      const used = new Set(state.events.map((e) => e.categoryId));
      state.categories = state.categories.filter((c) => !SECMELI.includes(c.id) || sec.cats.has(c.id) || used.has(c.id));
      for (const c of sec.custom) {
        state.categories.push({ id: `k${uid().slice(0, 8)}`, name: c.name, color: c.color, icon: 'pin', duration: 60, reminder: 30 });
      }
      // Roket takımı seçilmediyse görev türlerinden de kalksın
      if (!sec.cats.has('roket') && !state.tasks.some((t) => t.categoryId === 'roket')) state.taskCategories = state.taskCategories.filter((c) => c.id !== 'roket');
      // Dönem
      if (sec.start && sec.end && sec.end > sec.start) { state.term.start = sec.start; state.term.end = sec.end; }
    }
    s.onboarded = true;
    commit('settings');
    m.close();
    if (toSettings) { go('settings'); return; }
    if (!skip && state.term.start && state.term.end) {
      go('courses');
      toast('Hazır! Şimdi derslerini ekle: her biri için gün ve saatleri bir kez gir.', { ms: 6000 });
    } else if (!skip) toast('Hazır! Üstteki kutuya "cuma 20:00 halısaha" gibi yazarak ilk planını ekleyebilirsin.', { ms: 6000 });
  }

  const m = openModal({
    title: 'Hoş geldin',
    body,
    actions: [
      { label: 'Atla', kind: 'ghost left', onClick: () => finish({ skip: true }) },
      { label: 'Geri', onClick: () => { step = Math.max(0, step - 1); draw(); } },
      {
        label: 'İleri', kind: 'primary', onClick: () => {
          if (step === 2) {
            if (sec.start && sec.end && sec.end <= sec.start) { toast('Dönem sonu başlangıçtan sonra olmalı', { kind: 'warn' }); return; }
            finish(); return;
          }
          step++; draw();
        },
      },
    ],
    // Pencere kapatılırsa bir daha sorma (her şey Ayarlar'dan değişir)
    onClose: () => { if (!finished) { finished = true; s.onboarded = true; commit('settings'); } },
  });
  m.dialog.classList.add('ob-modal');
  draw();
}
