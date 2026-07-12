using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GourmetMaps.Controllers
{
    // Google Places API (New) を使った周辺・キーワード検索のバックエンド代理呼び出し。
    // APIキーをフロントに一切渡さないため、ここでGoogleに問い合わせて結果だけ返す。
    // 自店DB(StoresController)・OSM(Overpassはフロントから直接)と合わせて、
    // フロント側 (QuickComposer.jsx) でマージして候補一覧を作る。
    [ApiController]
    [Route("api/places")]
    [Authorize]
    public class PlacesController : ControllerBase
    {
        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
        };

        // Nearby Search (キーワード無し) で使う既定の店舗種別
        private static readonly string[] NearbyIncludedTypes = { "restaurant", "cafe", "bar" };

        // Google の primaryType/types → アプリ側のジャンル固定リストへの雑なマッピング
        private static readonly Dictionary<string, string> GenreMap = new()
        {
            ["ramen_restaurant"] = "ラーメン",
            ["yakiniku_restaurant"] = "焼肉",
            ["cafe"] = "カフェ",
            ["coffee_shop"] = "カフェ",
            ["izakaya_restaurant"] = "居酒屋",
            ["bar"] = "居酒屋",
            ["pub"] = "居酒屋",
            ["sushi_restaurant"] = "寿司",
            ["italian_restaurant"] = "イタリアン",
        };

        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;

        public PlacesController(IHttpClientFactory httpClientFactory, IConfiguration configuration)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
        }

        // GET: api/places/search?lat=&lng=&q=
        [HttpGet("search")]
        public async Task<ActionResult<IEnumerable<PlaceCandidateDto>>> Search(
            [FromQuery] double lat,
            [FromQuery] double lng,
            [FromQuery] string? q,
            [FromQuery] double radiusMeters = 600)
        {
            var apiKey = _configuration["Places:GoogleApiKey"];
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                // キー未設定でもアプリ全体が壊れないよう、空一覧を返す (自店DB/OSMだけで動作継続)
                return Ok(Array.Empty<PlaceCandidateDto>());
            }

            var client = _httpClientFactory.CreateClient("GooglePlaces");
            var keyword = q?.Trim();

            try
            {
                using var request = string.IsNullOrEmpty(keyword)
                    ? BuildNearbyRequest(lat, lng, radiusMeters)
                    : BuildTextSearchRequest(lat, lng, radiusMeters, keyword);

                request.Headers.Add("X-Goog-Api-Key", apiKey);
                request.Headers.Add("X-Goog-FieldMask", "places.id,places.displayName,places.location,places.primaryType");

                using var response = await client.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                {
                    return Ok(Array.Empty<PlaceCandidateDto>());
                }

                var body = await response.Content.ReadAsStringAsync();
                var parsed = JsonSerializer.Deserialize<PlacesSearchResponse>(body, JsonOptions);
                var places = parsed?.Places ?? new List<GooglePlace>();

                var result = places
                    .Where(place => place.DisplayName?.Text is not null && place.Location is not null)
                    .Select(place => ToDto(place, lat, lng))
                    .OrderBy(dto => dto.Distance ?? double.MaxValue)
                    .Take(20)
                    .ToList();

                return Ok(result);
            }
            catch
            {
                // Google側の障害・タイムアウト等でも他の検索元は生かす
                return Ok(Array.Empty<PlaceCandidateDto>());
            }
        }

        private static HttpRequestMessage BuildNearbyRequest(double lat, double lng, double radiusMeters)
        {
            var payload = new
            {
                includedTypes = NearbyIncludedTypes,
                maxResultCount = 20,
                locationRestriction = new
                {
                    circle = new
                    {
                        center = new { latitude = lat, longitude = lng },
                        radius = radiusMeters,
                    },
                },
                languageCode = "ja",
            };

            return CreateJsonRequest("https://places.googleapis.com/v1/places:searchNearby", payload);
        }

        private static HttpRequestMessage BuildTextSearchRequest(double lat, double lng, double radiusMeters, string keyword)
        {
            var payload = new
            {
                textQuery = keyword,
                locationBias = new
                {
                    circle = new
                    {
                        center = new { latitude = lat, longitude = lng },
                        radius = radiusMeters,
                    },
                },
                languageCode = "ja",
            };

            return CreateJsonRequest("https://places.googleapis.com/v1/places:searchText", payload);
        }

        private static HttpRequestMessage CreateJsonRequest(string url, object payload)
        {
            var request = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = new StringContent(JsonSerializer.Serialize(payload)),
            };
            request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
            return request;
        }

        private static PlaceCandidateDto ToDto(GooglePlace place, double lat, double lng)
        {
            var genre = place.PrimaryType is not null && GenreMap.TryGetValue(place.PrimaryType, out var mapped)
                ? mapped
                : "その他";

            double? distance = place.Location is not null
                ? DistanceInMeters(lat, lng, place.Location.Latitude, place.Location.Longitude)
                : null;

            return new PlaceCandidateDto(
                $"google:{place.Id}",
                place.DisplayName!.Text!,
                genre,
                place.Location?.Latitude,
                place.Location?.Longitude,
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

        public record PlaceCandidateDto(
            string ExternalPlaceId,
            string Name,
            string Genre,
            float? Latitude,
            float? Longitude,
            double? Distance);

        private class PlacesSearchResponse
        {
            [JsonPropertyName("places")]
            public List<GooglePlace>? Places { get; set; }
        }

        private class GooglePlace
        {
            [JsonPropertyName("id")]
            public string? Id { get; set; }

            [JsonPropertyName("displayName")]
            public GoogleDisplayName? DisplayName { get; set; }

            [JsonPropertyName("location")]
            public GoogleLocation? Location { get; set; }

            [JsonPropertyName("primaryType")]
            public string? PrimaryType { get; set; }
        }

        private class GoogleDisplayName
        {
            [JsonPropertyName("text")]
            public string? Text { get; set; }
        }

        private class GoogleLocation
        {
            [JsonPropertyName("latitude")]
            public float Latitude { get; set; }

            [JsonPropertyName("longitude")]
            public float Longitude { get; set; }
        }
    }
}
