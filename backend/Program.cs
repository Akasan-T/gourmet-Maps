using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using GourmetMaps.Data;
using GourmetMaps.Models;
using GourmetMaps.Services;

// backend/.env (gitignored) から開発用の秘密情報を読み込む。存在しなければ何もしない。
// Places__GoogleApiKey のように "__" 区切りにしておくと、ASP.NET Core の環境変数プロバイダが
// 自動で "Places:GoogleApiKey" として設定に反映してくれる。
LoadDotEnvFile(Path.Combine(Directory.GetCurrentDirectory(), ".env"));

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendClient", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:5173",
                "http://127.0.0.1:5173")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});


// SQLiteの接続文字列
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Data Source=gourmetmaps.db";
builder.Services.AddDbContext<GourmetDbContext>(options => options.UseSqlite(connectionString));

// Identity の既定エラーメッセージ(英語)を日本語に置き換える。AddIdentityApiEndpoints より前に
// 登録することで、内部の TryAdd による既定実装への上書きを防ぐ。
builder.Services.AddSingleton<IdentityErrorDescriber, JapaneseIdentityErrorDescriber>();

// SPA から利用する Bearer トークン / Cookie ベースの認証 API エンドポイント
builder.Services
    .AddIdentityApiEndpoints<ApplicationUser>(options => options.SignIn.RequireConfirmedAccount = true)
    .AddEntityFrameworkStores<GourmetDbContext>();

builder.Services.AddAuthorization();

// パスワードリセットの短いコードと本来の(長い) Identity トークンとの対応を一時保存する。
builder.Services.AddMemoryCache();

// メール送信: SMTP経由で送る。開発環境では docker-compose の Mailpit (localhost:1025)、
// 本番では appsettings の "Smtp" セクションに実際のSMTPサーバーを設定する。
builder.Services.AddTransient<IEmailSender<ApplicationUser>, SmtpEmailSender>();

// 称号 (titles.json) の達成判定・自動付与
builder.Services.AddScoped<TitleEvaluationService>();

// Google Places API (New) 呼び出し用 (APIキーはバックエンドのみが保持する)
builder.Services.AddHttpClient("GooglePlaces", client =>
{
    client.Timeout = TimeSpan.FromSeconds(10);
});

// 認証まわりの機微なエンドポイント (login / register / forgotPassword / resetPassword) に
// 送信元IP単位のレート制限をかける。特にパスワードリセットの6桁コードは総当たり
// (100万通り) が可能なため、IPあたりの試行回数を厳しく絞ってブルートフォースを防ぐ。
// これらは MapIdentityApi ではなく手前の独自ミドルウェアが処理するため、エンドポイント
// メタデータではなく GlobalLimiter でパスを見て適用する。
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
    {
        var path = context.Request.Path.Value ?? string.Empty;

        var limit = path switch
        {
            _ when path.Equals("/api/auth/resetPassword", StringComparison.OrdinalIgnoreCase)
                => (Bucket: "auth-reset", Permit: 10, Window: TimeSpan.FromMinutes(5)),
            _ when path.Equals("/api/auth/forgotPassword", StringComparison.OrdinalIgnoreCase)
                => (Bucket: "auth-forgot", Permit: 5, Window: TimeSpan.FromMinutes(5)),
            _ when path.Equals("/api/auth/login", StringComparison.OrdinalIgnoreCase)
                => (Bucket: "auth-login", Permit: 10, Window: TimeSpan.FromMinutes(1)),
            _ when path.Equals("/api/auth/register", StringComparison.OrdinalIgnoreCase)
                => (Bucket: "auth-register", Permit: 5, Window: TimeSpan.FromMinutes(1)),
            // Google Places 代理検索は課金対象。通常利用は妨げず、暴走呼び出しだけを抑える。
            _ when path.Equals("/api/places/search", StringComparison.OrdinalIgnoreCase)
                => (Bucket: "places", Permit: 60, Window: TimeSpan.FromMinutes(1)),
            _ => (Bucket: string.Empty, Permit: 0, Window: TimeSpan.Zero),
        };

        // 対象外のパスは無制限
        if (limit.Bucket.Length == 0)
        {
            return RateLimitPartition.GetNoLimiter("__unlimited__");
        }

        var clientIp = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(
            $"{limit.Bucket}:{clientIp}",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = limit.Permit,
                Window = limit.Window,
                QueueLimit = 0,
            });
    });

    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { detail = "リクエストが多すぎます。しばらく待ってから再度お試しください。" }, token);
    };
});

// 未処理例外を JSON (ProblemDetails) で返すための土台。ApiExceptionHandler が /api 配下を担当する。
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GourmetMaps.Services.ApiExceptionHandler>();

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddRazorPages();

// --- ローカリゼーションサービスの設定 ---
builder.Services.AddLocalization( options => options.ResourcesPath = "Resources");
builder.Services.AddMvc().AddViewLocalization();

var app = builder.Build();

var supportedCultures = new[] { "ja-JP" };
var localizationOptions = new RequestLocalizationOptions().SetDefaultCulture(supportedCultures[0])
    .AddSupportedCultures(supportedCultures)
    .AddSupportedUICultures(supportedCultures);
