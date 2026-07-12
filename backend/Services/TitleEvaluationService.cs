using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using GourmetMaps.Data;
using GourmetMaps.Models;

namespace GourmetMaps.Services
{
    // titles.json の condition を評価し、達成した称号を Badge/ApplicationUserBadge として自動付与する。
    //
    // 対応範囲: 現在保持しているデータ (投稿・レビュー・評価・写真・価格帯・日時・位置・同行者) だけで
    // 判定できる条件のみを実装する。市区町村/都道府県制覇 (逆ジオコーディング未実装)、天候系、
    // 誕生日/記念日系 (生年月日・登録日を保持していない)、海外判定、および all_titles_complete /
    // admin_awarded / 一部の composite_* のような曖昧・手動枠は対象外 (未対応の type は単に未達成のまま)。
    public class TitleEvaluationService
    {
        private readonly GourmetDbContext _dbContext;
        private readonly IWebHostEnvironment _env;

        private const int LowStarMax = 2;
        private const int HighStarMin = 5;
        private const string LowPriceLabel = "〜1,000円";
        private const string HighPriceLabel = "5,000円〜";

        public TitleEvaluationService(GourmetDbContext dbContext, IWebHostEnvironment env)
        {
            _dbContext = dbContext;
            _env = env;
        }

        // 指定ユーザーの称号を再評価し、新たに達成した分だけ Badge/ApplicationUserBadge を追加する。
        public async Task SyncAsync(string userId)
        {
            var seeds = await LoadSeedsAsync();
            if (seeds.Count == 0)
            {
                return;
            }

            var entries = await _dbContext.GourmetEntries
                .AsNoTracking()
                .Include(entry => entry.Participants)
                .Where(entry => entry.UserID == userId)
                .ToListAsync();

            var stats = new UserStats(entries);
            var earnedNames = new HashSet<string>();

            foreach (var seed in seeds)
            {
                if (Evaluate(seed, stats))
                {
                    earnedNames.Add(seed.Name);
                }
            }

            // composite: 他の称号の達成状況に依存するものは2パス目で判定する
            foreach (var seed in seeds)
            {
                if (earnedNames.Contains(seed.Name))
                {
                    continue;
                }
                if (EvaluateComposite(seed, seeds, earnedNames, stats))
                {
                    earnedNames.Add(seed.Name);
                }
            }

            if (earnedNames.Count == 0)
            {
                return;
            }

            var alreadyOwned = await _dbContext.ApplicationUserBadges
                .Where(link => link.ApplicationUserId == userId)
                .Select(link => link.Badge.Title)
                .ToListAsync();
            var toGrant = earnedNames.Except(alreadyOwned).ToList();
            if (toGrant.Count == 0)
            {
                return;
            }

            var existingBadges = await _dbContext.Badges
                .Where(badge => toGrant.Contains(badge.Title))
                .ToListAsync();
            var badgeByTitle = existingBadges.ToDictionary(badge => badge.Title);

            foreach (var name in toGrant)
            {
                if (!badgeByTitle.TryGetValue(name, out var badge))
                {
                    var seed = seeds.First(s => s.Name == name);
                    badge = new Badge
                    {
                        Title = seed.Name,
                        Description = seed.Description,
                        IconUrl = seed.Icon,
                    };
                    _dbContext.Badges.Add(badge);
                    await _dbContext.SaveChangesAsync();
                    badgeByTitle[name] = badge;
                }

                _dbContext.ApplicationUserBadges.Add(new ApplicationUserBadge
                {
                    ApplicationUserId = userId,
                    BadgeID = badge.BadgeID,
                });
            }

            await _dbContext.SaveChangesAsync();
        }

        private async Task<List<TitleSeed>> LoadSeedsAsync()
        {
            var path = Path.Combine(_env.ContentRootPath, "Data", "titles.json");
            if (!File.Exists(path))
            {
                return new List<TitleSeed>();
            }

            await using var stream = File.OpenRead(path);
            var seeds = await JsonSerializer.DeserializeAsync<List<TitleSeed>>(stream, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
            });
            return seeds ?? new List<TitleSeed>();
        }

