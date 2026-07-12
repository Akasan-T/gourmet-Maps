using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GourmetMaps.Data;
using GourmetMaps.Models;
using System.Threading.Tasks;

namespace GourmetMaps.Controllers
{
    // ログイン中ユーザー自身のプロフィール情報を扱うエンドポイント。
    // 認証は Identity API (Bearer トークン) で行うため [Authorize] で保護する。
    [ApiController]
    [Route("api/account")]
    [Authorize]
    public class AccountController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly GourmetDbContext _dbContext;

        public AccountController(UserManager<ApplicationUser> userManager, GourmetDbContext dbContext)
        {
            _userManager = userManager;
            _dbContext = dbContext;
        }

        // GET: api/account/me
        // 現在ログインしているユーザーの情報を返す。
        [HttpGet("me")]
        public async Task<ActionResult<AccountDto>> GetMe()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user is null)
            {
                return Unauthorized();
            }

            var titles = await _dbContext.ApplicationUserBadges
                .Where(link => link.ApplicationUserId == user.Id)
                .Select(link => link.Badge.Title)
                .ToListAsync();

            return Ok(ToDto(user, titles));
        }

        // アイコン画像 (data URL) の最大長。肥大化した画像でDBを圧迫しないための安全弁。
        private const int MaxAvatarUrlLength = 400_000;

        // PUT: api/account/me
        // 表示名 (DisplayName) とアイコン画像 (AvatarUrl) を更新する。
        [HttpPut("me")]
        public async Task<ActionResult<AccountDto>> UpdateMe(UpdateAccountRequest request)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user is null)
            {
                return Unauthorized();
            }

            if (request.AvatarUrl is not null && request.AvatarUrl.Length > MaxAvatarUrlLength)
            {
                return ValidationProblem("アイコン画像が大きすぎます。もう少し小さい画像をお試しください。");
            }

            var displayName = request.DisplayName?.Trim();
            user.DisplayName = string.IsNullOrWhiteSpace(displayName) ? null : displayName;

            if (request.AvatarUrl is not null)
            {
                var avatarUrl = request.AvatarUrl.Trim();
                user.AvatarUrl = string.IsNullOrWhiteSpace(avatarUrl) ? null : avatarUrl;
            }

            var result = await _userManager.UpdateAsync(user);
            if (!result.Succeeded)
            {
                return ValidationProblem(string.Join(" ", result.Errors.Select(error => error.Description)));
            }

            var titles = await _dbContext.ApplicationUserBadges
                .Where(link => link.ApplicationUserId == user.Id)
                .Select(link => link.Badge.Title)
                .ToListAsync();

            return Ok(ToDto(user, titles));
        }

        private static AccountDto ToDto(ApplicationUser user, IReadOnlyList<string> titles)
        {
            // UserName / Email はメールのハッシュ値なので、外部にはそのまま返さない。
            return new AccountDto(
                user.Id,
                null,
                null,
                user.DisplayName,
                user.AvatarUrl,
                titles,
                titles.Contains(InvitesController.OwnerBadgeTitle));
        }

        public record AccountDto(
            string Id,
            string? UserName,
            string? Email,
            string? DisplayName,
            string? AvatarUrl,
            IReadOnlyList<string> Titles,
            bool CanIssueInvites);

        public record UpdateAccountRequest(string? DisplayName, string? AvatarUrl);
    }
}
