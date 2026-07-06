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
        public string Name { get; set; } // 店名
        public string Genre { get; set; }
        public DateTime VisitDate { get; set; } = DateTime.Now;
        public float OverallRating { get; set; }
        public float TasteRating { get; set; }
        public float AppearanceRating { get; set; }
        public float CostPerformanceRating { get; set; }
        public float VolumeRating { get; set; }
        public float RepeatRating { get; set; }
        public float ReorderRating { get; set; }
        public string Memo { get; set; }
        public float? Latitude { get; set; }
        public float? Longitude { get; set; }
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
