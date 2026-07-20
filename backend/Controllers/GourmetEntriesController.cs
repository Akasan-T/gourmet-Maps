using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GourmetMaps.Data;
using GourmetMaps.Models;
using GourmetMaps.Services;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace GourmetMaps.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class GourmetEntriesController : ControllerBase
    {
        private readonly GourmetDbContext _context;
        private readonly TitleEvaluationService _titleEvaluationService;

        public GourmetEntriesController(GourmetDbContext context, TitleEvaluationService titleEvaluationService)
        {
            _context = context;
            _titleEvaluationService = titleEvaluationService;
        }

        // GET: api/gourmetentries
        [HttpGet]
        public async Task<ActionResult<IEnumerable<GourmetEntryMapItemDto>>> GetGourmetEntries()
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            var entries = await _context.GourmetEntries
                .AsNoTracking()
                .Include(entry => entry.User)
                .Include(entry => entry.Participants)
                    .ThenInclude(participant => participant.ApplicationUser)
                .OrderByDescending(entry => entry.VisitDate)
                .ToListAsync();

            return Ok(entries.Select(entry => ToDto(entry, currentUserId)));
        }

        [HttpPost]
        public async Task<ActionResult<GourmetEntryMapItemDto>> CreateGourmetEntry(CreateGourmetEntryRequest request)
        {
            // 記録はログイン中のユーザーに紐付ける。
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            // 店舗マスタを解決する:
            //  - StoreId 指定あり → その店舗へ蓄積 (位置検索で選択したケース)
            //  - 指定なし → 店名で検索し、無ければ新規作成 (手入力のケース)
            var store = await ResolveStoreAsync(request, userId);

            var storeName = store?.Name ?? request.Name.Trim();
            var genre = store?.Genre ?? (string.IsNullOrWhiteSpace(request.Genre) ? "未設定" : request.Genre.Trim());

            // ピンは店舗マスタの緯度経度を優先 (位置検索:その地点 / 手入力:登録地点)
            var latitude = store?.Latitude ?? request.Latitude;
            var longitude = store?.Longitude ?? request.Longitude;

            // 総合スコアは「また行きたいか」を基準に採用する
            var overallRating = request.RepeatRating > 0
                ? request.RepeatRating
                : (request.OverallRating > 0 ? request.OverallRating : request.TasteRating);

            var entry = new GourmetEntry
            {
                Name = storeName,
                Genre = genre,
                VisitDate = request.VisitDate ?? DateTime.UtcNow,
                OverallRating = overallRating,
                TasteRating = request.TasteRating,
                CostPerformanceRating = request.CostRating > 0 ? request.CostRating : overallRating,
                AppearanceRating = request.AtmosphereRating > 0 ? request.AtmosphereRating : overallRating,
                ServiceRating = request.ServiceRating > 0 ? request.ServiceRating : overallRating,
                RepeatRating = request.RepeatRating,
                VolumeRating = overallRating,
                ReorderRating = request.RepeatRating,
                Memo = string.IsNullOrWhiteSpace(request.Memo) ? string.Empty : request.Memo.Trim(),
                SceneTag = string.IsNullOrWhiteSpace(request.SceneTag) ? null : request.SceneTag.Trim(),
                PriceRange = string.IsNullOrWhiteSpace(request.PriceRange) ? null : request.PriceRange.Trim(),
                PhotoUrl = string.IsNullOrWhiteSpace(request.PhotoUrl) ? null : request.PhotoUrl.Trim(),
                Latitude = latitude,
                Longitude = longitude,
                StoreID = store?.StoreID,
                UserID = userId,
            };

            _context.GourmetEntries.Add(entry);
            await _context.SaveChangesAsync();

            var participants = new List<ApplicationUser>();
            if (request.ParticipantUserIds is { Count: > 0 })
            {
                participants = await _context.Users
                    .Where(user => request.ParticipantUserIds.Contains(user.Id))
                    .ToListAsync();

                foreach (var participant in participants)
                {
                    _context.GourmetEntryParticipants.Add(new GourmetEntryParticipant
                    {
                        GourmetEntryID = entry.GourmetEntryID,
                        ApplicationUserId = participant.Id,
                    });
                }

                await _context.SaveChangesAsync();
            }

            var participantDtos = participants
                .Select(participant => new ParticipantDto(
                    participant.Id,
                    participant.DisplayName ?? participant.UserName!,
                    participant.AvatarUrl))
                .ToList();

            await _titleEvaluationService.SyncAsync(userId);

            var recordedByUser = await _context.Users.FindAsync(userId);
            var recordedByDisplayName = recordedByUser?.DisplayName ?? recordedByUser?.UserName;

            return CreatedAtAction(
                nameof(GetGourmetEntries),
                new { id = entry.GourmetEntryID },
                ToDto(entry, participantDtos, recordedByDisplayName, userId));
        }

        // DELETE: api/gourmetentries/5
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteGourmetEntry(int id)
        {
            var entry = await _context.GourmetEntries.FindAsync(id);
            if (entry is null)
            {
                return NotFound();
            }

            // 投稿した本人以外は削除できない
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(currentUserId) || currentUserId != entry.UserID)
            {
                return Forbid();
            }

            // 一緒に行ったメンバーの中間レコードを先に削除する
            var participants = await _context.GourmetEntryParticipants
                .Where(participant => participant.GourmetEntryID == id)
                .ToListAsync();
            _context.GourmetEntryParticipants.RemoveRange(participants);

            _context.GourmetEntries.Remove(entry);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // GET: api/gourmetentries/rankings/overall
        [HttpGet("rankings/overall")]
        public async Task<ActionResult<IEnumerable<StoreRankingDto>>> GetOverallRanking()
        {
            var entries = await _context.GourmetEntries.AsNoTracking().ToListAsync();
            return Ok(AggregateByStore(entries));
        }

        // GET: api/gourmetentries/rankings/genres
        [HttpGet("rankings/genres")]
        public async Task<ActionResult<IEnumerable<GenreRankingGroupDto>>> GetGenreRankings()
        {
            var entries = await _context.GourmetEntries.AsNoTracking().ToListAsync();

            var groups = entries
                .GroupBy(entry => string.IsNullOrWhiteSpace(entry.Genre) ? "未設定" : entry.Genre)
                .Select(group => new GenreRankingGroupDto(group.Key, AggregateByStore(group).ToList()))
                .OrderBy(group => group.Genre)
                .ToList();

            return Ok(groups);
        }

        // GET: api/gourmetentries/rankings/companions/{memberId}
        [HttpGet("rankings/companions/{memberId}")]
        public async Task<ActionResult<IEnumerable<StoreRankingDto>>> GetCompanionRanking(string memberId)
        {
            var entries = await _context.GourmetEntries
                .AsNoTracking()
                .Where(entry => entry.Participants.Any(participant => participant.ApplicationUserId == memberId))
                .ToListAsync();

            return Ok(AggregateByStore(entries));
        }

        // 評価者数が少ない店舗が上位に来すぎないよう平均方向へ補正する重み (最小信頼票数)
        private const float BayesianConfidence = 3f;

        // 店舗を解決する。StoreId 指定があればそれを、無ければ店名で検索し、
        // 見つからなければ新規に店舗マスタへ登録する。
        private async Task<Store?> ResolveStoreAsync(CreateGourmetEntryRequest request, string userId)
        {
            if (request.StoreId is int storeId)
            {
                var existing = await _context.Stores.FindAsync(storeId);
                if (existing is not null)
                {
                    return existing;
                }
            }

            var name = request.Name.Trim();
            if (name.Length == 0)
            {
                return null;
            }

            var byName = await _context.Stores
                .FirstOrDefaultAsync(store => store.Name == name);
            if (byName is not null)
            {
                if (byName.Latitude == null && request.Latitude != null)
                {
                    byName.Latitude = request.Latitude;
                    byName.Longitude = request.Longitude;
                    await _context.SaveChangesAsync();
                }

                return byName;
            }

            var created = new Store
            {
                Name = name,
                Genre = string.IsNullOrWhiteSpace(request.Genre) ? "未設定" : request.Genre.Trim(),
                Latitude = request.Latitude,
                Longitude = request.Longitude,
                ExternalPlaceId = string.IsNullOrWhiteSpace(request.ExternalPlaceId) ? null : request.ExternalPlaceId.Trim(),
                CreatedByUserId = userId,
                CreatedAt = DateTime.UtcNow,
            };

            _context.Stores.Add(created);
            await _context.SaveChangesAsync();

            return created;
        }

        private static IEnumerable<StoreRankingDto> AggregateByStore(IEnumerable<GourmetEntry> entries)
        {
            var materialized = entries.ToList();
            if (materialized.Count == 0)
            {
                return new List<StoreRankingDto>();
            }

            // Bayesian 平均のための事前平均 m: 全評価の「また行きたいか」平均
            var priorMean = (float)materialized.Average(entry => entry.RepeatRating);

            return materialized
                // レガシー行(StoreID=null)は店名で束ねる
                .GroupBy(entry => entry.StoreID.HasValue ? $"id:{entry.StoreID.Value}" : $"name:{entry.Name}")
                .Select(group =>
                {
                    var latest = group.OrderByDescending(entry => entry.VisitDate).First();
                    var count = group.Count();
                    var average = (float)group.Average(entry => entry.RepeatRating);

                    // Bayesian: (C * m + n * R) / (C + n)
                    var bayesian = (BayesianConfidence * priorMean + count * average)
                        / (BayesianConfidence + count);

                    return new StoreRankingDto(
                        latest.Name,
                        latest.Genre,
                        (float)Math.Round(average, 1),
                        (float)Math.Round(bayesian, 2),
                        count,
                        group.Max(entry => entry.VisitDate),
                        latest.Latitude,
                        latest.Longitude);
                })
                .OrderByDescending(store => store.BayesianScore)
                .ThenByDescending(store => store.AverageOverallRating)
                .ToList();
        }

        private static GourmetEntryMapItemDto ToDto(GourmetEntry entry, string? currentUserId)
        {
            var participants = (entry.Participants ?? new List<GourmetEntryParticipant>())
                .Where(participant => participant.ApplicationUser is not null)
                .Select(participant => new ParticipantDto(
                    participant.ApplicationUser.Id,
                    participant.ApplicationUser.DisplayName ?? participant.ApplicationUser.UserName!,
                    participant.ApplicationUser.AvatarUrl))
                .ToList();

            var recordedByDisplayName = entry.User?.DisplayName ?? entry.User?.UserName;

            return ToDto(entry, participants, recordedByDisplayName, currentUserId);
        }

        private static GourmetEntryMapItemDto ToDto(
            GourmetEntry entry,
            IReadOnlyList<ParticipantDto> participants,
            string? recordedByDisplayName,
            string? currentUserId)
        {
            return new GourmetEntryMapItemDto(
                entry.GourmetEntryID,
                entry.Name,
                entry.Genre,
                entry.VisitDate,
                entry.OverallRating,
                entry.TasteRating,
                entry.AppearanceRating,
                entry.CostPerformanceRating,
                entry.ServiceRating,
                entry.VolumeRating,
                entry.RepeatRating,
                entry.ReorderRating,
                entry.Memo,
                entry.SceneTag,
                entry.PriceRange,
                entry.PhotoUrl,
                entry.Latitude,
                entry.Longitude,
                entry.StoreID,
                participants,
                recordedByDisplayName,
                !string.IsNullOrEmpty(currentUserId) && currentUserId == entry.UserID);
        }

        // 評価は 0〜5 スケール。範囲外・過大な文字列・巨大な写真データはサーバー側で弾く
        // ([ApiController] がデータ注釈違反を自動的に 400 として返す)。
        // レコードの検証属性はコンストラクタ引数に直接付ける必要がある ([property:] は不可)。
        public record CreateGourmetEntryRequest(
            [Required][StringLength(200, MinimumLength = 1)] string Name,
            [StringLength(50)] string? Genre,
            DateTime? VisitDate,
            [Range(0, 5)] float OverallRating,
            [Range(0, 5)] float TasteRating,
            [Range(0, 5)] float CostRating,
            [Range(0, 5)] float AtmosphereRating,
            [Range(0, 5)] float ServiceRating,
            [Range(0, 5)] float RepeatRating,
            [StringLength(2000)] string? Memo,
            [StringLength(50)] string? SceneTag,
            [StringLength(50)] string? PriceRange,
            // 縮小済み写真の data URL 上限 (1MB)。肥大化した投稿での DB 圧迫を防ぐ安全弁。
            [StringLength(1_000_000)] string? PhotoUrl,
            [Range(-90, 90)] float Latitude,
            [Range(-180, 180)] float Longitude,
            int? StoreId,
            [StringLength(200)] string? ExternalPlaceId,
            IReadOnlyList<string>? ParticipantUserIds);

        public record ParticipantDto(string Id, string DisplayName, string? AvatarUrl);

        public record GourmetEntryMapItemDto(
            int Id,
            string Name,
            string Genre,
            DateTime VisitDate,
            float OverallRating,
            float TasteRating,
            float AppearanceRating,
            float CostPerformanceRating,
            float ServiceRating,
            float VolumeRating,
            float RepeatRating,
            float ReorderRating,
            string Memo,
            string? SceneTag,
            string? PriceRange,
            string? PhotoUrl,
            float? Latitude,
            float? Longitude,
            int? StoreId,
            IReadOnlyList<ParticipantDto> Participants,
            string? RecordedByDisplayName,
            bool CanDelete);

        public record StoreRankingDto(
            string Name,
            string Genre,
            float AverageOverallRating,
            float BayesianScore,
            int VisitCount,
            DateTime LastVisitDate,
            float? Latitude,
            float? Longitude);

        public record GenreRankingGroupDto(string Genre, IReadOnlyList<StoreRankingDto> Stores);
    }
}
