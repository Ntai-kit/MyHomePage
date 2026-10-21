// JavaScript が動いたことを CSS に伝える（フェードインの初期状態はこのクラスがあるときだけ付く）
document.documentElement.classList.add('js');

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// スマートフォンの幅で開閉するメニュー
function initNavToggle() {
  const button = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!button || !nav) return;

  function setOpen(open) {
    nav.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
  }

  button.addEventListener('click', () => {
    setOpen(button.getAttribute('aria-expanded') !== 'true');
  });

  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
}

// 画面に入った要素に処理をする。動きを止める設定や古いブラウザでは、すぐに処理する
function onVisible(elements, callback) {
  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    elements.forEach(callback);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      callback(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.15 });

  elements.forEach((element) => observer.observe(element));
}

// スクロールで各セクションをフェードイン
function initReveal() {
  onVisible(document.querySelectorAll('.reveal'), (element) => {
    element.classList.add('is-visible');
  });
}

// スキルのバーを data-level の長さまで伸ばす
function initSkillBars() {
  onVisible(document.querySelectorAll('.skill-bar[data-level]'), (bar) => {
    const level = Math.min(100, Math.max(0, Number(bar.dataset.level) || 0));
    bar.style.setProperty('--level', level);
  });
}

initNavToggle();
initReveal();
initSkillBars();
