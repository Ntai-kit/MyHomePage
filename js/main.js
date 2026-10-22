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
  // 左上、右上、左下、右下の順
  const corners = cursor ? [...cursor.querySelectorAll('.nav-cursor__corner')] : [];
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

    // ヘッダーの下から画面の3割の位置を基準の線にし、それより上に始まった最後の節を今の節とする。
    // どの節もまだ線に届いていない（最初の画面を見ている）ときは -1
    const line = header.offsetHeight + window.innerHeight * 0.3;
    let index = -1;
    items.forEach((item, i) => {
      if (item.section.getBoundingClientRect().top <= line) index = i;
    });
    return index;
  }

  function moveCursor() {
    const link = items[currentIndex]?.link;
    if (!cursor || !link || corners.length !== 4) {
      cursor?.classList.toggle('is-hidden', !link);
      return;
    }
    // 位置と大きさを先にまとめて読み、そのあとで書き込む（読み書きを交互にすると、そのたびにレイアウトが計算し直される）
    const { offsetLeft: left, offsetTop: top, offsetWidth: width, offsetHeight: height } = link;
    const size = corners[0].offsetWidth;
    const right = left + width - size;
    const bottom = top + height - size;

    cursor.classList.remove('is-hidden');
    [[left, top], [right, top], [left, bottom], [right, bottom]].forEach(([x, y], i) => {
      corners[i].style.transform = `translate(${x}px, ${y}px)`;
    });
  }

  function update(force = false) {
    const index = findCurrentIndex();
    if (index === currentIndex && !force) return;
    currentIndex = index;
    items.forEach((item, i) => {
      if (i === index) item.link.setAttribute('aria-current', 'location');
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

// プレイしたゲームの一覧。data/steam-games.json を読み、選んだ順に並べる
function initSteamGames() {
  const list = document.getElementById('games-list');
  const summary = document.getElementById('games-summary');
  const select = document.getElementById('games-sort');
  if (!list || !summary || !select) return;

  const hours = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 });
  const date = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium' });
  // 名前の中の数字は数として比べる（「2」を「10」より前にする）
  const collator = new Intl.Collator('ja', { numeric: true });

  // 並べ替えの順。同じ値のときはプレイ時間の長い順にする
  const byPlaytime = (a, b) => b.playtimeForever - a.playtimeForever;
  const compare = {
    playtime: byPlaytime,
    recent: (a, b) => b.lastPlayed - a.lastPlayed || byPlaytime(a, b),
    name: (a, b) => collator.compare(a.name, b.name),
    twoWeeks: (a, b) => b.playtime2Weeks - a.playtime2Weeks || byPlaytime(a, b),
  };

  function createCard(game) {
    const link = document.createElement('a');
    link.className = 'game-card';
    link.href = `https://store.steampowered.com/app/${game.appid}/`;

    // 名前は横に文字で出すので、画像は読み上げない
    const image = document.createElement('img');
    image.className = 'game-card__image';
    image.src = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.appid}/header.jpg`;
    image.alt = '';
    image.width = 460;
    image.height = 215;
    image.loading = 'lazy';
    image.decoding = 'async';
    // 画像のないゲームは、画像の場所を消して名前だけにする
    image.addEventListener('error', () => image.remove(), { once: true });

    const body = document.createElement('div');
    body.className = 'game-card__body';

    const name = document.createElement('p');
    name.className = 'game-card__name';
    name.translate = false;
    name.textContent = game.name;

    const meta = [`合計 ${hours.format(game.playtimeForever / 60)} 時間`];
    if (game.playtime2Weeks > 0) meta.push(`最近2週間 ${hours.format(game.playtime2Weeks / 60)} 時間`);
    if (game.lastPlayed > 0) meta.push(`最終プレイ ${date.format(game.lastPlayed * 1000)}`);
    const metaLines = meta.map((text) => {
      const line = document.createElement('p');
      line.className = 'game-card__meta';
      line.textContent = text;
      return line;
    });

    body.append(name, ...metaLines);
    link.append(image, body);

    const item = document.createElement('li');
    item.append(link);
    return item;
  }

  const moreWrap = document.querySelector('.games__more-wrap');
  const moreButton = moreWrap?.querySelector('.games__more');

  let games = [];
  let expanded = false;

  // 閉じている間は1行目のカードだけを出す。1行に並ぶ数は画面の幅で変わるので、グリッドの列の数を数える
  function applyLimit() {
    const columns = getComputedStyle(list).gridTemplateColumns.split(' ').length;
    const items = [...list.children];
    items.forEach((item, i) => {
      item.hidden = !expanded && i >= columns;
    });

    const rest = items.length - columns;
    if (!moreWrap || !moreButton) return;
    moreWrap.hidden = rest <= 0;
    moreButton.setAttribute('aria-expanded', String(expanded));
    moreButton.textContent = expanded ? '閉じる' : `もっとみる（残り ${rest} 本）`;
  }

  function render() {
    const sorted = [...games].sort(compare[select.value] ?? byPlaytime);
    list.replaceChildren(...sorted.map(createCard));
    applyLimit();
  }

  select.addEventListener('change', render);

  moreButton?.addEventListener('click', () => {
    expanded = !expanded;
    applyLimit();
  });

  // 画面の幅が変わると1行に並ぶ数も変わるので、出すカードを選び直す
  window.addEventListener('resize', () => {
    if (games.length) applyLimit();
  });

  fetch('data/steam-games.json')
    .then((response) => {
      if (!response.ok) throw new Error(`status ${response.status}`);
      return response.json();
    })
    .then((data) => {
      games = Array.isArray(data.games) ? data.games : [];
      if (!games.length) {
        summary.textContent = 'まだゲームの記録がありません。';
        select.disabled = true;
        return;
      }
      const updated = data.updatedAt ? `（${date.format(new Date(data.updatedAt))} 時点）` : '';
      summary.textContent = `Steam で2時間以上遊んだゲーム ${games.length} 本${updated}`;
      render();
    })
    .catch(() => {
      summary.textContent = 'ゲームの一覧を読み込めませんでした。時間をおいて、ページを読み込み直してください。';
      select.disabled = true;
    });
}

// お問い合わせフォーム。ページを移らずに Formspree へ送り、結果をフォームの下に出す
// （JavaScript が動かないときは、ふつうのフォームとして送られ、Formspree の完了ページに移る）
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const button = form.querySelector('.contact-form__submit');
  const status = form.querySelector('.contact-form__status');
  const firstInput = form.querySelector('.contact-form__input');

  // 「お問い合わせ」のリンクを押したら、スクロールしたうえで最初の入力欄を選んだ状態にする。
  // リンク先への移動が済んでから選ばないと、移動のときにフォーカスが外れる
  document.querySelectorAll('a[href="#contact-form"]').forEach((link) => {
    link.addEventListener('click', () => {
      setTimeout(() => firstInput?.focus({ preventScroll: true }), 0);
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    // 送信中は二度送らない。disabled にすると押したボタンからフォーカスが外れるので、aria-disabled で示す
    if (button.getAttribute('aria-disabled') === 'true') return;
    button.setAttribute('aria-disabled', 'true');
    status.textContent = '送信しています…';

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      form.reset();
      status.textContent = '送信しました。お問い合わせありがとうございます。';
    } catch {
      status.textContent = '送信できませんでした。時間をおいて、もう一度お試しください。';
    } finally {
      button.removeAttribute('aria-disabled');
    }
  });
}

initNavToggle();
initNavCursor();
initSkillBars();
initSteamGames();
initContactForm();