const string guestUserName = "guest-map";
const string guestUserEmail = "guest-map@example.local";

// Configure the HTTP request pipeline.
// 例外ハンドラは最も外側に置く。/api は ApiExceptionHandler が JSON(ProblemDetails) を返し、
// それ以外は /Error(Razor) にフォールバックする。開発時は登録せず開発者例外ページを使う。
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

// 基本的なセキュリティレスポンスヘッダー。MIME スニッフィング抑止・クリックジャッキング防止など。
app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "DENY";
    headers["Referrer-Policy"] = "no-referrer";
    headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.tile.openstreetmap.org; connect-src 'self' https://overpass-api.de; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
    headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(self)";
    await next();
});

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<GourmetDbContext>();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    // --- スキーマは EF Migrations で一元管理する ---
    // 旧方式 (EnsureCreated + 起動時の手書き DDL/ALTER) で作られた既存 DB には
    // __EFMigrationsHistory が無い。その場合はテーブルを作り直さず、InitialCreate を
    // 「適用済み」としてベースライン登録してから Migrate() する。新規 DB では Migrate() が
    // 全マイグレーションを通常どおり適用してスキーマを構築する。
    await BaselineLegacyDatabaseAsync(dbContext);
    await dbContext.Database.MigrateAsync();

    // 既存エントリを店舗マスタへバックフィル (StoreID 未設定のものを店名で束ねる)
    var unlinkedEntries = await dbContext.GourmetEntries
        .Where(entry => entry.StoreID == null)
        .ToListAsync();

    if (unlinkedEntries.Count > 0)
    {
        var storesByName = await dbContext.Stores
            .ToDictionaryAsync(store => store.Name, store => store, StringComparer.OrdinalIgnoreCase);

        foreach (var group in unlinkedEntries.GroupBy(entry => entry.Name))
        {
            if (!storesByName.TryGetValue(group.Key, out var store))
            {
                var located = group.FirstOrDefault(entry => entry.Latitude != null && entry.Longitude != null);
                store = new Store
                {
                    Name = group.Key,
                    Genre = group.OrderByDescending(entry => entry.VisitDate).First().Genre,
                    Latitude = located?.Latitude,
                    Longitude = located?.Longitude,
                    CreatedAt = DateTime.UtcNow,
                };
                dbContext.Stores.Add(store);
                await dbContext.SaveChangesAsync();
                storesByName[group.Key] = store;
            }

            foreach (var entry in group)
            {
                entry.StoreID = store.StoreID;
            }
        }

        await dbContext.SaveChangesAsync();
    }

    var guestUser = await userManager.FindByNameAsync(guestUserName);
    if (guestUser is null)
    {
        await userManager.CreateAsync(new ApplicationUser
        {
            UserName = guestUserName,
            Email = guestUserEmail,
            EmailConfirmed = true,
            DisplayName = "Guest Map User"
        });
    }

    var memberNames = builder.Configuration.GetSection("Members").Get<string[]>() ?? [];
    foreach (var memberName in memberNames)
    {
        var trimmedName = memberName.Trim();
        if (trimmedName.Length == 0)
        {
            continue;
        }

        var existingMember = await userManager.Users
            .SingleOrDefaultAsync(user => user.DisplayName == trimmedName);
        if (existingMember is not null)
        {
            continue;
        }

        var memberUserName = $"member-{Guid.NewGuid():N}";
        await userManager.CreateAsync(new ApplicationUser
        {
            UserName = memberUserName,
            Email = $"{memberUserName}@example.local",
            EmailConfirmed = true,
            DisplayName = trimmedName
        });
    }

    await SeedDemoDataAsync(dbContext, userManager);

    // 特別称号「初代食べる王」をシードし、設定のオーナーへ付与する (冪等)。
    var ownerBadgeTitle = GourmetMaps.Controllers.InvitesController.OwnerBadgeTitle;

    // 旧称号名「初代タベマップ」からの改名 (冪等: 既存の保有者リンクは BadgeID 経由なので維持される)
    var legacyOwnerBadge = await dbContext.Badges.FirstOrDefaultAsync(badge => badge.Title == "初代タベマップ");
    if (legacyOwnerBadge is not null && legacyOwnerBadge.Title != ownerBadgeTitle)
    {
        legacyOwnerBadge.Title = ownerBadgeTitle;
        await dbContext.SaveChangesAsync();
    }

    var ownerBadge = await dbContext.Badges.FirstOrDefaultAsync(badge => badge.Title == ownerBadgeTitle);
    if (ownerBadge is null)
    {
        ownerBadge = new Badge
        {
            Title = ownerBadgeTitle,
            Description = "このグルメマップを最初に始めた人に贈られる称号。ワンタイム招待コードを発行できる。",
            IconUrl = string.Empty,
        };
        dbContext.Badges.Add(ownerBadge);
        await dbContext.SaveChangesAsync();
    }

    var ownerEmailForSeed = builder.Configuration["Auth:OwnerEmail"];
    var ownerHashKeyForSeed = builder.Configuration["Auth:EmailHashKey"];
    if (!string.IsNullOrWhiteSpace(ownerEmailForSeed) && !string.IsNullOrWhiteSpace(ownerHashKeyForSeed))
    {
        var ownerUser = await userManager.FindByNameAsync(HashEmail(ownerEmailForSeed, ownerHashKeyForSeed));
        if (ownerUser is not null)
        {
            var alreadyGranted = await dbContext.ApplicationUserBadges
                .AnyAsync(link => link.ApplicationUserId == ownerUser.Id && link.BadgeID == ownerBadge.BadgeID);
            if (!alreadyGranted)
            {
                dbContext.ApplicationUserBadges.Add(new ApplicationUserBadge
                {
                    ApplicationUserId = ownerUser.Id,
                    BadgeID = ownerBadge.BadgeID,
                });
                await dbContext.SaveChangesAsync();
            }
        }
    }
}

