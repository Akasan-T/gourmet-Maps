using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using GourmetMaps.Models;

namespace GourmetMaps.Data
{
    public class GourmetDbContext : IdentityDbContext<ApplicationUser>
    {
        public GourmetDbContext(DbContextOptions<GourmetDbContext> options)
            : base(options)
        {
        }
        public DbSet<GourmetEntry> GourmetEntries { get; set; }
        public DbSet<Store> Stores { get; set; }
        public DbSet<Badge> Badges { get; set; }
        public DbSet<ApplicationUserBadge> ApplicationUserBadges { get; set; }
        public DbSet<GourmetEntryParticipant> GourmetEntryParticipants { get; set; }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            builder.Entity<ApplicationUserBadge>()
                .HasKey(link => new { link.ApplicationUserId, link.BadgeID });

            builder.Entity<GourmetEntryParticipant>()
                .HasKey(link => new { link.GourmetEntryID, link.ApplicationUserId });
        }
    }
}
