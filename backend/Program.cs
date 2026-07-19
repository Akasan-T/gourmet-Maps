using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
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
            .AllowAnyMethod();
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
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<GourmetDbContext>();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    dbContext.Database.EnsureCreated();
    using (var connection = dbContext.Database.GetDbConnection())
    {
        connection.Open();

        var hasDisplayNameColumn = false;
        using (var command = connection.CreateCommand())
        {
            command.CommandText = """
                PRAGMA table_info("AspNetUsers");
                """;

            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                if (string.Equals(reader.GetString(1), "DisplayName", StringComparison.OrdinalIgnoreCase))
                {
                    hasDisplayNameColumn = true;
                    break;
                }
            }
        }

        if (!hasDisplayNameColumn)
        {
            using var alterTableCommand = connection.CreateCommand();
            alterTableCommand.CommandText = """
                ALTER TABLE "AspNetUsers" ADD COLUMN "DisplayName" TEXT NULL;
                """;
            alterTableCommand.ExecuteNonQuery();
        }

        var hasAvatarUrlColumn = false;
        using (var command = connection.CreateCommand())
        {
            command.CommandText = """
                PRAGMA table_info("AspNetUsers");
                """;

            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                if (string.Equals(reader.GetString(1), "AvatarUrl", StringComparison.OrdinalIgnoreCase))
                {
                    hasAvatarUrlColumn = true;
                    break;
                }
            }
        }

        if (!hasAvatarUrlColumn)
        {
            using var alterTableCommand = connection.CreateCommand();
            alterTableCommand.CommandText = """
                ALTER TABLE "AspNetUsers" ADD COLUMN "AvatarUrl" TEXT NULL;
                """;
            alterTableCommand.ExecuteNonQuery();
        }
    }

    dbContext.Database.ExecuteSqlRaw(
        """
        CREATE TABLE IF NOT EXISTS "Stores" (
            "StoreID" INTEGER NOT NULL CONSTRAINT "PK_Stores" PRIMARY KEY AUTOINCREMENT,
            "Name" TEXT NOT NULL,
            "Genre" TEXT NOT NULL,
            "Address" TEXT NULL,
            "Latitude" REAL NULL,
            "Longitude" REAL NULL,
            "ExternalPlaceId" TEXT NULL,
            "CreatedByUserId" TEXT NULL,
            "CreatedAt" TEXT NOT NULL,
            CONSTRAINT "FK_Stores_AspNetUsers_CreatedByUserId" FOREIGN KEY ("CreatedByUserId") REFERENCES "AspNetUsers" ("Id")
        );
        """);
    dbContext.Database.ExecuteSqlRaw(
        """
        CREATE TABLE IF NOT EXISTS "GourmetEntries" (
            "GourmetEntryID" INTEGER NOT NULL CONSTRAINT "PK_GourmetEntries" PRIMARY KEY AUTOINCREMENT,
            "Name" TEXT NOT NULL,
            "Genre" TEXT NOT NULL,
            "VisitDate" TEXT NOT NULL,
            "OverallRating" REAL NOT NULL,
            "TasteRating" REAL NOT NULL,
            "AppearanceRating" REAL NOT NULL,
            "CostPerformanceRating" REAL NOT NULL,
            "ServiceRating" REAL NOT NULL DEFAULT 0,
            "VolumeRating" REAL NOT NULL,
            "RepeatRating" REAL NOT NULL,
            "ReorderRating" REAL NOT NULL,
            "Memo" TEXT NOT NULL,
            "SceneTag" TEXT NULL,
            "PriceRange" TEXT NULL,
            "PhotoUrl" TEXT NULL,
            "Latitude" REAL NULL,
            "Longitude" REAL NULL,
            "StoreID" INTEGER NULL,
            "UserID" TEXT NOT NULL,
            CONSTRAINT "FK_GourmetEntries_AspNetUsers_UserID" FOREIGN KEY ("UserID") REFERENCES "AspNetUsers" ("Id"),
            CONSTRAINT "FK_GourmetEntries_Stores_StoreID" FOREIGN KEY ("StoreID") REFERENCES "Stores" ("StoreID")
        );
        """);
    dbContext.Database.ExecuteSqlRaw(
        """
        CREATE INDEX IF NOT EXISTS "IX_GourmetEntries_UserID" ON "GourmetEntries" ("UserID");
        """);
    dbContext.Database.ExecuteSqlRaw(
        """
        CREATE INDEX IF NOT EXISTS "IX_GourmetEntries_StoreID" ON "GourmetEntries" ("StoreID");
        """);

    // 既存DB向け: 追加カラムが無ければ ALTER で追加する (冪等)
    using (var connection = dbContext.Database.GetDbConnection())
    {
        connection.Open();

        var existingColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        using (var command = connection.CreateCommand())
        {
            command.CommandText = "PRAGMA table_info(\"GourmetEntries\");";
            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                existingColumns.Add(reader.GetString(1));
            }
        }

        var columnsToAdd = new (string Name, string Definition)[]
        {
            ("ServiceRating", "REAL NOT NULL DEFAULT 0"),
            ("SceneTag", "TEXT NULL"),
            ("PriceRange", "TEXT NULL"),
            ("PhotoUrl", "TEXT NULL"),
            ("StoreID", "INTEGER NULL"),
        };

        foreach (var column in columnsToAdd)
        {
            if (existingColumns.Contains(column.Name))
            {
                continue;
            }

            using var alterCommand = connection.CreateCommand();
            alterCommand.CommandText = $"ALTER TABLE \"GourmetEntries\" ADD COLUMN \"{column.Name}\" {column.Definition};";
            alterCommand.ExecuteNonQuery();
        }
    }

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
    dbContext.Database.ExecuteSqlRaw(
        """
        CREATE TABLE IF NOT EXISTS "Badges" (
            "BadgeID" INTEGER NOT NULL CONSTRAINT "PK_Badges" PRIMARY KEY AUTOINCREMENT,
            "Title" TEXT NOT NULL,
            "Description" TEXT NOT NULL,
            "IconUrl" TEXT NOT NULL
        );
        """);
    dbContext.Database.ExecuteSqlRaw(
        """
        CREATE TABLE IF NOT EXISTS "ApplicationUserBadges" (
            "ApplicationUserId" TEXT NOT NULL,
            "BadgeID" INTEGER NOT NULL,
            CONSTRAINT "PK_ApplicationUserBadges" PRIMARY KEY ("ApplicationUserId", "BadgeID"),
            CONSTRAINT "FK_ApplicationUserBadges_AspNetUsers_ApplicationUserId" FOREIGN KEY ("ApplicationUserId") REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE,
            CONSTRAINT "FK_ApplicationUserBadges_Badges_BadgeID" FOREIGN KEY ("BadgeID") REFERENCES "Badges" ("BadgeID") ON DELETE CASCADE
        );
        """);
    dbContext.Database.ExecuteSqlRaw(
        """
        CREATE INDEX IF NOT EXISTS "IX_ApplicationUserBadges_BadgeID" ON "ApplicationUserBadges" ("BadgeID");
        """);
    dbContext.Database.ExecuteSqlRaw(
        """
        CREATE TABLE IF NOT EXISTS "GourmetEntryParticipants" (
            "GourmetEntryID" INTEGER NOT NULL,
            "ApplicationUserId" TEXT NOT NULL,
            CONSTRAINT "PK_GourmetEntryParticipants" PRIMARY KEY ("GourmetEntryID", "ApplicationUserId"),
            CONSTRAINT "FK_GourmetEntryParticipants_GourmetEntries_GourmetEntryID" FOREIGN KEY ("GourmetEntryID") REFERENCES "GourmetEntries" ("GourmetEntryID") ON DELETE CASCADE,
            CONSTRAINT "FK_GourmetEntryParticipants_AspNetUsers_ApplicationUserId" FOREIGN KEY ("ApplicationUserId") REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
        );
        """);
    dbContext.Database.ExecuteSqlRaw(
        """
        CREATE INDEX IF NOT EXISTS "IX_GourmetEntryParticipants_ApplicationUserId" ON "GourmetEntryParticipants" ("ApplicationUserId");
        """);
    dbContext.Database.ExecuteSqlRaw(
        """
        CREATE TABLE IF NOT EXISTS "InviteCodes" (
            "InviteCodeID" INTEGER NOT NULL CONSTRAINT "PK_InviteCodes" PRIMARY KEY AUTOINCREMENT,
            "Code" TEXT NOT NULL,
            "CreatedByUserId" TEXT NOT NULL,
            "CreatedAt" TEXT NOT NULL,
            "ExpiresAt" TEXT NOT NULL,
            "UsedAt" TEXT NULL,
            "UsedByUserId" TEXT NULL
        );
        """);
    dbContext.Database.ExecuteSqlRaw(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_InviteCodes_Code" ON "InviteCodes" ("Code");
        """);

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

app.UseHttpsRedirection();

// ★ ルーティングと認証の順番は重要です
app.UseRouting();
app.UseCors("FrontendClient");
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
    // レスポンス本文へ書き込まれる (MapIdentityApi の login と同じ挙動)。
    signInManager.AuthenticationScheme = IdentityConstants.BearerScheme;
    var result = await signInManager.PasswordSignInAsync(user, login.Password, isPersistent: false, lockoutOnFailure: true);
    if (!result.Succeeded)
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

    var user = await userManager.FindByNameAsync(HashEmail(forgot.Email, hashKey));
    if (user is not null && await userManager.IsEmailConfirmedAsync(user))
    {
        var code = await userManager.GeneratePasswordResetTokenAsync(user);
        code = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(code));
        await emailSender.SendPasswordResetCodeAsync(user, forgot.Email, code);
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
    var user = await userManager.FindByNameAsync(HashEmail(reset.Email, hashKey));
    if (user is null)
    {
        // メール列挙攻撃を防ぐため、ユーザーが存在しない場合も汎用エラーメッセージを返す。
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new { detail = "コードが正しくないか、有効期限が切れています。" });
        return;
    }

    IdentityResult result;
    try
    {
        var decodedCode = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(reset.ResetCode));
        result = await userManager.ResetPasswordAsync(user, decodedCode, reset.NewPassword);
    }
    catch (FormatException)
    {
        result = IdentityResult.Failed(new IdentityError { Code = "InvalidToken", Description = "コードが正しくないか、有効期限が切れています。" });
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

// Identity API (register / login / refresh / confirmEmail など) を /api/auth 配下に公開
app.MapGroup("/api/auth").MapIdentityApi<ApplicationUser>();

// Identity のエンドポイントと Razor Pages エンドポイントのマッピング
app.MapControllers();
app.MapRazorPages();

// 静的ファイルのパイプライン処理 (通常は UseRouting の後、Map... の前)
app.MapStaticAssets();
app.MapRazorPages().WithStaticAssets(); // この行は冗長な可能性が高いですが、残しておきます。

app.Run();

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