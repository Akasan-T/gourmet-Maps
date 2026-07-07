# グルメマップ（タベマップ / TABE MAP）

外食したお店で食べたものを多面的に評価し、地図・ランキングとして蓄積していくグルメ記録アプリ。
スマホでの利用を想定したモバイルファーストの UI で、「お店を探して → 記録して → 地図と順位で振り返る」までを 1 つのアプリで完結させることを目指している。

---

## 技術スタック

| レイヤー | 技術 |
| --- | --- |
| フロントエンド | React 19 + Vite 8 / react-leaflet（Leaflet 地図） |
| バックエンド | C# / ASP.NET Core 9（Web API + Razor Pages + Identity UI） |
| データベース | SQLite（`backend/noodlemaps.db`） |
| ORM | Entity Framework Core 9 |
| 認証 | ASP.NET Core Identity（`ApplicationUser`） |
| 地図データ | OpenStreetMap タイル / Overpass API（周辺店舗検索） |
| 実行環境 | Docker Compose（frontend + backend） |

- フロントエンドは開発サーバー `http://localhost:5173`（Vite）、API のベース URL は既定で `http://localhost:5001`（`frontend/.env` の `VITE_API_BASE_URL` で変更可能）。
- Docker Compose 起動時は backend が `5001`、frontend が `3000` で公開される。

---

## 現在の全体像

現状はゲスト前提（シードした `guest` ユーザー）で動く MVP で、ログインなしでも記録・閲覧できる状態。
アプリはボトムナビゲーションで 5 つのタブを切り替えるシングルページ構成（`frontend/src/App.jsx`）。

| タブ | 画面 | 主な内容 |
| --- | --- | --- |
| ホーム | `HomeView` | 直近 24 時間の記録・簡易ランキングのスナップショット |
| 記録 | `QuickComposer` ほか | お店を検索・登録して評価を投稿するメイン入力画面 |
| 地図 | `MapView` | 記録済みの店舗を Leaflet 地図にピン表示、フィルター付き |
| 順位 | `RankView` | 総合 / ジャンル別 / 同行者別のランキング |
| 自分 | `ProfileView` | ユーザー情報・記録数などのプロフィール |

---

## データモデル（`backend/Models`）

- **Store（店舗マスタ）** — 店名・ジャンル・住所・緯度経度・外部 Place ID を持つ。評価は毎回この店舗に紐付けて蓄積する。同名かつ近接、または外部 Place ID 一致で重複排除。
- **GourmetEntry（1 回の評価記録）** — 店舗への 1 訪問分の記録。以下の評価軸を持つ:
  - `TasteRating`（味） / `CostPerformanceRating`（コスパ） / `AppearanceRating`（雰囲気・内装） / `ServiceRating`（接客） / `RepeatRating`（また行きたいか）
  - `OverallRating`（総合＝また行きたいかを基準に採用）
  - `SceneTag`（シーン: デート向き等） / `PriceRange`（価格帯） / `PhotoUrl`（写真） / `Memo`
  - `VolumeRating` / `ReorderRating` は旧項目で後方互換のため残置
- **GourmetEntryParticipant** — 記録と「一緒に行ったメンバー」の多対多中間テーブル。
- **ApplicationUser** — Identity ユーザー。`DisplayName` とバッジを持つ。
- **Badge / ApplicationUserBadge** — バッジ（実績）と、ユーザーへの付与を表す多対多。※モデル・DB のみ用意済みで、付与ロジックや UI は未実装。

---

## API エンドポイント（`backend/Controllers`）

### GourmetEntries — `api/GourmetEntries`
- `GET /` — 地図表示用の記録一覧を取得
- `POST /` — 新規記録の作成
- `GET /rankings/overall` — 総合ランキング
- `GET /rankings/genres` — ジャンル別ランキング
- `GET /rankings/companions/{memberId}` — 特定メンバーと一緒に行った店のランキング

### Stores — `api/Stores`
- `GET /?lat=&lng=&q=` — 登録済み店舗を距離の近い順に取得（キーワード絞り込み可）
- `GET /suggest?name=` — 手入力の重複を防ぐ類似店舗名サジェスト（最大 5 件）
- `POST /` — 位置検索の選択 or 手入力から店舗を登録。既存とみなせる場合は既存店舗を返す（重複排除・位置情報の補完あり）

### Members — `api/Members`
- `GET /` — メンバー（ユーザー）一覧

---

## 直近で実装した / 進行中の機能

Git 履歴とコードから見た、最近の開発の中心テーマ:

1. **店舗マスタ（Store）の導入と店舗管理** — 評価を都度お店に紐付ける構造へ移行。重複排除・類似名サジェスト・距離順取得を実装（最新コミット `feat: Add store management functionality...`）。
2. **記録フォーム（QuickComposer）の強化**
   - 現在地から Overpass API で半径約 600m の周辺飲食店を検索し、候補から選んで登録
   - 味・コスパ・雰囲気・接客・また行きたいかの多軸スコア入力
   - シーンタグ / 価格帯 / 写真（Data URL）/ メモ / 一緒に行ったメンバー選択
   - 詳細入力の開閉トグル
3. **地図（MapView）の再設計とフィルター強化**
   - 記録済み店舗をピン表示、現在地表示ボタン
   - ジャンル・訪問タイプ（メモから抽出）・最低味スコアでのフィルター
   - 店舗詳細モーダル
4. **ランキング（RankView）** — 総合 / ジャンル別 / 同行者別の 3 種類。
5. **ブランディング** — 「タベマップ / TABE MAP」への名称・アイコン・PWA マニフェスト整備。

---

## セットアップ / 起動

### Docker Compose（一括起動）
```bash
docker compose up --build
# frontend: http://localhost:3000
# backend : http://localhost:5001
```

### 個別に起動（開発時）
```bash
# バックエンド
cd backend
dotnet run          # http://localhost:5001

# フロントエンド
cd frontend
npm install
npm run dev         # http://localhost:5173
```

必要に応じて `frontend/.env`（`.env.example` を参照）で API のベース URL を設定する。
```
VITE_API_BASE_URL=http://localhost:5001
```

---

## データベースについて

- SQLite の `backend/noodlemaps.db` を使用し、起動時に `EnsureCreated()` でスキーマを用意。
- スキーマ変更に追従するため、`Program.cs` 起動処理内で `AspNetUsers.DisplayName` カラムの後付けや `Stores` / `GourmetEntries` テーブルの `CREATE TABLE IF NOT EXISTS` を実行しており、EF Migrations に完全には依存していない状態。
- 起動時にゲストユーザー（`guest`）をシードし、店舗登録者の紐付けに利用している。

---

## 今後の TODO / 未実装メモ

- バッジ（実績）機能：モデル・DB は用意済みだが付与ロジック・UI が未実装
- 認証まわり：現状はゲスト前提。ログイン／ユーザーごとの記録分離は今後
- `VolumeRating` / `ReorderRating` など旧評価項目の整理
- DB スキーマ管理を EF Migrations に一本化するか、現行の起動時 DDL 方式を継続するかの整理
