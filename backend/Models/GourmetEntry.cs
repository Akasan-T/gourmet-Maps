using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GourmetMaps.Models
{
    public class GourmetEntry
    {
        [Key]
        public int GourmetEntryID { get; set; }
        [Required]
        public string Name { get; set; } // 店名 (Store.Name のスナップショット)
        public string Genre { get; set; }
        public DateTime VisitDate { get; set; } = DateTime.Now;

        // 総合スコア = また行きたいか(RepeatRating) を基準に採用
        public float OverallRating { get; set; }
        public float TasteRating { get; set; }           // 味
        public float CostPerformanceRating { get; set; } // コスパ
        public float AppearanceRating { get; set; }      // 雰囲気・内装
        public float ServiceRating { get; set; }         // 接客
        public float RepeatRating { get; set; }          // また行きたいか (総合スコア基準)

        // 旧項目 (後方互換のため残置)
        public float VolumeRating { get; set; }
        public float ReorderRating { get; set; }

        public string Memo { get; set; }

        public string? SceneTag { get; set; }   // シーンタグ (デート向き/家族向き 等)
        public string? PriceRange { get; set; } // 価格帯 (ランチ/ディナー 等)
        public string? PhotoUrl { get; set; }   // 写真 (任意)

        public float? Latitude { get; set; }
        public float? Longitude { get; set; }

        // 店舗マスタへの参照 (レガシー行では null 許容)
        public int? StoreID { get; set; }
        [ForeignKey("StoreID")]
        public Store Store { get; set; }

        public string UserID { get; set; }
        [ForeignKey("UserID")]
        public ApplicationUser User { get; set; }

        // 一緒に行ったメンバー (多対多)
        public ICollection<GourmetEntryParticipant> Participants { get; set; }
    }

    // 中間テーブル: GourmetEntry <-> ApplicationUser (一緒に行ったメンバー)
    public class GourmetEntryParticipant
    {
        public int GourmetEntryID { get; set; }
        public GourmetEntry GourmetEntry { get; set; }
        public string ApplicationUserId { get; set; }
        public ApplicationUser ApplicationUser { get; set; }
    }
}
