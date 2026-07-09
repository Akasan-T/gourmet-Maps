using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GourmetMaps.Data;
using GourmetMaps.Models;

namespace GourmetMaps.Controllers
{
    // 称号図鑑用に、全称号 (Data/titles.json) とログイン中ユーザーの獲得状況を返す。
    // 称号の獲得判定エンジンは未実装のため、獲得済みは付与済みバッジ名との一致で判定する
    // (将来エンジンが同名バッジを付与すれば、この一覧に自動で反映される)。
    [ApiController]
    [Route("api/titles")]
    [Authorize]
    public class TitlesController : ControllerBase
    {
        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
        };

        private readonly IWebHostEnvironment _env;
        private readonly GourmetDbContext _dbContext;
        private readonly UserManager<ApplicationUser> _userManager;

        public TitlesController(
            IWebHostEnvironment env,
            GourmetDbContext dbContext,
            UserManager<ApplicationUser> userManager)
        {
            _env = env;
            _dbContext = dbContext;
            _userManager = userManager;
        }

        // GET: api/titles
        [HttpGet]
        public async Task<ActionResult<IEnumerable<TitleDto>>> List()
        {
            var userId = _userManager.GetUserId(User);
            if (userId is null)
            {
                return Unauthorized();
            }

            var path = Path.Combine(_env.ContentRootPath, "Data", "titles.json");
            if (!System.IO.File.Exists(path))
            {
                return Ok(Array.Empty<TitleDto>());
            }

            List<TitleSeed>? seeds;
            await using (var stream = System.IO.File.OpenRead(path))
            {
                seeds = await JsonSerializer.DeserializeAsync<List<TitleSeed>>(stream, JsonOptions);
            }
            seeds ??= new List<TitleSeed>();

            var earnedTitles = await _dbContext.ApplicationUserBadges
                .Where(link => link.ApplicationUserId == userId)
                .Select(link => link.Badge.Title)
                .ToListAsync();
            var earnedSet = new HashSet<string>(earnedTitles);

            var result = seeds.Select(seed => new TitleDto(
                seed.Id,
                seed.Name,
                seed.Description,
                seed.Category,
                seed.Tier,
                seed.Humor,
                earnedSet.Contains(seed.Name)));

            return Ok(result);
        }

        // titles.json の1件分 (condition は一覧表示に不要なので読み飛ばす)
        private record TitleSeed(string Id, string Name, string Description, string Category, int Tier, bool Humor);

        public record TitleDto(
            string Id,
            string Name,
            string Description,
            string Category,
            int Tier,
            bool Humor,
            bool Earned);
    }
}
