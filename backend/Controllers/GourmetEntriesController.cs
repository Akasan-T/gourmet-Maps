using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GourmetMaps.Data;
using GourmetMaps.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace GourmetMaps.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class GourmetEntriesController : ControllerBase
    {
        private const string GuestUserName = "guest-map";
        private readonly GourmetDbContext _context;

        public GourmetEntriesController(GourmetDbContext context)
        {
            _context = context;
        }

        // GET: api/gourmetentries
        [HttpGet]
        public async Task<ActionResult<IEnumerable<GourmetEntryMapItemDto>>> GetGourmetEntries()
        {
            var entries = await _context.GourmetEntries
                .AsNoTracking()
                .Include(entry => entry.Participants)
                    .ThenInclude(participant => participant.ApplicationUser)
                .OrderByDescending(entry => entry.VisitDate)
                .ToListAsync();

            return Ok(entries.Select(ToDto));
        }

        [HttpPost]
        public async Task<ActionResult<GourmetEntryMapItemDto>> CreateGourmetEntry(CreateGourmetEntryRequest request)
        {
            var guestUser = await _context.Users
                .AsNoTracking()
                .SingleOrDefaultAsync(user => user.UserName == GuestUserName);

            if (guestUser is null)
            {
                return Problem("投稿用のゲストユーザーが見つかりませんでした。", statusCode: 500);
            }

            var overallRating = request.OverallRating > 0
                ? request.OverallRating
                : MathF.Round((request.TasteRating + request.RepeatRating) / 2f, 1);

            var entry = new GourmetEntry
            {
                Name = request.Name.Trim(),
                Genre = string.IsNullOrWhiteSpace(request.Genre) ? "未設定" : request.Genre.Trim(),
                VisitDate = request.VisitDate ?? DateTime.UtcNow,
                OverallRating = overallRating,
                TasteRating = request.TasteRating,
                AppearanceRating = overallRating,
                CostPerformanceRating = overallRating,
                VolumeRating = overallRating,
                RepeatRating = request.RepeatRating,
                ReorderRating = request.RepeatRating,
                Memo = string.IsNullOrWhiteSpace(request.Memo) ? string.Empty : request.Memo.Trim(),
                Latitude = request.Latitude,
                Longitude = request.Longitude,
                UserID = guestUser.Id,
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
                .Select(participant => new ParticipantDto(participant.Id, participant.DisplayName ?? participant.UserName!))
                .ToList();

            return CreatedAtAction(nameof(GetGourmetEntries), new { id = entry.GourmetEntryID }, ToDto(entry, participantDtos));
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

        private static IEnumerable<StoreRankingDto> AggregateByStore(IEnumerable<GourmetEntry> entries)
        {
            return entries
                .GroupBy(entry => entry.Name)
                .Select(group =>
                {
                    var latest = group.OrderByDescending(entry => entry.VisitDate).First();
                    return new StoreRankingDto(
                        group.Key,
                        latest.Genre,
                        (float)Math.Round(group.Average(entry => entry.OverallRating), 1),
                        group.Count(),
                        group.Max(entry => entry.VisitDate),
                        latest.Latitude,
                        latest.Longitude);
                })
                .OrderByDescending(store => store.AverageOverallRating)
                .ToList();
        }

        private static GourmetEntryMapItemDto ToDto(GourmetEntry entry)
        {
            var participants = (entry.Participants ?? new List<GourmetEntryParticipant>())
                .Where(participant => participant.ApplicationUser is not null)
                .Select(participant => new ParticipantDto(
                    participant.ApplicationUser.Id,
                    participant.ApplicationUser.DisplayName ?? participant.ApplicationUser.UserName!))
                .ToList();

            return ToDto(entry, participants);
        }

        private static GourmetEntryMapItemDto ToDto(GourmetEntry entry, IReadOnlyList<ParticipantDto> participants)
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
                entry.VolumeRating,
                entry.RepeatRating,
                entry.ReorderRating,
                entry.Memo,
                entry.Latitude,
                entry.Longitude,
                participants);
        }

        public record CreateGourmetEntryRequest(
            string Name,
            string? Genre,
            DateTime? VisitDate,
            float OverallRating,
            float TasteRating,
            float RepeatRating,
            string? Memo,
            float Latitude,
            float Longitude,
            IReadOnlyList<string>? ParticipantUserIds);

        public record ParticipantDto(string Id, string DisplayName);

        public record GourmetEntryMapItemDto(
            int Id,
            string Name,
            string Genre,
            DateTime VisitDate,
            float OverallRating,
            float TasteRating,
            float AppearanceRating,
            float CostPerformanceRating,
            float VolumeRating,
            float RepeatRating,
            float ReorderRating,
            string Memo,
            float? Latitude,
            float? Longitude,
            IReadOnlyList<ParticipantDto> Participants);

        public record StoreRankingDto(
            string Name,
            string Genre,
            float AverageOverallRating,
            int VisitCount,
            DateTime LastVisitDate,
            float? Latitude,
            float? Longitude);

        public record GenreRankingGroupDto(string Genre, IReadOnlyList<StoreRankingDto> Stores);
    }
}