// ★ ローカリゼーションをパイプラインに適用する (UseRouting の前)
app.UseRequestLocalization(localizationOptions);

if (!app.Environment.IsProduction())
{
    app.UseHttpsRedirection();
}

// ★ ルーティングと認証の順番は重要です
app.UseRouting();
app.UseCors("FrontendClient");

// 認証エンドポイントのブルートフォース/スパム対策。独自の認証ミドルウェアより手前に置く。
app.UseRateLimiter();

// HttpOnly Cookie のアクセストークンを Authorization ヘッダーへ転写する。
// フロントエンドの localStorage にトークンを保持しないことで XSS によるトークン窃取を防ぐ。
app.Use(async (context, next) =>
{
    if (!context.Request.Headers.ContainsKey("Authorization")
        && context.Request.Cookies.TryGetValue("access_token", out var accessToken)
        && !string.IsNullOrWhiteSpace(accessToken))
    {
        context.Request.Headers.Authorization = $"Bearer {accessToken}";
    }
    await next();
});

app.UseAuthentication();
app.UseAuthorization();

// メールアドレスは平文で保存せず、サーバー秘密鍵による HMAC-SHA256 ハッシュに変換して扱う。
// (ログイン時も同じ関数でハッシュ化して照合するため、DB には友達の生メールが一切残らない)
static string HashEmail(string email, string key)
{
    var normalized = email.Trim().ToUpperInvariant();
    using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
    var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(normalized));
    return Convert.ToHexString(hash);
}

// パスワードリセットの短いコードをメモリキャッシュのキーへ変換する
static string PasswordResetCacheKey(string shortCode) => $"pwreset:{shortCode}";
static string PasswordResetFailKey(string shortCode) => $"pwreset-fail:{shortCode}";
const int MaxResetAttempts = 5;

