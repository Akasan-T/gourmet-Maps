using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using GourmetMaps.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace NoodleMaps.Tests
{
    // 実際の Program.cs を起動して HTTP 経由で叩く統合テスト用のファクトリ。
    // - DB はテストごとに独立した一時 SQLite ファイル (起動時に Migrate でスキーマ構築)
    // - 認証系の設定 (EmailHashKey / ブートストラップ招待コード) をテスト用の既知値で注入
    // - メール送信は実際に飛ばさない no-op に差し替え
    public class TestWebApplicationFactory : WebApplicationFactory<Program>
    {
        public const string BootstrapInviteCode = "test-bootstrap-code";
        public const string EmailHashKey = "test-email-hash-key-do-not-use-in-prod";

        private readonly string _dbPath =
            Path.Combine(Path.GetTempPath(), $"tabemap-test-{Guid.NewGuid():N}.db");

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");

            builder.ConfigureAppConfiguration((_, config) =>
            {
                config.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:DefaultConnection"] = $"Data Source={_dbPath}",
                    ["Auth:EmailHashKey"] = EmailHashKey,
                    ["Auth:InviteCode"] = BootstrapInviteCode,
                    // オーナーは自動付与しない (ブートストラップ招待を無効化させないため)
                    ["Auth:OwnerEmail"] = "",
                });
            });

            builder.ConfigureServices(services =>
            {
                var emailDescriptor = services.SingleOrDefault(
                    d => d.ServiceType == typeof(IEmailSender<ApplicationUser>));
                if (emailDescriptor is not null)
                {
                    services.Remove(emailDescriptor);
                }

                services.AddTransient<IEmailSender<ApplicationUser>, NoopEmailSender>();
            });
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            if (disposing && File.Exists(_dbPath))
            {
                try
                {
                    File.Delete(_dbPath);
                }
                catch
                {
                    // 一時ファイルの削除失敗は無視
                }
            }
        }
    }

    // テスト中はメールを実送信しない
    public sealed class NoopEmailSender : IEmailSender<ApplicationUser>
    {
        public Task SendConfirmationLinkAsync(ApplicationUser user, string email, string confirmationLink)
            => Task.CompletedTask;

        public Task SendPasswordResetLinkAsync(ApplicationUser user, string email, string resetLink)
            => Task.CompletedTask;

        public Task SendPasswordResetCodeAsync(ApplicationUser user, string email, string resetCode)
            => Task.CompletedTask;
    }
}
