using System;
using System.Linq;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Xunit;

namespace NoodleMaps.Tests
{
    // 招待コード制の登録・ログイン・認可まわりの回帰を守る統合テスト。
    // 対応するE2E設計: AUTH-01 / AUTH-04 / AUTH-05 / AUTH-02 / AUTH-11。
    public class AuthFlowTests : IClassFixture<TestWebApplicationFactory>
    {
        private const string ValidPassword = "Passw0rd!";
        private readonly TestWebApplicationFactory _factory;

        public AuthFlowTests(TestWebApplicationFactory factory) => _factory = factory;

        private static string NewEmail() => $"user-{Guid.NewGuid():N}@example.com";

        // AUTH-04 + AUTH-01: ブートストラップ招待コードで登録 → 同じ資格情報でログインし HttpOnly Cookie を得る
        [Fact]
        public async Task Register_WithBootstrapCode_ThenLogin_SetsAuthCookies()
        {
            var client = _factory.CreateClient();
            var email = NewEmail();

            var register = await client.PostAsJsonAsync("/api/auth/register", new
            {
                email,
                password = ValidPassword,
                inviteCode = TestWebApplicationFactory.BootstrapInviteCode,
            });
            Assert.Equal(HttpStatusCode.OK, register.StatusCode);

            var login = await client.PostAsJsonAsync("/api/auth/login", new { email, password = ValidPassword });
            Assert.Equal(HttpStatusCode.OK, login.StatusCode);

            var body = await login.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(body.TryGetProperty("succeeded", out var succeeded));
            Assert.True(succeeded.GetBoolean());

            // HttpOnly Cookie が Set-Cookie ヘッダで返されていること
            Assert.True(login.Headers.Contains("Set-Cookie"));
            var cookies = login.Headers.GetValues("Set-Cookie").ToList();
            Assert.Contains(cookies, c => c.StartsWith("access_token=") && c.Contains("httponly", StringComparison.OrdinalIgnoreCase));
            Assert.Contains(cookies, c => c.StartsWith("refresh_token=") && c.Contains("httponly", StringComparison.OrdinalIgnoreCase));
        }

        // AUTH-05: 誤った招待コードでは登録できない
        [Fact]
        public async Task Register_WithInvalidInviteCode_ReturnsBadRequest()
        {
            var client = _factory.CreateClient();

            var response = await client.PostAsJsonAsync("/api/auth/register", new
            {
                email = NewEmail(),
                password = ValidPassword,
                inviteCode = "totally-wrong-code",
            });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        // 入力不備 (パスワード欠落) は 400
        [Fact]
        public async Task Register_WithoutPassword_ReturnsBadRequest()
        {
            var client = _factory.CreateClient();

            var response = await client.PostAsJsonAsync("/api/auth/register", new
            {
                email = NewEmail(),
                inviteCode = TestWebApplicationFactory.BootstrapInviteCode,
            });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        // AUTH-02: 誤ったパスワードでのログインは 401
        [Fact]
        public async Task Login_WithWrongPassword_ReturnsUnauthorized()
        {
            var client = _factory.CreateClient();
            var email = NewEmail();

            var register = await client.PostAsJsonAsync("/api/auth/register", new
            {
                email,
                password = ValidPassword,
                inviteCode = TestWebApplicationFactory.BootstrapInviteCode,
            });
            Assert.Equal(HttpStatusCode.OK, register.StatusCode);

            var login = await client.PostAsJsonAsync("/api/auth/login", new { email, password = "WrongPass9!" });
            Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
        }

        // AUTH-11: 未認証では保護 API にアクセスできない
        [Fact]
        public async Task GetGourmetEntries_WithoutAuth_ReturnsUnauthorized()
        {
            var client = _factory.CreateClient();

            var response = await client.GetAsync("/api/GourmetEntries");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
    }
}