        private static bool Evaluate(TitleSeed seed, UserStats stats)
        {
            var condition = seed.Condition;
            var type = condition.GetProperty("type").GetString();
            var value = condition.GetProperty("value");

            switch (type)
            {
                case "post_count_gte":
                    return stats.PostCount >= value.GetInt32();
                case "review_count_gte":
                    return stats.ReviewCount >= value.GetInt32();
                case "genre_visit_count_gte":
                    {
                        var genre = value.GetProperty("genre").GetString() ?? string.Empty;
                        var count = value.GetProperty("count").GetInt32();
                        return stats.GenreCounts.GetValueOrDefault(genre) >= count;
                    }
                case "genre_type_count_gte":
                    return stats.GenreCounts.Count >= value.GetInt32();
                case "five_star_count_gte":
                    return stats.FiveStarCount >= value.GetInt32();
                case "low_star_count_gte":
                    return stats.LowStarCount >= value.GetInt32();
                case "photo_count_gte":
                    return stats.PhotoCount >= value.GetInt32();
                case "low_price_visit_gte":
                    return stats.LowPriceCount >= value.GetInt32();
                case "high_price_visit_gte":
                    return stats.HighPriceCount >= value.GetInt32();
                case "same_store_visit_gte":
                    return stats.MaxSameStoreVisits >= value.GetInt32();
                case "daily_streak_gte":
                    return stats.MaxDailyStreak >= value.GetInt32();
                case "monthly_streak_gte":
                    return stats.MaxMonthlyStoreStreak >= value.GetInt32();
                case "late_night_count":
                    return stats.LateNightCount >= value.GetInt32();
                case "early_morning_count":
                    return stats.EarlyMorningCount >= value.GetInt32();
                case "solo_visit_gte":
                    return stats.SoloCount >= value.GetInt32();
                case "weekend_only_count":
                    return stats.WeekendCount >= value.GetInt32();
                case "weekday_lunch_count":
                    return stats.WeekdayLunchCount >= value.GetInt32();
                case "monday_count":
                    return stats.MondayCount >= value.GetInt32();
                case "friday_night_count":
                    return stats.FridayNightCount >= value.GetInt32();
                case "same_day_three_meals":
                    return stats.HasSameDayThreeMeals;
                case "spring_count":
                    return stats.SpringCount >= value.GetInt32();
                case "summer_count":
                    return stats.SummerCount >= value.GetInt32();
                case "autumn_count":
                    return stats.AutumnCount >= value.GetInt32();
                case "winter_count":
                    return stats.WinterCount >= value.GetInt32();
                case "gw_count":
                    return stats.GoldenWeekCount >= value.GetInt32();
                case "new_year_post":
                    return stats.NewYearCount >= value.GetInt32();
                case "obon_post":
                    return stats.ObonCount >= value.GetInt32();
                case "distance_from_hub_visit":
                    {
                        var km = value.GetProperty("km").GetDouble();
                        var count = value.GetProperty("count").GetInt32();
                        return stats.CountBeyondHubDistance(km) >= count;
                    }
                case "total_distance_gte":
                    return stats.TotalHubDistanceKm >= value.GetDouble();
                case "same_store_duration_years_gte":
                    return stats.MaxSameStoreDurationYears >= value.GetDouble();
                case "multi_store_regular":
                    {
                        var stores = value.GetProperty("stores").GetInt32();
                        var visits = value.GetProperty("visits").GetInt32();
                        return stats.CountStoresWithAtLeast(visits) >= stores;
                    }
                case "group_visit_gte":
                    return stats.GroupVisitCount >= value.GetInt32();
                case "large_group_visit_gte":
                    return stats.LargeGroupVisitCount >= value.GetInt32();
                case "brought_friend_store_gte":
                    return stats.StoresWithCompanionCount >= value.GetInt32();
                case "solo_and_group_balance":
                    {
                        var solo = value.GetProperty("solo").GetInt32();
                        var group = value.GetProperty("group").GetInt32();
                        return stats.SoloCount >= solo && stats.GroupVisitCount >= group;
                    }
                case "tendency_streak_gte":
                    {
                        var kind = value.GetProperty("kind").GetString();
                        var count = value.GetProperty("count").GetInt32();
                        var actual = kind switch
                        {
                            "甘口" => stats.SweetTendencyCount,
                            "辛口" => stats.SpicyTendencyCount,
                            "中庸" => stats.NeutralTendencyCount,
                            _ => 0,
                        };
                        return actual >= count;
                    }
                default:
                    // 未対応の type (天候/市区町村/都道府県/記念日/海外判定/一部composite等) は判定不可なので未達成扱い
                    return false;
            }
        }

