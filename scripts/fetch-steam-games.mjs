// Steam から遊んだゲームの一覧を取り、data/steam-games.json に書き出す。
// GitHub Actions（.github/workflows/steam-games.yml）が毎日動かす。
// API キーはページに載せられないので、ここで取ってきたものだけをページが読む。
//
// 手元で動かすとき: STEAM_API_KEY=キー STEAM_ID=76561199681275619 node scripts/fetch-steam-games.mjs

import { mkdir, writeFile } from 'node:fs/promises';

const OUTPUT = new URL('../data/steam-games.json', import.meta.url);
// ページに出すのは、合計で2時間（120分）以上遊んだゲームだけ
const MIN_PLAYTIME_MINUTES = 120;

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

const games = body.games
  .filter((game) => game.playtime_forever >= MIN_PLAYTIME_MINUTES)
  .map((game) => ({
    appid: game.appid,
    name: game.name,
    // 分単位
    playtimeForever: game.playtime_forever,
    playtime2Weeks: game.playtime_2weeks ?? 0,
    // UNIX 時間（秒）。記録がないゲームは 0
    lastPlayed: game.rtime_last_played ?? 0,
  }))
  .sort((a, b) => b.playtimeForever - a.playtimeForever);

await mkdir(new URL('.', OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify({ updatedAt: new Date().toISOString(), games }, null, 2)}\n`);
console.log(`${games.length} 本のゲームを書き出しました`);
