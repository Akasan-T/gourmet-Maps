using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GourmetMaps.Models
{
    // 店舗マスタ: 評価(GourmetEntry)を毎回この店舗に紐付けて蓄積する
    public class Store
    {
        [Key]
        public int StoreID { get; set; }

        [Required]
        public string Name { get; set; } // 店名 (必須)

        public string Genre { get; set; } = "未設定"; // ジャンル/カテゴリ

        public string? Address { get; set; } // 住所 (API取得 or 手入力)

        public float? Latitude { get; set; }  // 距離計算・地図表示用
        public float? Longitude { get; set; }

        // Google Places / Overpass 等の外部ID。手入力店舗の場合は null
        public string? ExternalPlaceId { get; set; }

        // 最初に登録したユーザー
        public string? CreatedByUserId { get; set; }
        [ForeignKey("CreatedByUserId")]
        public ApplicationUser? CreatedByUser { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // この店舗に対する評価
        public ICollection<GourmetEntry>? Entries { get; set; }
    }
}