// 招待コード制の新規登録:
// 既定の Identity register (/api/auth/register) を横取りし、appsettings の
// 招待コードと一致した場合のみ「確認済み」ユーザーを作成する (身内利用のため確認メールは省略)。
app.Use(async (context, next) =>
{
    if (!HttpMethods.IsPost(context.Request.Method)
        || !context.Request.Path.Equals("/api/auth/register", StringComparison.OrdinalIgnoreCase))
    {
        await next();
        return;
    }

    RegisterWithInviteRequest? payload;
    try
    {
        payload = await context.Request.ReadFromJsonAsync<RegisterWithInviteRequest>();
    }
    catch (System.Text.Json.JsonException)
    {
        payload = null;
    }

    if (payload is null || string.IsNullOrWhiteSpace(payload.Email) || string.IsNullOrWhiteSpace(payload.Password))
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new { detail = "メールアドレスとパスワードを入力してください。" });
        return;
    }

    var configuration = context.RequestServices.GetRequiredService<IConfiguration>();

    var hashKey = configuration["Auth:EmailHashKey"];
    if (string.IsNullOrWhiteSpace(hashKey))
    {
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await context.Response.WriteAsJsonAsync(new { detail = "サーバー設定 (Auth:EmailHashKey) が未設定です。" });
        return;
    }

    var db = context.RequestServices.GetRequiredService<GourmetDbContext>();
    var ownerBadgeTitle = GourmetMaps.Controllers.InvitesController.OwnerBadgeTitle;
    var now = DateTime.UtcNow;

    var submittedCode = payload.InviteCode?.Trim() ?? string.Empty;
    var normalizedCode = submittedCode.ToUpperInvariant();

    // ワンタイム招待コード (未使用・未失効) を照合する
    var invite = await db.InviteCodes.FirstOrDefaultAsync(code => code.Code == normalizedCode);
    var oneTimeValid = invite is not null && invite.UsedAt is null && invite.ExpiresAt > now;

    // ブートストラップ: オーナー (初代食べる王称号保有者) がまだ存在しない場合に限り、
    // 設定の固定合言葉での登録を許可する。オーナーが生まれた後は固定合言葉は無効になる。
    var ownerExists = await db.ApplicationUserBadges
        .Include(link => link.Badge)
        .AnyAsync(link => link.Badge.Title == ownerBadgeTitle);
    var fixedCode = configuration["Auth:InviteCode"];
    var bootstrapValid = !ownerExists
        && !string.IsNullOrWhiteSpace(fixedCode)
        && string.Equals(submittedCode, fixedCode.Trim(), StringComparison.Ordinal);

    if (!oneTimeValid && !bootstrapValid)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new { detail = "招待コードが正しくないか、有効期限が切れています。発行者に新しいコードを依頼してください。" });
        return;
    }

    // メールはハッシュ化した値を UserName / Email として保存する (平文は保持しない)
    var hashedEmail = HashEmail(payload.Email, hashKey);

    var userManager = context.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
    var newUser = new ApplicationUser
    {
        UserName = hashedEmail,
        Email = hashedEmail,
        EmailConfirmed = true, // 身内利用のため確認メールは省略し、登録直後にログインできるようにする
        DisplayName = string.IsNullOrWhiteSpace(payload.DisplayName) ? null : payload.DisplayName.Trim(),
    };

    var result = await userManager.CreateAsync(newUser, payload.Password);
    if (!result.Succeeded)
    {
        // ハッシュ化により UserName はメールのハッシュ値になるため、
        // 重複エラーは生の(ハッシュ入り)文言を出さず、分かりやすい日本語に置き換える。
        if (result.Errors.Any(error => error.Code is "DuplicateUserName" or "DuplicateEmail"))
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(new { detail = "このメールアドレスは既に登録されています。" });
            return;
        }

        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new
        {
            errors = result.Errors
                .GroupBy(error => error.Code)
                .ToDictionary(group => group.Key, group => group.Select(error => error.Description).ToArray()),
        });
        return;
    }

    // 使用したワンタイムコードを使用済みにする
    if (oneTimeValid && invite is not null)
    {
        invite.UsedAt = now;
        invite.UsedByUserId = newUser.Id;
    }

    // 設定のオーナーのメールで登録された場合は「初代食べる王」称号を付与する
    var ownerEmail = configuration["Auth:OwnerEmail"];
    if (!string.IsNullOrWhiteSpace(ownerEmail)
        && string.Equals(HashEmail(ownerEmail, hashKey), hashedEmail, StringComparison.Ordinal))
    {
        var ownerBadge = await db.Badges.FirstOrDefaultAsync(badge => badge.Title == ownerBadgeTitle);
        if (ownerBadge is null)
        {
            ownerBadge = new Badge
            {
                Title = ownerBadgeTitle,
                Description = "このグルメマップを最初に始めた人に贈られる称号。ワンタイム招待コードを発行できる。",
                IconUrl = string.Empty,
            };
            db.Badges.Add(ownerBadge);
            await db.SaveChangesAsync();
        }

        var linked = await db.ApplicationUserBadges
            .AnyAsync(link => link.ApplicationUserId == newUser.Id && link.BadgeID == ownerBadge.BadgeID);
        if (!linked)
        {
            db.ApplicationUserBadges.Add(new ApplicationUserBadge
            {
                ApplicationUserId = newUser.Id,
                BadgeID = ownerBadge.BadgeID,
            });
        }
    }

    await db.SaveChangesAsync();

    context.Response.StatusCode = StatusCodes.Status200OK;
});

// ログイン時もメールをハッシュ化してから照合する。
// 既定の Identity login (/api/auth/login) を横取りし、ハッシュ化ユーザー名で認証して
// Bearer トークンを発行する (成功時はトークン JSON をハンドラが自動で書き込む)。
app.Use(async (context, next) =>
{
    if (!HttpMethods.IsPost(context.Request.Method)
        || !context.Request.Path.Equals("/api/auth/login", StringComparison.OrdinalIgnoreCase))
    {
        await next();
        return;
    }

    LoginRequestBody? login;
    try
    {
        login = await context.Request.ReadFromJsonAsync<LoginRequestBody>();
    }
    catch (System.Text.Json.JsonException)
    {
        login = null;
    }

    if (login is null || string.IsNullOrWhiteSpace(login.Email) || string.IsNullOrWhiteSpace(login.Password))
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await context.Response.WriteAsJsonAsync(new { detail = "メールアドレスまたはパスワードが正しくありません。" });
        return;
    }

    var hashKey = context.RequestServices.GetRequiredService<IConfiguration>()["Auth:EmailHashKey"];
    if (string.IsNullOrWhiteSpace(hashKey))
    {
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await context.Response.WriteAsJsonAsync(new { detail = "サーバー設定 (Auth:EmailHashKey) が未設定です。" });
        return;
    }

    var userManager = context.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
    var signInManager = context.RequestServices.GetRequiredService<SignInManager<ApplicationUser>>();

    var user = await userManager.FindByNameAsync(HashEmail(login.Email, hashKey));
    if (user is null)
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await context.Response.WriteAsJsonAsync(new { detail = "メールアドレスまたはパスワードが正しくありません。" });
        return;
    }

    // Bearer スキームでサインインすると、成功時にアクセス/リフレッシュトークンが
    // レスポンス本文へ書き込まれる。これを捕捉して HttpOnly Cookie に移す。
    var originalBody = context.Response.Body;
    using var buffer = new MemoryStream();
    context.Response.Body = buffer;

    signInManager.AuthenticationScheme = IdentityConstants.BearerScheme;
    var result = await signInManager.PasswordSignInAsync(user, login.Password, isPersistent: false, lockoutOnFailure: true);

    context.Response.Body = originalBody;

    if (result.Succeeded)
    {
        buffer.Position = 0;
        using var doc = await System.Text.Json.JsonDocument.ParseAsync(buffer);
        var root = doc.RootElement;
        SetAuthCookies(context,
            root.GetProperty("accessToken").GetString()!,
            root.GetProperty("refreshToken").GetString()!,
            app.Environment.IsDevelopment());
        context.Response.StatusCode = StatusCodes.Status200OK;
        await context.Response.WriteAsJsonAsync(new { succeeded = true });
    }
    else
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await context.Response.WriteAsJsonAsync(new { detail = "メールアドレスまたはパスワードが正しくありません。" });
    }
});

