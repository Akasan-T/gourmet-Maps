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
| 地図データ | OpenStreetMap タイル / Google Places API (New)（バックエンドが代理呼び出し）・Overpass API（フォールバックの周辺検索） |
| 実行環境 | Docker Compose（frontend + backend） |

- フロントエンドは開発サーバー `http://localhost:5173`（Vite）、API のベース URL は既定で `http://localhost:5001`（`frontend/.env` の `VITE_API_BASE_URL` で変更可能）。
- Docker Compose 起動時は backend が `5001`、frontend が `3000` で公開される。

---

## 現在の全体像

**招待コード制のログインが必要**な構成（身内・少人数での利用を想定）。メールアドレスは平文では保存せず、サーバー秘密鍵による HMAC-SHA256 ハッシュに変換して扱う。最初の 1 人は設定の固定合言葉（`Auth:InviteCode`）で登録し「初代食べる王」称号を得る。以降はその保有者が発行するワンタイム招待コードで登録する。ログイン後はボトムナビゲーションで 5 つのタブを切り替えるシングルページ構成（`frontend/src/App.jsx`）。

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
- **Badge / ApplicationUserBadge** — バッジ（実績・称号）と、ユーザーへの付与を表す多対多。称号は `titles.json` を基準に `TitleEvaluationService` が達成判定・自動付与し、プロフィールの称号図鑑（`TitlesModal`）で閲覧できる。「初代食べる王」称号の保有者だけがワンタイム招待コードを発行できる。

---

## API エンドポイント（`backend/Controllers`・`Program.cs`）

> データ系エンドポイントはすべて `[Authorize]`（Bearer トークン）で保護。認証系は送信元 IP 単位のレート制限付き。

### 認証 — `api/auth`
- `POST /register` — 招待コード制の新規登録（`Program.cs` の独自ミドルウェアが横取り。ワンタイム招待 or ブートストラップ固定合言葉を検証し、メールはハッシュ化して保存）
- `POST /login` — ログイン（メールをハッシュ化して照合し、Bearer アクセス/リフレッシュトークンを発行）
- `POST /refresh` — トークン更新（`MapIdentityApi`）
- `POST /forgotPassword` — リセットコード発行（メール列挙対策で常に 200。6 桁コードを 15 分だけメモリ保持しメール送信）
- `POST /resetPassword` — 6 桁コードで新パスワードを設定

### Account — `api/account`
- `GET /me` — ログイン中ユーザーの情報
- `PUT /me` — 表示名 / アイコン画像の更新

### Invites — `api/invites` / Titles — `api/titles`
- `POST /api/invites` — ワンタイム招待コードの発行（「初代食べる王」称号保有者のみ、非保有者は 403）
- `GET /api/invites` — 発行済み招待コード一覧
- `GET /api/titles` — 称号図鑑（達成状況付き）

### Places — `api/places`
- `GET /search?lat=&lng=&q=&radiusMeters=` — Google Places (New) をサーバー側で代理検索（API キーはバックエンドのみが保持）

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
   - 現在地から周辺飲食店を検索（Google Places (New) をバックエンド経由で呼び出し、Overpass はフォールバック。半径約 600m）、候補から選んで登録
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

## スマホで動作確認する（HTTPS トンネル）

実機のスマホでフローを試す / 数人に仮運用で触ってもらう場合の手順。**追加のサーバーは不要**で、cloudflared のクイックトンネルが公開 URL を貸してくれる（Mac が起動している間だけ有効）。

> **なぜトンネルが必要か**：「現在地取得（geolocation）」はモバイルブラウザでは HTTPS（secure context）でないと動かないため、LAN の `http://192.168.x.x` では確認できない。トンネルで HTTPS 化し、あわせて Vite の `/api` プロキシでフロントと backend を**同一オリジンに束ねる**ことで、CORS もログイン（`Authorization: Bearer`）もそのまま通る。

### 構成
```
スマホ ─HTTPS→ cloudflared ─→ Vite(5173) ─/api プロキシ→ backend(5001)
```
起動順は **docker → Vite → cloudflared**。この 3 つが動いている間だけ URL が生きる。

