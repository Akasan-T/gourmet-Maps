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

        // PUT: api/account/me
        // 表示名 (DisplayName) を更新する。
        [HttpPut("me")]
        public async Task<ActionResult<AccountDto>> UpdateMe(UpdateAccountRequest request)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user is null)
            {
                return Unauthorized();
            }

            var displayName = request.DisplayName?.Trim();
            user.DisplayName = string.IsNullOrWhiteSpace(displayName) ? null : displayName;

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
                titles,
                titles.Contains(InvitesController.OwnerBadgeTitle));
        }

        public record AccountDto(
            string Id,
            string? UserName,
            string? Email,
            string? DisplayName,
            IReadOnlyList<string> Titles,
            bool CanIssueInvites);

        public record UpdateAccountRequest(string? DisplayName);
    }
}