// パスワードリセットのコード発行もメールをハッシュ化してから照合する必要がある。
// 既定の Identity forgotPassword (/api/auth/forgotPassword) を横取りし、ハッシュ化ユーザー名で
// ユーザーを検索してからリセットコードを発行する (MapIdentityApi と同じ挙動を手動で再現)。
app.Use(async (context, next) =>
{
    if (!HttpMethods.IsPost(context.Request.Method)
        || !context.Request.Path.Equals("/api/auth/forgotPassword", StringComparison.OrdinalIgnoreCase))
    {
        await next();
        return;
    }

    ForgotPasswordRequestBody? forgot;
    try
    {
        forgot = await context.Request.ReadFromJsonAsync<ForgotPasswordRequestBody>();
    }
    catch (System.Text.Json.JsonException)
    {
        forgot = null;
    }

    // メール列挙攻撃を防ぐため、入力が無効・ユーザーが存在しない場合も常に 200 を返す。
    if (forgot is null || string.IsNullOrWhiteSpace(forgot.Email))
    {
        context.Response.StatusCode = StatusCodes.Status200OK;
        return;
    }

    var hashKey = context.RequestServices.GetRequiredService<IConfiguration>()["Auth:EmailHashKey"];
    if (string.IsNullOrWhiteSpace(hashKey))
    {
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await context.Response.WriteAsJsonAsync(new { detail = "サーバー設定 (Auth:EmailHashKey) が未設定です。" });
        return;
    }

    var userManager = context.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
    var emailSender = context.RequestServices.GetRequiredService<IEmailSender<ApplicationUser>>();
    var cache = context.RequestServices.GetRequiredService<IMemoryCache>();

    var user = await userManager.FindByNameAsync(HashEmail(forgot.Email, hashKey));
    if (user is not null && await userManager.IsEmailConfirmedAsync(user))
    {
        // 本来の(長い) Identity トークンはメールに載せず、短い数字コードをキーにして
        // メモリ上に一時保存する(有効期限15分)。メールに書くのは短いコードのみ。
        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        var shortCode = GenerateResetCode(8);
        cache.Set(PasswordResetCacheKey(shortCode), (user.Id, token), TimeSpan.FromMinutes(15));
        await emailSender.SendPasswordResetCodeAsync(user, forgot.Email, shortCode);
    }

    context.Response.StatusCode = StatusCodes.Status200OK;
});

// パスワードリセットの確定も同様にメールをハッシュ化してから照合する。
// 既定の Identity resetPassword (/api/auth/resetPassword) を横取りし、ハッシュ化ユーザー名で
// ユーザーを検索してから新しいパスワードを設定する。
app.Use(async (context, next) =>
{
    if (!HttpMethods.IsPost(context.Request.Method)
        || !context.Request.Path.Equals("/api/auth/resetPassword", StringComparison.OrdinalIgnoreCase))
    {
        await next();
        return;
    }

    ResetPasswordRequestBody? reset;
    try
    {
        reset = await context.Request.ReadFromJsonAsync<ResetPasswordRequestBody>();
    }
    catch (System.Text.Json.JsonException)
    {
        reset = null;
    }

    if (reset is null
        || string.IsNullOrWhiteSpace(reset.Email)
        || string.IsNullOrWhiteSpace(reset.ResetCode)
        || string.IsNullOrWhiteSpace(reset.NewPassword))
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new { detail = "メールアドレス・コード・新しいパスワードを入力してください。" });
        return;
    }

    var hashKey = context.RequestServices.GetRequiredService<IConfiguration>()["Auth:EmailHashKey"];
    if (string.IsNullOrWhiteSpace(hashKey))
    {
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await context.Response.WriteAsJsonAsync(new { detail = "サーバー設定 (Auth:EmailHashKey) が未設定です。" });
        return;
    }

    var userManager = context.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
    var cache = context.RequestServices.GetRequiredService<IMemoryCache>();
    var user = await userManager.FindByNameAsync(HashEmail(reset.Email, hashKey));

    var codeKey = reset.ResetCode.Trim().ToUpperInvariant();
    var failKey = PasswordResetFailKey(codeKey);

    // 失敗回数が上限に達したコードは無効化済み
    if (cache.TryGetValue(failKey, out int failures) && failures >= MaxResetAttempts)
    {
        cache.Remove(PasswordResetCacheKey(codeKey));
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new { detail = "試行回数の上限に達しました。新しいリセットコードを発行してください。" });
        return;
    }

    IdentityResult result;
    if (user is null
        || !cache.TryGetValue(PasswordResetCacheKey(codeKey), out (string UserId, string Token) entry)
        || entry.UserId != user.Id)
    {
        // 失敗回数を記録し、上限到達でコードを無効化する
        var newFailures = failures + 1;
        cache.Set(failKey, newFailures, TimeSpan.FromMinutes(15));
        if (newFailures >= MaxResetAttempts)
        {
            cache.Remove(PasswordResetCacheKey(codeKey));
        }

        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new { detail = "コードが正しくないか、有効期限が切れています。" });
        return;
    }

    result = await userManager.ResetPasswordAsync(user, entry.Token, reset.NewPassword);
    if (result.Succeeded)
    {
        cache.Remove(PasswordResetCacheKey(codeKey));
        cache.Remove(failKey);
    }

    if (!result.Succeeded)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new
        {
            errors = result.Errors
                .GroupBy(error => error.Code)
                .ToDictionary(group => group.Key, group => group.Select(error => error.Description).ToArray()),
        });
        return;
    }

    context.Response.StatusCode = StatusCodes.Status200OK;
});

