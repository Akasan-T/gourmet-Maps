using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GourmetMaps.Data;
using GourmetMaps.Services;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace GourmetMaps.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MembersController : ControllerBase
    {
        private const string GuestUserName = "guest-map";
        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
        };

        private readonly GourmetDbContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly TitleEvaluationService _titleEvaluationService;

        public MembersController(
            GourmetDbContext context,
            IWebHostEnvironment env,
            TitleEvaluationService titleEvaluationService)
        {
            _context = context;
            _env = env;
            _titleEvaluationService = titleEvaluationService;
        }

        // GET: api/members
        [HttpGet]
        public async Task<ActionResult<IEnumerable<MemberDto>>> GetMembers()
        {
            var members = await _context.Users
                .AsNoTracking()
                .Where(user => user.DisplayName != null && user.DisplayName != "" && user.UserName != GuestUserName)
                .OrderBy(user => user.DisplayName)
                .Select(user => new MemberDto(user.Id, user.DisplayName!, user.AvatarUrl))
                .ToListAsync();

            return Ok(members);
        }

        // GET: api/members/{id}
        // メンバー個別プロフィール: その人が登録した店舗(投稿)と、獲得済み称号の状況を返す。
        [HttpGet("{id}")]
        public async Task<ActionResult<MemberProfileDto>> GetMember(string id)
        {
            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == id && u.UserName != GuestUserName);

            if (user is null || string.IsNullOrEmpty(user.DisplayName))
            {
                return NotFound();
            }

            // 最新のデータで称号を再評価してから状況を返す(称号図鑑と同じ挙動)。
            await _titleEvaluationService.SyncAsync(id);

            var entries = await _context.GourmetEntries
                .AsNoTracking()
                .Where(entry => entry.UserID == id)
                .OrderByDescending(entry => entry.VisitDate)
                .Select(entry => new MemberEntryDto(
                    entry.GourmetEntryID,
                    entry.Name,
                    entry.Genre,
                    entry.VisitDate,
                    entry.TasteRating,
                    entry.CostPerformanceRating,
                    entry.AppearanceRating,
                    entry.ServiceRating,
                    entry.RepeatRating,
                    entry.VolumeRating,
                    entry.Memo,
                    entry.SceneTag,
                    entry.PriceRange,
                    entry.PhotoUrl,
                    entry.Latitude,
                    entry.Longitude,
                    user.DisplayName!))
                .ToListAsync();

            var storeCount = entries
                .Select(entry => entry.Name)
                .Distinct()
                .Count();

            var earnedTitleNames = await _context.ApplicationUserBadges
                .Where(link => link.ApplicationUserId == id)
                .Select(link => link.Badge.Title)
                .ToListAsync();
            var earnedSet = new HashSet<string>(earnedTitleNames);

            var seeds = await LoadTitleSeedsAsync();
            var titles = seeds
                .Select(seed => new MemberTitleDto(
                    seed.Id,
                    seed.Name,
                    seed.Description,
                    seed.Category,
                    seed.Tier,
                    seed.Humor,
                    earnedSet.Contains(seed.Name)))
                .ToList();
            var earnedCount = titles.Count(title => title.Earned);

            var profile = new MemberProfileDto(
                user.Id,
                user.DisplayName!,
                user.AvatarUrl,
                entries.Count,
                storeCount,
                earnedCount,
                seeds.Count,
                titles,
                entries);

            return Ok(profile);
        }

        private async Task<List<TitleSeed>> LoadTitleSeedsAsync()
        {
            var path = Path.Combine(_env.ContentRootPath, "Data", "titles.json");
            if (!System.IO.File.Exists(path))
            {
                return new List<TitleSeed>();
            }

            await using var stream = System.IO.File.OpenRead(path);
            var seeds = await JsonSerializer.DeserializeAsync<List<TitleSeed>>(stream, JsonOptions);
            return seeds ?? new List<TitleSeed>();
        }

        private record TitleSeed(string Id, string Name, string Description, string Category, int Tier, bool Humor);

        public record MemberDto(string Id, string DisplayName, string? AvatarUrl);

        public record MemberTitleDto(string Id, string Name, string Description, string Category, int Tier, bool Humor, bool Earned);

        public record MemberEntryDto(
            int Id,
            string Name,
            string Genre,
            System.DateTime VisitDate,
            float TasteRating,
            float CostPerformanceRating,
            float AppearanceRating,
            float ServiceRating,
            float RepeatRating,
            float VolumeRating,
            string Memo,
            string? SceneTag,
            string? PriceRange,
            string? PhotoUrl,
            float? Latitude,
            float? Longitude,
            string RecordedByDisplayName);

        public record MemberProfileDto(
            string Id,
            string DisplayName,
            string? AvatarUrl,
            int EntryCount,
            int StoreCount,
            int EarnedTitleCount,
            int TotalTitleCount,
            IReadOnlyList<MemberTitleDto> Titles,
            IReadOnlyList<MemberEntryDto> Entries);
    }
}