        private static bool EvaluateComposite(TitleSeed seed, List<TitleSeed> allSeeds, HashSet<string> earnedNames, UserStats stats)
        {
            var type = seed.Condition.GetProperty("type").GetString();

            switch (type)
            {
                case "composite_both_tendency":
                    {
                        var sweet = allSeeds.Any(s => earnedNames.Contains(s.Name)
                            && s.Condition.GetProperty("type").GetString() == "tendency_streak_gte"
                            && s.Condition.GetProperty("value").GetProperty("kind").GetString() == "甘口");
                        var spicy = allSeeds.Any(s => earnedNames.Contains(s.Name)
                            && s.Condition.GetProperty("type").GetString() == "tendency_streak_gte"
                            && s.Condition.GetProperty("value").GetProperty("kind").GetString() == "辛口");
                        return sweet && spicy;
                    }
                case "composite_post_review_threshold":
                    {
                        var value = seed.Condition.GetProperty("value");
                        return stats.PostCount >= value.GetProperty("post").GetInt32()
                            && stats.ReviewCount >= value.GetProperty("review").GetInt32();
                    }
                case "top_tier_count_gte":
                    {
                        var required = seed.Condition.GetProperty("value").GetInt32();
                        var categoriesAchieved = allSeeds
                            .Where(s => s.Category != "legendary_complete")
                            .GroupBy(s => s.Category)
                            .Count(group =>
                            {
                                var maxTier = group.Max(s => s.Tier);
                                return group.Any(s => s.Tier == maxTier && earnedNames.Contains(s.Name));
                            });
                        return categoriesAchieved >= required;
                    }
                default:
                    return false;
            }
        }

        private record TitleSeed(
            string Id,
            string Name,
            string Description,
            string Category,
            int Tier,
            bool Humor,
            string? Icon,
            JsonElement Condition);

        // ユーザーの投稿群から称号判定に必要な集計値をまとめて算出する
        private class UserStats
        {
            public int PostCount { get; }
            public int ReviewCount { get; }
            public Dictionary<string, int> GenreCounts { get; } = new();
            public int FiveStarCount { get; }
            public int LowStarCount { get; }
            public int PhotoCount { get; }
            public int LowPriceCount { get; }
            public int HighPriceCount { get; }
            public int MaxSameStoreVisits { get; }
            public int MaxDailyStreak { get; }
            public int MaxMonthlyStoreStreak { get; }
            public int LateNightCount { get; }
            public int EarlyMorningCount { get; }
            public int SoloCount { get; }
            public int GroupVisitCount { get; }
            public int LargeGroupVisitCount { get; }
            public int StoresWithCompanionCount { get; }
            public int WeekendCount { get; }
            public int WeekdayLunchCount { get; }
            public int MondayCount { get; }
            public int FridayNightCount { get; }
            public bool HasSameDayThreeMeals { get; }
            public int SpringCount { get; }
            public int SummerCount { get; }
            public int AutumnCount { get; }
            public int WinterCount { get; }
            public int GoldenWeekCount { get; }
            public int NewYearCount { get; }
            public int ObonCount { get; }
            public double TotalHubDistanceKm { get; }
            public double MaxSameStoreDurationYears { get; }
            public int SweetTendencyCount { get; }
            public int SpicyTendencyCount { get; }
            public int NeutralTendencyCount { get; }