// リフレッシュトークンを Cookie から読み取り、Identity API のリフレッシュハンドラへ転送する。
// レスポンスのトークンも Cookie に移して、フロント側では一切トークンを扱わない。
app.Use(async (context, next) =>
{
    if (!HttpMethods.IsPost(context.Request.Method)
        || !context.Request.Path.Equals("/api/auth/refresh", StringComparison.OrdinalIgnoreCase))
    {
        await next();
        return;
    }

    var refreshToken = context.Request.Cookies["refresh_token"];
    if (string.IsNullOrWhiteSpace(refreshToken))
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await context.Response.WriteAsJsonAsync(new { detail = "セッションが期限切れです。再度ログインしてください。" });
        return;
    }

    var json = System.Text.Json.JsonSerializer.Serialize(new { refreshToken });
    var bytes = Encoding.UTF8.GetBytes(json);
    context.Request.Body = new MemoryStream(bytes);
    context.Request.ContentLength = bytes.Length;
    context.Request.ContentType = "application/json";

    var originalBody = context.Response.Body;
    using var buffer = new MemoryStream();
    context.Response.Body = buffer;

    await next();

    context.Response.Body = originalBody;
    buffer.Position = 0;

    if (context.Response.StatusCode == StatusCodes.Status200OK)
    {
        using var doc = await System.Text.Json.JsonDocument.ParseAsync(buffer);
        var root = doc.RootElement;
        if (root.TryGetProperty("accessToken", out var at) && root.TryGetProperty("refreshToken", out var rt))
        {
            SetAuthCookies(context, at.GetString()!, rt.GetString()!, app.Environment.IsDevelopment());
            await context.Response.WriteAsJsonAsync(new { succeeded = true });
            return;
        }
    }

    buffer.Position = 0;
    await buffer.CopyToAsync(originalBody);
});

// ログアウト: HttpOnly Cookie を削除する。
app.Use(async (context, next) =>
{
    if (!HttpMethods.IsPost(context.Request.Method)
        || !context.Request.Path.Equals("/api/auth/logout", StringComparison.OrdinalIgnoreCase))
    {
        await next();
        return;
    }

    ClearAuthCookies(context, app.Environment.IsDevelopment());
    context.Response.StatusCode = StatusCodes.Status200OK;
    await context.Response.WriteAsJsonAsync(new { succeeded = true });
});

// Identity API (register / login / refresh / confirmEmail など) を /api/auth 配下に公開
app.MapGroup("/api/auth").MapIdentityApi<ApplicationUser>();

// Identity のエンドポイントと Razor Pages エンドポイントのマッピング
app.MapControllers();
app.MapRazorPages();

// 静的ファイルのパイプライン処理 (通常は UseRouting の後、Map... の前)
app.MapStaticAssets();
app.MapRazorPages().WithStaticAssets(); // この行は冗長な可能性が高いですが、残しておきます。

app.Run();

