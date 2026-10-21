// JavaScript が動いたことを CSS に伝える（フェードインの初期状態はこのクラスがあるときだけ付く）
document.documentElement.classList.add('js');

// スマートフォンの幅で開閉するメニュー
function initNavToggle() {
  const button = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!button || !nav) return;

  function isOpen() {
    return button.getAttribute('aria-expanded') === 'true';
  }

  function setOpen(open) {
    nav.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
  }

  button.addEventListener('click', () => {
    setOpen(!isOpen());
  });

  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });

  // Esc キーで閉じ、開閉ボタンにフォーカスを戻す
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isOpen()) return;
    setOpen(false);
    button.focus();
  });
}

// メニューで今見ている節を示し、カギ形の枠をその項目へ移す
function initNavCursor() {
  const nav = document.getElementById('site-nav');
  const header = document.querySelector('.site-header');
  if (!nav || !header) return;

  const cursor = nav.querySelector('.nav-cursor');
  const items = [...nav.querySelectorAll('.site-nav__list a[href^="#"]')]
    .map((link) => ({ link, section: document.querySelector(link.getAttribute('href')) }))
    .filter((item) => item.section);
  if (!items.length) return;

  let currentIndex = -1;
  // メニューで選んだ節。ページの最後のほうの節は下端まで届くため、スクロールの位置だけでは決められない
  let chosenIndex = items.findIndex((item) => item.link.getAttribute('href') === window.location.hash);

  function findCurrentIndex() {
    if (chosenIndex >= 0) return chosenIndex;

    // ページの最後まで来たら、最後の節（連絡先は短く、上端が基準の線まで届かないため）
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    if (atBottom) return items.length - 1;

    // ヘッダーの下から画面の3割の位置を基準の線にし、それより上に始まった最後の節を今の節とする
    const line = header.offsetHeight + window.innerHeight * 0.3;
    let index = 0;
    items.forEach((item, i) => {
      if (item.section.getBoundingClientRect().top <= line) index = i;
    });
    return index;
  }

  function moveCursor() {
    const link = items[currentIndex]?.link;
    if (!cursor || !link) return;
    cursor.style.transform = `translate(${link.offsetLeft}px, ${link.offsetTop}px)`;
    cursor.style.width = `${link.offsetWidth}px`;
    cursor.style.height = `${link.offsetHeight}px`;
  }

  function update(force = false) {
    const index = findCurrentIndex();
    if (index === currentIndex && !force) return;
    currentIndex = index;
    items.forEach((item, i) => {
      if (i === index) item.link.setAttribute('aria-current', 'true');
      else item.link.removeAttribute('aria-current');
    });
    moveCursor();
  }

  items.forEach((item, i) => {
    item.link.addEventListener('click', () => {
      chosenIndex = i;
      update();
    });
  });

  // 自分でスクロールし始めたら、メニューで選んだ節ではなくスクロールの位置で決める
  const releaseChoice = () => {
    if (chosenIndex < 0) return;
    chosenIndex = -1;
    update();
  };
  ['wheel', 'touchstart', 'keydown'].forEach((type) => {
    window.addEventListener(type, releaseChoice, { passive: true });
  });

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      update();
      ticking = false;
    });
  }, { passive: true });

  // 画面の幅やフォントが変わると項目の位置も変わるので、置き直す
  window.addEventListener('resize', () => update(true));
  document.fonts?.ready.then(() => update(true));

  update(true);
  // 最初の位置へは滑らせずに置き、そのあとから動きを付ける
  requestAnimationFrame(() => cursor?.classList.add('is-ready'));
}

function createValueLabel(text) {
  const label = document.createElement('span');
  label.className = 'skill__value';
  label.textContent = text;
  // 読み上げでは meter の値が伝わるので、見た目の数値は重ねて読ませない
  label.setAttribute('aria-hidden', 'true');
  return label;
}

// スキルのバーに数値の文字と読み上げ用の情報を付け、data-level の長さにする
function initSkillBars() {
  const bars = document.querySelectorAll('.skill-bar[data-level]');

  bars.forEach((bar) => {
    const level = Math.min(100, Math.max(0, Number(bar.dataset.level) || 0));
    const skill = bar.closest('.skill');
    const name = skill?.querySelector('.skill__name')?.textContent ?? 'スキル';
    const head = skill?.querySelector('.skill__head');

    bar.setAttribute('role', 'meter');
    bar.setAttribute('aria-label', `${name} の習熟度`);
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', String(level));
    const lv = `Lv.${Math.round(level / 10)}`;
    bar.setAttribute('aria-valuetext', `${lv}（${level}%）`);

    if (head) {
      head.append(createValueLabel(lv));
    }

    bar.style.setProperty('--level', level);
  });
}

initNavToggle();
initNavCursor();
initSkillBars();