            private readonly List<GourmetEntry> _entries;
            private readonly (double lat, double lng)? _hub;

            public UserStats(List<GourmetEntry> entries)
            {
                _entries = entries;
                PostCount = entries.Count;
                ReviewCount = entries.Count(e => !string.IsNullOrWhiteSpace(e.Memo));
                PhotoCount = entries.Count(e => !string.IsNullOrWhiteSpace(e.PhotoUrl));
                LowPriceCount = entries.Count(e => e.PriceRange == LowPriceLabel);
                HighPriceCount = entries.Count(e => e.PriceRange == HighPriceLabel);
                FiveStarCount = entries.Count(e => e.OverallRating >= HighStarMin);
                LowStarCount = entries.Count(e => e.OverallRating > 0 && e.OverallRating <= LowStarMax);

                foreach (var e in entries)
                {
                    var genre = string.IsNullOrWhiteSpace(e.Genre) ? "未設定" : e.Genre;
                    GenreCounts[genre] = GenreCounts.GetValueOrDefault(genre) + 1;
                }

                MaxSameStoreVisits = entries
                    .Where(e => e.StoreID.HasValue)
                    .GroupBy(e => e.StoreID!.Value)
                    .Select(g => g.Count())
                    .DefaultIfEmpty(0)
                    .Max();

                MaxDailyStreak = ComputeMaxDateStreak(entries.Select(e => e.VisitDate.Date).Distinct());

                MaxMonthlyStoreStreak = entries
                    .Where(e => e.StoreID.HasValue)
                    .GroupBy(e => e.StoreID!.Value)
                    .Select(g => ComputeMaxMonthStreak(g.Select(e => new DateTime(e.VisitDate.Year, e.VisitDate.Month, 1)).Distinct()))
                    .DefaultIfEmpty(0)
                    .Max();

                MaxSameStoreDurationYears = entries
                    .Where(e => e.StoreID.HasValue)
                    .GroupBy(e => e.StoreID!.Value)
                    .Where(g => g.Count() >= 2)
                    .Select(g => (g.Max(e => e.VisitDate) - g.Min(e => e.VisitDate)).TotalDays / 365.0)
                    .DefaultIfEmpty(0)
                    .Max();

                LateNightCount = entries.Count(e => e.VisitDate.Hour >= 22 || e.VisitDate.Hour < 4);
                EarlyMorningCount = entries.Count(e => e.VisitDate.Hour is >= 5 and < 9);
                WeekdayLunchCount = entries.Count(e => e.VisitDate.DayOfWeek is >= DayOfWeek.Monday and <= DayOfWeek.Friday
                    && e.VisitDate.Hour is >= 11 and < 14);
                MondayCount = entries.Count(e => e.VisitDate.DayOfWeek == DayOfWeek.Monday);
                FridayNightCount = entries.Count(e => e.VisitDate.DayOfWeek == DayOfWeek.Friday && e.VisitDate.Hour is >= 18 and < 24);
                WeekendCount = entries.Count(e => e.VisitDate.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday);

                SpringCount = entries.Count(e => e.VisitDate.Month is >= 3 and <= 5);
                SummerCount = entries.Count(e => e.VisitDate.Month is >= 6 and <= 8);
                AutumnCount = entries.Count(e => e.VisitDate.Month is >= 9 and <= 11);
                WinterCount = entries.Count(e => e.VisitDate.Month == 12 || e.VisitDate.Month <= 2);

                GoldenWeekCount = entries.Count(e => (e.VisitDate.Month == 4 && e.VisitDate.Day >= 29)
                    || (e.VisitDate.Month == 5 && e.VisitDate.Day <= 5));
                NewYearCount = entries.Count(e => (e.VisitDate.Month == 12 && e.VisitDate.Day >= 29)
                    || (e.VisitDate.Month == 1 && e.VisitDate.Day <= 3));
                ObonCount = entries.Count(e => e.VisitDate.Month == 8 && e.VisitDate.Day is >= 13 and <= 16);

                HasSameDayThreeMeals = entries
                    .GroupBy(e => e.VisitDate.Date)
                    .Any(g => g.Select(MealBucket).Distinct().Count() >= 3);

                SoloCount = entries.Count(e => (e.Participants?.Count ?? 0) == 0);
                GroupVisitCount = entries.Count(e => (e.Participants?.Count ?? 0) >= 1);
                LargeGroupVisitCount = entries.Count(e => (e.Participants?.Count ?? 0) >= 4);
                StoresWithCompanionCount = entries
                    .Where(e => (e.Participants?.Count ?? 0) >= 1 && e.StoreID.HasValue)
                    .Select(e => e.StoreID!.Value)
                    .Distinct()
                    .Count();

                SweetTendencyCount = entries.Count(e => e.OverallRating >= 4);
                SpicyTendencyCount = entries.Count(e => e.OverallRating > 0 && e.OverallRating <= 2);
                NeutralTendencyCount = entries.Count(e => (int)Math.Round(e.OverallRating) == 3);

                var located = entries.Where(e => e.Latitude.HasValue && e.Longitude.HasValue).ToList();
                if (located.Count > 0)
                {
                    var hubLat = located.Average(e => (double)e.Latitude!.Value);
                    var hubLng = located.Average(e => (double)e.Longitude!.Value);
                    _hub = (hubLat, hubLng);
                    TotalHubDistanceKm = located.Sum(e => HaversineKm(hubLat, hubLng, e.Latitude!.Value, e.Longitude!.Value));
                }
            }

