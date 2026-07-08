using Microsoft.AspNetCore.Identity;
using GourmetMaps.Models;

namespace GourmetMaps.Services
{
    /// <summary>
    /// 開発用のメール送信実装。実際にメールは送らず、確認リンクやパスワードリセットの
    /// 情報をサーバーのコンソール（ログ）へ出力する。
    /// メール確認 (RequireConfirmedAccount = true) を有効にしたまま、送信基盤が無い
    /// 開発環境でも登録→確認→ログインのフローを検証できるようにするためのもの。
    /// 本番環境では SMTP / SendGrid などを使う実装に差し替えること。
    /// </summary>
    public class ConsoleEmailSender : IEmailSender<ApplicationUser>
    {
        private readonly ILogger<ConsoleEmailSender> _logger;

        public ConsoleEmailSender(ILogger<ConsoleEmailSender> logger)
        {
            _logger = logger;
        }

        public Task SendConfirmationLinkAsync(ApplicationUser user, string email, string confirmationLink)
        {
            _logger.LogWarning(
                "[開発用メール] メールアドレス確認リンク ({Email}):\n{Link}\n↑ このURLをブラウザで開くとアカウントが有効化され、ログインできるようになります。",
                email, confirmationLink);
            return Task.CompletedTask;
        }

        public Task SendPasswordResetLinkAsync(ApplicationUser user, string email, string resetLink)
        {
            _logger.LogWarning(
                "[開発用メール] パスワードリセットリンク ({Email}):\n{Link}",
                email, resetLink);
            return Task.CompletedTask;
        }

        public Task SendPasswordResetCodeAsync(ApplicationUser user, string email, string resetCode)
        {
            _logger.LogWarning(
                "[開発用メール] パスワードリセットコード ({Email}): {Code}",
                email, resetCode);
            return Task.CompletedTask;
        }
    }
}