// 旧方式 (EnsureCreated + 起動時 DDL) で作られた既存 DB を EF Migrations 管理下へ移す。
// アプリのテーブルが既に存在し、かつ __EFMigrationsHistory が無い場合に限り、
// InitialCreate を「適用済み」として履歴へ記録する (テーブルは作り直さない)。
// 新規 DB (テーブル無し) や移行済み DB では何もしないので、後続の Migrate() に委ねられる。
static async Task SeedDemoDataAsync(GourmetDbContext dbContext, UserManager<ApplicationUser> userManager)
{
    var demoEnabled = Environment.GetEnvironmentVariable("DEMO_SEED_DATA") ?? "true";
    if (!string.Equals(demoEnabled, "true", StringComparison.OrdinalIgnoreCase))
    {
        return;
    }

    var existingEntries = await dbContext.GourmetEntries.AsNoTracking().CountAsync();
    if (existingEntries > 0)
    {
        return;
    }

    var demoUser = await userManager.FindByNameAsync("guest-map");
    if (demoUser is null)
    {
        return;
    }

    var stores = new[]
    {
        new Store { Name = "東京スカイツリー・ソラマチ", Genre = "カフェ", Address = "東京都墨田区押上1-1-2", Latitude = 35.7101f, Longitude = 139.8123f, CreatedAt = DateTime.UtcNow, CreatedByUserId = demoUser.Id },
        new Store { Name = "浅草寺 たこ焼き横丁", Genre = "軽食", Address = "東京都台東区浅草2-3-1", Latitude = 35.7148f, Longitude = 139.7967f, CreatedAt = DateTime.UtcNow, CreatedByUserId = demoUser.Id },
        new Store { Name = "新宿駅南口 うどん屋", Genre = "うどん", Address = "東京都新宿区新宿3-38-1", Latitude = 35.6909f, Longitude = 139.7003f, CreatedAt = DateTime.UtcNow, CreatedByUserId = demoUser.Id },
        new Store { Name = "渋谷スクランブル交差点の定食屋", Genre = "定食", Address = "東京都渋谷区道玄坂2-29-1", Latitude = 35.6595f, Longitude = 139.7004f, CreatedAt = DateTime.UtcNow, CreatedByUserId = demoUser.Id },
    };

    dbContext.Stores.AddRange(stores);
    await dbContext.SaveChangesAsync();

    var seedEntries = new[]
    {
        new GourmetEntry
        {
            Name = stores[0].Name,
            Genre = "カフェ",
            MenuName = "モーニングセット",
            VisitDate = DateTime.UtcNow.AddHours(-3),
            OverallRating = 4.8f,
            TasteRating = 4.7f,
            CostPerformanceRating = 4.3f,
            AppearanceRating = 4.9f,
            ServiceRating = 4.6f,
            RepeatRating = 4.8f,
            VolumeRating = 4.8f,
            ReorderRating = 4.8f,
            Memo = "景色が良くて、朝の散歩のあとに立ち寄りやすい。",
            SceneTag = "朝カフェ",
            PriceRange = "1000円台",
            VisitType = "ひとり",
            Tag = "また行く",
            PhotoUrl = "https://images.unsplash.com/photo-1499638673689-79a0b5115d87?auto=format&fit=crop&w=800&q=80",
            Latitude = stores[0].Latitude,
            Longitude = stores[0].Longitude,
            StoreID = stores[0].StoreID,
            UserID = demoUser.Id,
        },
        new GourmetEntry
        {
            Name = stores[1].Name,
            Genre = "軽食",
            MenuName = "たこ焼きセット",
            VisitDate = DateTime.UtcNow.AddHours(-8),
            OverallRating = 4.5f,
            TasteRating = 4.4f,
            CostPerformanceRating = 4.8f,
            AppearanceRating = 4.2f,
            ServiceRating = 4.3f,
            RepeatRating = 4.5f,
            VolumeRating = 4.5f,
            ReorderRating = 4.5f,
            Memo = "お祭り気分が味わえて、短時間で満足しやすい。",
            SceneTag = "散歩",
            PriceRange = "500円台",
            VisitType = "友達と",
            Tag = "一口目が強い",
            PhotoUrl = "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=800&q=80",
            Latitude = stores[1].Latitude,
            Longitude = stores[1].Longitude,
            StoreID = stores[1].StoreID,
            UserID = demoUser.Id,
        },
        new GourmetEntry
        {
            Name = stores[2].Name,
            Genre = "うどん",
            MenuName = "温かいうどん",
            VisitDate = DateTime.UtcNow.AddHours(-14),
            OverallRating = 4.6f,
            TasteRating = 4.7f,
            CostPerformanceRating = 4.5f,
            AppearanceRating = 4.3f,
            ServiceRating = 4.4f,
            RepeatRating = 4.6f,
            VolumeRating = 4.6f,
            ReorderRating = 4.6f,
            Memo = "駅の近くで手軽に入れる。",
            SceneTag = "帰り道",
            PriceRange = "1000円台",
            VisitType = "ひとり",
            Tag = "量が多い",
            PhotoUrl = "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80",
            Latitude = stores[2].Latitude,
            Longitude = stores[2].Longitude,
            StoreID = stores[2].StoreID,
            UserID = demoUser.Id,
        },
        new GourmetEntry
        {
            Name = stores[3].Name,
            Genre = "定食",
            MenuName = "日替わり定食",
            VisitDate = DateTime.UtcNow.AddHours(-20),
            OverallRating = 4.7f,
            TasteRating = 4.8f,
            CostPerformanceRating = 4.4f,
            AppearanceRating = 4.5f,
            ServiceRating = 4.7f,
            RepeatRating = 4.7f,
            VolumeRating = 4.7f,
            ReorderRating = 4.7f,
            Memo = "渋谷の喧騒の中でも落ち着いて食べられる。",
            SceneTag = "デート",
            PriceRange = "1500円台",
            VisitType = "家族と",
            Tag = "接客よい",
            PhotoUrl = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
            Latitude = stores[3].Latitude,
            Longitude = stores[3].Longitude,
            StoreID = stores[3].StoreID,
            UserID = demoUser.Id,
        },
    };

    dbContext.GourmetEntries.AddRange(seedEntries);
    await dbContext.SaveChangesAsync();
}

