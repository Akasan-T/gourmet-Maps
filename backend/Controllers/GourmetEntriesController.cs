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
                .Where(entry => entry.Latitude.HasValue && entry.Longitude.HasValue)
                .OrderByDescending(entry => entry.VisitDate)
                .Select(entry => new GourmetEntryMapItemDto(
                    entry.GourmetEntryID,
                    entry.Name,
                    entry.Genre,
                    entry.VisitDate,
                    entry.OverallRating,
                    entry.TasteRating,
                    entry.RepeatRating,
                    entry.Memo,
                    entry.Latitude!.Value,
                    entry.Longitude!.Value))
                .ToListAsync();

            return Ok(entries);
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

            return CreatedAtAction(nameof(GetGourmetEntries), new { id = entry.GourmetEntryID }, new GourmetEntryMapItemDto(
                entry.GourmetEntryID,
                entry.Name,
                entry.Genre,
                entry.VisitDate,
                entry.OverallRating,
                entry.TasteRating,
                entry.RepeatRating,
                entry.Memo,
                entry.Latitude ?? 0,
                entry.Longitude ?? 0));
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
            float Longitude);

        public record GourmetEntryMapItemDto(
            int Id,
            string Name,
            string Genre,
            DateTime VisitDate,
            float OverallRating,
            float TasteRating,
            float RepeatRating,
            string Memo,
            float Latitude,
            float Longitude);
    }
}
