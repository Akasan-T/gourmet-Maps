using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GourmetMaps.Data;
using GourmetMaps.Models;

namespace GourmetMaps.Controllers
{
    // 称号「初代食べる王」保有者だけがワンタイム招待コードを発行できる。
    [ApiController]
    [Route("api/invites")]
    public class InvitesController : ControllerBase
    {
        // 招待コードを発行できる特別称号の名前。Program.cs のシード名と一致させること。
        public const string OwnerBadgeTitle = "初代食べる王";

        // ワンタイムコードの有効期限 (発行から1時間)
        private static readonly TimeSpan CodeLifetime = TimeSpan.FromHours(1);

        private readonly GourmetDbContext _dbContext;
        private readonly UserManager<ApplicationUser> _userManager;

        public InvitesController(GourmetDbContext dbContext, UserManager<ApplicationUser> userManager)
        {
            _dbContext = dbContext;
            _userManager = userManager;
        }

        // POST: api/invites
        // ワンタイム招待コードを1件発行する。
        [HttpPost]
        public async Task<ActionResult<InviteCodeDto>> Create()
        {
            var userId = _userManager.GetUserId(User);
            if (userId is null)
            {
                return Unauthorized();
            }

            if (!await HasOwnerBadgeAsync(userId))
            {
                return Forbid();
            }

            var now = DateTime.UtcNow;
            var invite = new InviteCode
            {
                Code = GenerateCode(),
                CreatedByUserId = userId,
                CreatedAt = now,
                ExpiresAt = now.Add(CodeLifetime),
            };

            _dbContext.InviteCodes.Add(invite);
            await _dbContext.SaveChangesAsync();

            return Ok(ToDto(invite, now));
        }

        // GET: api/invites
        // 自分が発行した招待コードの一覧 (新しい順)。
        [HttpGet]
        public async Task<ActionResult<IEnumerable<InviteCodeDto>>> List()
        {
            var userId = _userManager.GetUserId(User);
            if (userId is null)
            {
                return Unauthorized();
            }

            if (!await HasOwnerBadgeAsync(userId))
            {
                return Forbid();
            }

            var now = DateTime.UtcNow;
            var codes = await _dbContext.InviteCodes
                .Where(code => code.CreatedByUserId == userId)
                .OrderByDescending(code => code.CreatedAt)
                .ToListAsync();

            return Ok(codes.Select(code => ToDto(code, now)));
        }

        private async Task<bool> HasOwnerBadgeAsync(string userId)
        {
            return await _dbContext.ApplicationUserBadges
                .Include(link => link.Badge)
                .AnyAsync(link => link.ApplicationUserId == userId
                    && link.Badge.Title == OwnerBadgeTitle);
        }

        // 読みやすい8文字のコード (紛らわしい文字を除外) を xxxx-xxxx 形式で作る。
        private static string GenerateCode()
        {
            const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
            Span<char> buffer = stackalloc char[8];
            for (var i = 0; i < buffer.Length; i++)
            {
                buffer[i] = alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)];
            }

            return $"{new string(buffer[..4])}-{new string(buffer[4..])}";
        }

        private static InviteCodeDto ToDto(InviteCode invite, DateTime now)
        {
            string status;
            if (invite.UsedAt is not null)
            {
                status = "used";
            }
            else if (invite.ExpiresAt <= now)
            {
                status = "expired";
            }
            else
            {
                status = "active";
            }

            return new InviteCodeDto(invite.Code, invite.CreatedAt, invite.ExpiresAt, invite.UsedAt, status);
        }

        public record InviteCodeDto(
            string Code,
            DateTime CreatedAt,
            DateTime ExpiresAt,
            DateTime? UsedAt,
            string Status);
    }
}
