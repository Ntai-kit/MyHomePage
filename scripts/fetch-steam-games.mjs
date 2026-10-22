// Steam から遊んだゲームの一覧を取り、data/steam-games.json に書き出す。
// GitHub Actions（.github/workflows/steam-games.yml）が毎日動かす。
// API キーはページに載せられないので、ここで取ってきたものだけをページが読む。
//
// 手元で動かすとき: STEAM_API_KEY=キー STEAM_ID=76561199681275619 node scripts/fetch-steam-games.mjs

import { mkdir, writeFile } from 'node:fs/promises';

const OUTPUT = new URL('../data/steam-games.json', import.meta.url);
// ページに出すのは、合計で2時間（120分）以上遊んだゲームだけ
const MIN_PLAYTIME_MINUTES = 120;

// 成人向けのゲームは出さない。Steam が付ける区分の 3（成人向けの性的内容）と
// 4（頻繁なヌードや性的内容）、ユーザーが付けるタグの「変態」（Hentai）のどれかがあれば除く。
// 「性的表現」「ヌード」のタグは一般向けの大作にも付くので、判定に使わない
const ADULT_CONTENT_DESCRIPTORS = new Set([3, 4]);
const ADULT_TAGS = new Set([9130]);
// ストアの情報は、まとめて何本ずつ問い合わせるか
const STORE_BATCH_SIZE = 50;

const key = process.env.STEAM_API_KEY;
const steamId = process.env.STEAM_ID;
if (!key || !steamId) {
  console.error('STEAM_API_KEY と STEAM_ID を環境変数で渡してください');
  process.exit(1);
}

const url = new URL('https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/');
url.search = new URLSearchParams({
  key,
  steamid: steamId,
  include_appinfo: '1',
  include_played_free_games: '1',
  format: 'json',
});

const response = await fetch(url);
if (!response.ok) {
  // URL にはキーが入っているので、エラーの文言には出さない
  console.error(`Steam の API がエラーを返しました（status ${response.status}）`);
  process.exit(1);
}

const { response: body } = await response.json();
// プロフィールの「ゲームの詳細」が非公開だと、games がない空の返事が来る
if (!body?.games) {
  console.error('ゲームの一覧が空でした。Steam のプライバシー設定で「ゲームの詳細」が公開になっているか確かめてください');
  process.exit(1);
}

const played = body.games.filter((game) => game.playtime_forever >= MIN_PLAYTIME_MINUTES);

// ストアから、各ゲームの区分とタグと画像の場所を取る（この API はキーが要らない）
async function fetchStoreItems(appids) {
  const input = {
    ids: appids.map((appid) => ({ appid })),
    context: { language: 'japanese', country_code: 'JP' },
    data_request: { include_tag_count: 20, include_assets: true },
  };
  const storeUrl = new URL('https://api.steampowered.com/IStoreBrowseService/GetItems/v1/');
  storeUrl.searchParams.set('input_json', JSON.stringify(input));
  const storeResponse = await fetch(storeUrl);
  if (!storeResponse.ok) {
    // 判定できないまま一覧を出さないよう、ここで止める
    console.error(`Steam のストアの API がエラーを返しました（status ${storeResponse.status}）`);
    process.exit(1);
  }
  const { response: storeBody } = await storeResponse.json();
  return storeBody?.store_items ?? [];
}

const adultAppids = new Set();
// ストアの横長の画像（460×215）の URL。新しいゲームは画像のファイル名が決まった形ではないので、ストアが返す名前を使う
const headerImages = new Map();
for (let i = 0; i < played.length; i += STORE_BATCH_SIZE) {
  const items = await fetchStoreItems(played.slice(i, i + STORE_BATCH_SIZE).map((game) => game.appid));
  for (const item of items) {
    const { asset_url_format: format, header } = item.assets ?? {};
    if (format && header) {
      headerImages.set(item.appid, `https://shared.akamai.steamstatic.com/store_item_assets/${format.replace('${FILENAME}', header)}`);
    }

    const descriptors = item.content_descriptorids ?? [];
    const tags = (item.tags ?? []).map((tag) => tag.tagid);
    if (descriptors.some((id) => ADULT_CONTENT_DESCRIPTORS.has(id)) || tags.some((id) => ADULT_TAGS.has(id))) {
      adultAppids.add(item.appid);
    }
  }
}
// 名前はログに出さず、本数だけ出す（Actions のログは公開リポジトリだと誰でも見られる）
console.log(`成人向けのゲーム ${adultAppids.size} 本を除きました`);

// 最終プレイは、日本時間の日付（2026-10-22 の形）までに丸める。
// JSON は誰でも見られるので、時刻まで載せると何時ごろ遊んでいるかが分かってしまう
const jstDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' });
const toPlayedDate = (seconds) => (seconds > 0 ? jstDate.format(seconds * 1000) : null);

const games = played
  .filter((game) => !adultAppids.has(game.appid))
  .map((game) => ({
    appid: game.appid,
    name: game.name,
    // 分単位
    playtimeForever: game.playtime_forever,
    playtime2Weeks: game.playtime_2weeks ?? 0,
    // 日本時間の日付。記録がないゲームは null
    lastPlayedDate: toPlayedDate(game.rtime_last_played ?? 0),
    // ストアから取れなかったときは null（ページが決まった形の URL を試す）
    headerImage: headerImages.get(game.appid) ?? null,
  }))
  .sort((a, b) => b.playtimeForever - a.playtimeForever);

await mkdir(new URL('.', OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify({ updatedAt: new Date().toISOString(), games }, null, 2)}\n`);
console.log(`${games.length} 本のゲームを書き出しました`);
