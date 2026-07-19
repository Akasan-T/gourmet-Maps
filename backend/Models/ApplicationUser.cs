using Microsoft.AspNetCore.Identity;
using System.Collections.Generic;
using GourmetMaps.Models;

namespace GourmetMaps.Models
{
    public class ApplicationUser : IdentityUser
    {
        public string? DisplayName { get; set; }
        public string? AvatarUrl { get; set; }
        // バッジ多対多
        public ICollection<ApplicationUserBadge> ApplicationUserBadges { get; set; }
    }
}