static async Task BaselineLegacyDatabaseAsync(GourmetDbContext dbContext)
{
    static async Task<bool> TableExistsAsync(System.Data.Common.DbConnection conn, string tableName)
    {
        using var command = conn.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = $name;";
        var parameter = command.CreateParameter();
        parameter.ParameterName = "$name";
        parameter.Value = tableName;
        command.Parameters.Add(parameter);
        var result = await command.ExecuteScalarAsync();
        return Convert.ToInt64(result) > 0;
    }

    var connection = dbContext.Database.GetDbConnection();
    await connection.OpenAsync();
    try
    {
        var historyExists = await TableExistsAsync(connection, "__EFMigrationsHistory");
        var legacySchemaExists = await TableExistsAsync(connection, "AspNetUsers");

        // 新規 DB (テーブルなし) や、既に移行済みの DB は何もしない
        if (historyExists || !legacySchemaExists)
        {
            return;
        }

        // 最初のマイグレーション (InitialCreate) を適用済みとして履歴に記録する
        var initialMigrationId = dbContext.Database.GetMigrations().First();

        using (var createHistory = connection.CreateCommand())
        {
            createHistory.CommandText = """
                CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
                    "MigrationId" TEXT NOT NULL CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY,
                    "ProductVersion" TEXT NOT NULL
                );
                """;
            await createHistory.ExecuteNonQueryAsync();
        }

        using (var insert = connection.CreateCommand())
        {
            insert.CommandText = """
                INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
                VALUES ($id, $version);
                """;

            var idParam = insert.CreateParameter();
            idParam.ParameterName = "$id";
            idParam.Value = initialMigrationId;
            insert.Parameters.Add(idParam);

            var versionParam = insert.CreateParameter();
            versionParam.ParameterName = "$version";
            versionParam.Value = "10.0.5";
            insert.Parameters.Add(versionParam);

            await insert.ExecuteNonQueryAsync();
        }
    }
    finally
    {
        await connection.CloseAsync();
    }
}

static void SetAuthCookies(HttpContext context, string accessToken, string refreshToken, bool isDevelopment)
{
    context.Response.Cookies.Append("access_token", accessToken, new CookieOptions
    {
        HttpOnly = true,
        Secure = !isDevelopment,
        SameSite = SameSiteMode.Lax,
        Path = "/",
        MaxAge = TimeSpan.FromHours(1),
    });
    context.Response.Cookies.Append("refresh_token", refreshToken, new CookieOptions
    {
        HttpOnly = true,
        Secure = !isDevelopment,
        SameSite = SameSiteMode.Lax,
        Path = "/api/auth",
        MaxAge = TimeSpan.FromDays(14),
    });
}

static void ClearAuthCookies(HttpContext context, bool isDevelopment)
{
    context.Response.Cookies.Delete("access_token", new CookieOptions
    {
        HttpOnly = true,
        Secure = !isDevelopment,
        SameSite = SameSiteMode.Lax,
        Path = "/",
    });
    context.Response.Cookies.Delete("refresh_token", new CookieOptions
    {
        HttpOnly = true,
        Secure = !isDevelopment,
        SameSite = SameSiteMode.Lax,
        Path = "/api/auth",
    });
}

// 紛らわしい文字を除外した英数字コードを生成する (パスワードリセット用)
static string GenerateResetCode(int length)
{
    const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    Span<char> buffer = stackalloc char[length];
    for (var i = 0; i < length; i++)
    {
        buffer[i] = alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)];
    }
    return new string(buffer);
}

// .env ファイル (KEY=VALUE 形式、# はコメント) を読み、プロセスの環境変数として設定する。
// 実際の環境変数がすでに設定されている場合はそちらを優先し、上書きしない。
static void LoadDotEnvFile(string path)
{
    if (!File.Exists(path))
    {
        return;
    }

    foreach (var line in File.ReadAllLines(path))
    {
        var trimmed = line.Trim();
        if (trimmed.Length == 0 || trimmed.StartsWith('#'))
        {
            continue;
        }

        var separatorIndex = trimmed.IndexOf('=');
        if (separatorIndex <= 0)
        {
            continue;
        }

        var key = trimmed[..separatorIndex].Trim();
        var value = trimmed[(separatorIndex + 1)..].Trim().Trim('"');

        if (Environment.GetEnvironmentVariable(key) is null)
        {
            Environment.SetEnvironmentVariable(key, value);
        }
    }
}

// 招待コード制の新規登録リクエスト本文
record RegisterWithInviteRequest(string? Email, string? Password, string? InviteCode, string? DisplayName);

// ログインリクエスト本文
record LoginRequestBody(string? Email, string? Password);

record ForgotPasswordRequestBody(string? Email);

record ResetPasswordRequestBody(string? Email, string? ResetCode, string? NewPassword);

// 統合テスト (WebApplicationFactory<Program>) から参照できるように、
// トップレベルステートメントが生成する Program クラスを公開する。
public partial class Program { }