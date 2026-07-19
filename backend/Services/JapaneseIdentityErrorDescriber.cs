using Microsoft.AspNetCore.Identity;

namespace GourmetMaps.Services
{
    /// <summary>
    /// ASP.NET Core Identity の既定エラーメッセージ(英語)を日本語に置き換える。
    /// パスワード要件などのエラーがそのままフロントエンドに表示されるため。
    /// </summary>
    public class JapaneseIdentityErrorDescriber : IdentityErrorDescriber
    {
        public override IdentityError PasswordTooShort(int length)
            => new() { Code = nameof(PasswordTooShort), Description = $"パスワードは{length}文字以上にしてください。" };

        public override IdentityError PasswordRequiresNonAlphanumeric()
            => new() { Code = nameof(PasswordRequiresNonAlphanumeric), Description = "パスワードには記号を1文字以上含めてください。" };

        public override IdentityError PasswordRequiresDigit()
            => new() { Code = nameof(PasswordRequiresDigit), Description = "パスワードには数字を1文字以上含めてください。" };

        public override IdentityError PasswordRequiresLower()
            => new() { Code = nameof(PasswordRequiresLower), Description = "パスワードには英小文字を1文字以上含めてください。" };

        public override IdentityError PasswordRequiresUpper()
            => new() { Code = nameof(PasswordRequiresUpper), Description = "パスワードには英大文字を1文字以上含めてください。" };

        public override IdentityError PasswordRequiresUniqueChars(int uniqueChars)
            => new() { Code = nameof(PasswordRequiresUniqueChars), Description = $"パスワードには異なる文字を{uniqueChars}種類以上含めてください。" };

        public override IdentityError PasswordMismatch()
            => new() { Code = nameof(PasswordMismatch), Description = "パスワードが正しくありません。" };

        public override IdentityError DuplicateUserName(string userName)
            => new() { Code = nameof(DuplicateUserName), Description = "このメールアドレスは既に登録されています。" };

        public override IdentityError DuplicateEmail(string email)
            => new() { Code = nameof(DuplicateEmail), Description = "このメールアドレスは既に登録されています。" };

        public override IdentityError InvalidEmail(string? email)
            => new() { Code = nameof(InvalidEmail), Description = "メールアドレスの形式が正しくありません。" };

        public override IdentityError InvalidUserName(string? userName)
            => new() { Code = nameof(InvalidUserName), Description = "ユーザー名の形式が正しくありません。" };

        public override IdentityError InvalidToken()
            => new() { Code = nameof(InvalidToken), Description = "コードが正しくないか、有効期限が切れています。" };

        public override IdentityError DefaultError()
            => new() { Code = nameof(DefaultError), Description = "不明なエラーが発生しました。もう一度お試しください。" };
    }
}
