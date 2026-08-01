using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GourmetMaps.Data;
using GourmetMaps.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace GourmetMaps.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class StoresController : ControllerBase
    {
        // 同じ店舗とみなす距離のしきい値 (メートル)
        private const double DuplicateDistanceMeters = 80;

        private readonly GourmetDbContext _context;

        public StoresController(GourmetDbContext context)
        {
            _context = context;
        }

        // GET: api/stores?lat=&lng=&q=
        // 自店DBの登録済み店舗を返す。lat/lng があれば距離の近い順にソート。
        [HttpGet]
        public async Task<ActionResult<IEnumerable<StoreDto>>> GetStores(
            [FromQuery] float? lat,
            [FromQuery] float? lng,
            [FromQuery] string? q)
        {
            var stores = await _context.Stores.AsNoTracking().ToListAsync();

            IEnumerable<Store> filtered = stores;
            if (!string.IsNullOrWhiteSpace(q))
            {
                var keyword = q.Trim();
                filtered = filtered.Where(store =>
                    store.Name.Contains(keyword, StringComparison.OrdinalIgnoreCase));
            }

            var result = filtered.Select(store => ToDto(store, lat, lng));

            result = (lat.HasValue && lng.HasValue)
                ? result.OrderBy(store => store.Distance ?? double.MaxValue)
                : result.OrderBy(store => store.Name);

            return Ok(result.ToList());
        }

        // GET: api/stores/suggest?name=
        // 手入力の重複を防ぐための類似店舗名サジェスト
        [HttpGet("suggest")]
        public async Task<ActionResult<IEnumerable<StoreDto>>> SuggestSimilar([FromQuery] string? name)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                return Ok(Array.Empty<StoreDto>());
            }

            var keyword = name.Trim();
            var normalized = Normalize(keyword);
            var stores = await _context.Stores.AsNoTracking().ToListAsync();

            var suggestions = stores
                .Where(store =>
                {
                    var storeName = Normalize(store.Name);
                    return storeName.Contains(normalized, StringComparison.OrdinalIgnoreCase)
                        || normalized.Contains(storeName, StringComparison.OrdinalIgnoreCase);
                })
                .Select(store => ToDto(store, null, null))
                .Take(5)
                .ToList();

            return Ok(suggestions);
        }

        // POST: api/stores
        // 位置検索での選択 or 手入力から店舗を登録。既存とみなせる場合はその店舗を返す(重複排除)。
        [HttpPost]
        public async Task<ActionResult<StoreDto>> RegisterStore(RegisterStoreRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest("店舗名は必須です。");
            }

            var name = request.Name.Trim();

            var existingStores = await _context.Stores.ToListAsync();

            // 1) 外部Place ID が一致するものは同一店舗
            Store? match = null;
            if (!string.IsNullOrWhiteSpace(request.ExternalPlaceId))
            {
                match = existingStores.FirstOrDefault(store =>
                    store.ExternalPlaceId == request.ExternalPlaceId);
            }

            // 2) 同名かつ近接している店舗は同一店舗とみなす
            match ??= existingStores.FirstOrDefault(store =>
                string.Equals(store.Name, name, StringComparison.OrdinalIgnoreCase)
                && IsNearby(store, request.Latitude, request.Longitude));

            if (match is not null)
            {
                // 位置情報が欠けていれば補完する
                if (match.Latitude == null && request.Latitude != null)
                {
                    match.Latitude = request.Latitude;
                    match.Longitude = request.Longitude;
                    await _context.SaveChangesAsync();
                }

                return Ok(ToDto(match, null, null));
            }

            var store = new Store
            {
                Name = name,
                Genre = string.IsNullOrWhiteSpace(request.Genre) ? "未設定" : request.Genre.Trim(),
                Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim(),
                Latitude = request.Latitude,
                Longitude = request.Longitude,
                ExternalPlaceId = string.IsNullOrWhiteSpace(request.ExternalPlaceId) ? null : request.ExternalPlaceId.Trim(),
                CreatedByUserId = User.FindFirstValue(ClaimTypes.NameIdentifier),
                CreatedAt = DateTime.UtcNow,
            };

            _context.Stores.Add(store);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetStores), new { }, ToDto(store, null, null));
        }

        private static bool IsNearby(Store store, float? lat, float? lng)
        {
            if (store.Latitude == null || store.Longitude == null || lat == null || lng == null)
            {
                // どちらかに位置情報が無い場合は同名だけで同一とみなす
                return true;
            }

            return DistanceInMeters(store.Latitude.Value, store.Longitude.Value, lat.Value, lng.Value)
                <= DuplicateDistanceMeters;
        }

        private static string Normalize(string value)
        {
            return value.Replace(" ", string.Empty).Replace("　", string.Empty).Trim();
        }

        private static StoreDto ToDto(Store store, float? lat, float? lng)
        {
            double? distance = null;
            if (lat.HasValue && lng.HasValue && store.Latitude.HasValue && store.Longitude.HasValue)
            {
                distance = DistanceInMeters(store.Latitude.Value, store.Longitude.Value, lat.Value, lng.Value);
            }

            return new StoreDto(
                store.StoreID,
                store.Name,
                store.Genre,
                store.Address,
                store.Latitude,
                store.Longitude,
                store.ExternalPlaceId,
                distance);
        }

        private static double DistanceInMeters(double lat1, double lon1, double lat2, double lon2)
        {
            const double earthRadiusMeters = 6371000;
            var dLat = ToRadians(lat2 - lat1);
            var dLon = ToRadians(lon2 - lon1);
            var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                + Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2))
                * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

            return 2 * earthRadiusMeters * Math.Asin(Math.Sqrt(a));
        }

        private static double ToRadians(double degrees) => degrees * Math.PI / 180;

        public record RegisterStoreRequest(
            string Name,
            string? Genre,
            string? Address,
            float? Latitude,
            float? Longitude,
            string? ExternalPlaceId);

        public record StoreDto(
            int Id,
            string Name,
            string Genre,
            string? Address,
            float? Latitude,
            float? Longitude,
            string? ExternalPlaceId,
            double? Distance);
    }
}
