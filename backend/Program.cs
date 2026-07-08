using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using GourmetMaps.Data;
using GourmetMaps.Models;
using GourmetMaps.Services;

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

// SPA から利用する Bearer トークン / Cookie ベースの認証 API エンドポイント
builder.Services
    .AddIdentityApiEndpoints<ApplicationUser>(options => options.SignIn.RequireConfirmedAccount = true)
    .AddEntityFrameworkStores<GourmetDbContext>();

builder.Services.AddAuthorization();

// 開発用のメール送信: 確認リンク等をサーバーのコンソールへ出力する。
// 本番では SMTP / SendGrid 等を使う IEmailSender<ApplicationUser> に差し替える。
builder.Services.AddTransient<IEmailSender<ApplicationUser>, ConsoleEmailSender>();

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

    var configuredCode = configuration["Auth:InviteCode"];
    if (string.IsNullOrWhiteSpace(configuredCode)
        || !string.Equals(payload.InviteCode?.Trim(), configuredCode.Trim(), StringComparison.Ordinal))
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new { detail = "招待コードが正しくありません。" });
        return;
    }

    var hashKey = configuration["Auth:EmailHashKey"];
    if (string.IsNullOrWhiteSpace(hashKey))
    {
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await context.Response.WriteAsJsonAsync(new { detail = "サーバー設定 (Auth:EmailHashKey) が未設定です。" });
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

// 招待コード制の新規登録リクエスト本文
record RegisterWithInviteRequest(string? Email, string? Password, string? InviteCode, string? DisplayName);