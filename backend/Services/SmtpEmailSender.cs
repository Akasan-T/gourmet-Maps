using Microsoft.AspNetCore.Identity;
using GourmetMaps.Models;
using MailKit.Net.Smtp;
using MimeKit;

namespace GourmetMaps.Services
{
    /// <summary>
    /// SMTP経由でメールを送信する実装。開発環境では Mailpit (docker-compose のサービス)、
    /// 本番では実際のSMTPサーバーへ接続する想定。接続先は appsettings の "Smtp" セクションで設定する。
    /// </summary>
    public class SmtpEmailSender : IEmailSender<ApplicationUser>
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<SmtpEmailSender> _logger;

        public SmtpEmailSender(IConfiguration configuration, ILogger<SmtpEmailSender> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        public Task SendConfirmationLinkAsync(ApplicationUser user, string email, string confirmationLink)
            => SendAsync(
                email,
                "GourmetMaps: メールアドレスの確認",
                $"以下のリンクを開いてメールアドレスを確認してください。\n{confirmationLink}");

        public Task SendPasswordResetLinkAsync(ApplicationUser user, string email, string resetLink)
            => SendAsync(
                email,
                "GourmetMaps: パスワードリセット",
                $"以下のリンクを開いてパスワードを再設定してください。\n{resetLink}");

        public Task SendPasswordResetCodeAsync(ApplicationUser user, string email, string resetCode)
            => SendAsync(
                email,
                "GourmetMaps: パスワードリセットコード",
                $"パスワードリセットコード: {resetCode}");

        private async Task SendAsync(string toEmail, string subject, string body)
        {
            var host = _configuration["Smtp:Host"] ?? "localhost";
            var port = int.TryParse(_configuration["Smtp:Port"], out var parsedPort) ? parsedPort : 1025;
            var fromAddress = _configuration["Smtp:From"] ?? "no-reply@gourmetmaps.local";

            var message = new MimeMessage();
            message.From.Add(MailboxAddress.Parse(fromAddress));
            message.To.Add(MailboxAddress.Parse(toEmail));
            message.Subject = subject;
            message.Body = new TextPart("plain") { Text = body };

            using var client = new SmtpClient();
            try
            {
                await client.ConnectAsync(host, port, ResolveSecureSocketOptions());

                var user = _configuration["Smtp:User"];
                var password = _configuration["Smtp:Password"];
                if (!string.IsNullOrWhiteSpace(user))
                {
                    await client.AuthenticateAsync(user, password ?? string.Empty);
                }

                await client.SendAsync(message);
            }
            finally
            {
                if (client.IsConnected)
                {
                    await client.DisconnectAsync(true);
                }
            }

            _logger.LogInformation("メールを送信しました ({Host}:{Port} 経由)", host, port);
        }

        // 接続時のTLSモードを設定 "Smtp:Secure" で切り替える。
        //   none      … 平文（開発の Mailpit 用）
        //   starttls  … 接続後に STARTTLS で暗号化（本番の 587 等）
        //   ssl       … 接続時から SSL/TLS（465 等）
        //   auto/未設定 … サーバーが対応していれば STARTTLS、非対応なら平文（既定・後方互換）
        private MailKit.Security.SecureSocketOptions ResolveSecureSocketOptions()
        {
            var mode = _configuration["Smtp:Secure"]?.Trim().ToLowerInvariant();
            return mode switch
            {
                "none" => MailKit.Security.SecureSocketOptions.None,
                "starttls" => MailKit.Security.SecureSocketOptions.StartTls,
                "ssl" or "tls" or "sslonconnect" => MailKit.Security.SecureSocketOptions.SslOnConnect,
                _ => MailKit.Security.SecureSocketOptions.StartTlsWhenAvailable,
            };
        }
    }
}
