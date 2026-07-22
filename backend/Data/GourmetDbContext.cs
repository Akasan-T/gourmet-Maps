using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
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
        public DbSet<InviteCode> InviteCodes { get; set; }

        // SQLite は DateTime の Kind を保存しないため、読み込み時は常に Unspecified になる。
        // JSON化すると "Z" が付かず、ブラウザ側で JST 等のローカル時刻として誤解釈されるため、
        // 全 DateTime プロパティに Utc Kind を明示する変換を挟む。
        private static readonly ValueConverter<DateTime, DateTime> UtcDateTimeConverter = new(
            toDb => toDb,
            fromDb => DateTime.SpecifyKind(fromDb, DateTimeKind.Utc));

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            builder.Entity<ApplicationUserBadge>()
                .HasKey(link => new { link.ApplicationUserId, link.BadgeID });

            builder.Entity<GourmetEntryParticipant>()
                .HasKey(link => new { link.GourmetEntryID, link.ApplicationUserId });

            foreach (var entityType in builder.Model.GetEntityTypes())
            {
                foreach (var property in entityType.GetProperties())
                {
                    if (property.ClrType == typeof(DateTime))
                    {
                        property.SetValueConverter(UtcDateTimeConverter);
                    }
                }
            }
        }
    }
}
