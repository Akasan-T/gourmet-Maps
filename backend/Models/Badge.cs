using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace GourmetMaps.Models
{
    public class Badge
    {
        [Key]
        public int BadgeID { get; set; }
        [Required]
        public string Title { get; set; }
        public string Description { get; set; }
        public string IconUrl { get; set; }

        // 多対多: Badge <-> ApplicationUser
        public ICollection<ApplicationUserBadge> ApplicationUserBadges { get; set; }
    }

    // 中間テーブル
    public class ApplicationUserBadge
    {
        public string ApplicationUserId { get; set; }
        public ApplicationUser ApplicationUser { get; set; }
        public int BadgeID { get; set; }
        public Badge Badge { get; set; }
    }
}