### 事前準備（初回のみ）
```bash
brew install cloudflared qrencode
```
- `frontend/vite.config.js` … `server.host` / `allowedHosts` / `/api` プロキシを設定済み
- `frontend/.env` … トンネル時は `VITE_API_BASE_URL=`（空＝相対パス）にする。デスクトップから backend を直接叩く運用に戻すときはコメントの値に戻す

### 起動
```bash
docker compose up -d     # backend(5001) 等。起動済みならスキップ
./dev-tunnel.sh          # Vite + トンネルを起動し、公開 URL と QR コードを表示
```
表示された `https://xxxx.trycloudflare.com` をスマホで開く（QR を読むのが早い）。

### 停止
- Vite・トンネル … `dev-tunnel.sh` のターミナルで **Ctrl-C**
- backend 等も止める … `docker compose down`

### 注意点
- **URL は起動のたびに変わる**。共有中に張り替わるとリンク切れになる（固定したい場合は Cloudflare アカウント＋named tunnel が必要）。
- `dotnet run` 単体で backend を動かす場合はポートが `5298` になる（`launchSettings.json`）。その場合は `vite.config.js` の proxy `target` を合わせる。
- **他人に開放する場合のメール**：新規登録の確認メール・パスワードリセットは開発では Mailpit（`localhost:8025`）止まりで、リモートの相手には届かない。自分だけの確認ならオーナーアカウントでログインするだけでよい。外部に配るなら実 SMTP（Resend 等の無料枠）設定か、手動でのアカウント発行が必要。

---

## データベースについて

- SQLite の `backend/noodlemaps.db` を使用。**スキーマは EF Core Migrations で一元管理**する（`backend/Migrations/`）。起動時に `Program.cs` が `Database.Migrate()` を実行し、未適用のマイグレーションを適用する。
- 旧方式（`EnsureCreated()` + 起動時の手書き DDL/ALTER）で作られた既存 DB は、初回起動時に自動でベースライン登録される（`InitialCreate` を「適用済み」として `__EFMigrationsHistory` に記録し、テーブルは作り直さない）。そのためデータを保持したまま Migrations 管理下へ移行できる。
- 起動時にゲストユーザー（`guest-map`）・設定の `Members` に列挙したメンバー・「初代食べる王」称号をシードする。

### マイグレーションの追加

```bash
cd backend
dotnet dotnet-ef migrations add <MigrationName>   # モデル変更後にマイグレーションを生成
dotnet dotnet-ef database update                  # ローカル DB へ適用（通常は起動時に自動適用される）
```

`dotnet-ef` はローカルツール（`backend/dotnet-tools.json`）として固定済み。設計時は `GourmetDbContextFactory` が使われるため、`Program.cs` のシード処理は実行されない。

---

## テスト

| 種別 | 場所 | 実行 |
| --- | --- | --- |
| バックエンド統合テスト（xUnit + `WebApplicationFactory`） | `backend.Tests/` | `cd backend.Tests && dotnet test` |
| フロントエンド E2E（Playwright） | `frontend/e2e/` | `cd frontend && npm run test:e2e` |

- 統合テストは実際の `Program.cs` を起動し、テストごとに独立した一時 SQLite DB を使って認証フロー（招待コード登録・ログイン・認可）を検証する。
- E2E は Vite 開発サーバーを自動起動し、API を `page.route` でモックしてバックエンド無しでも動く（初回のみ `npx playwright install chromium` が必要）。
- 手動テストケースの網羅設計は別途スプレッドシートと GitHub Issue で管理している（E2E 54 ケース）。

---

## 今後の TODO / 未実装メモ

- `VolumeRating` / `ReorderRating` など旧評価項目の整理
- テストカバレッジの拡充（記録投稿・地図フィルター・ランキングの E2E 自動化）
- 本番公開時のシークレット供給（`backend/.env` / 環境変数）と実 SMTP 設定の整備（`backend/.env.example` 参照）