            public int CountBeyondHubDistance(double km)
            {
                if (_hub is null)
                {
                    return 0;
                }
                var (hubLat, hubLng) = _hub.Value;
                return _entries.Count(e => e.Latitude.HasValue && e.Longitude.HasValue
                    && HaversineKm(hubLat, hubLng, e.Latitude.Value, e.Longitude.Value) >= km);
            }

            public int CountStoresWithAtLeast(int visits)
            {
                return _entries
                    .Where(e => e.StoreID.HasValue)
                    .GroupBy(e => e.StoreID!.Value)
                    .Count(g => g.Count() >= visits);
            }

            private static int MealBucket(GourmetEntry e) => e.VisitDate.Hour switch
            {
                < 11 => 0,  // 朝
                < 15 => 1,  // 昼
                _ => 2,     // 夜
            };

            private static int ComputeMaxDateStreak(IEnumerable<DateTime> dates)
            {
                var sorted = dates.OrderBy(d => d).ToList();
                if (sorted.Count == 0) return 0;
                var best = 1;
                var current = 1;
                for (var i = 1; i < sorted.Count; i++)
                {
                    current = (sorted[i] - sorted[i - 1]).Days == 1 ? current + 1 : 1;
                    best = Math.Max(best, current);
                }
                return best;
            }

            private static int ComputeMaxMonthStreak(IEnumerable<DateTime> months)
            {
                var sorted = months.OrderBy(m => m).ToList();
                if (sorted.Count == 0) return 0;
                var best = 1;
                var current = 1;
                for (var i = 1; i < sorted.Count; i++)
                {
                    var diff = ((sorted[i].Year - sorted[i - 1].Year) * 12) + sorted[i].Month - sorted[i - 1].Month;
                    current = diff == 1 ? current + 1 : 1;
                    best = Math.Max(best, current);
                }
                return best;
            }

            private static double HaversineKm(double lat1, double lng1, double lat2, double lng2)
            {
                const double earthRadiusKm = 6371.0;
                var dLat = ToRadians(lat2 - lat1);
                var dLng = ToRadians(lng2 - lng1);
                var a = (Math.Sin(dLat / 2) * Math.Sin(dLat / 2))
                    + (Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) * Math.Sin(dLng / 2) * Math.Sin(dLng / 2));
                var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
                return earthRadiusKm * c;
            }

            private static double ToRadians(double deg) => deg * Math.PI / 180.0;
        }
    }
}
