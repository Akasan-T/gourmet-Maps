// Data/NoodleDbContext.cs

using Microsoft.EntityFrameworkCore;
// ↓↓↓ 1. IdentityのDBコンテキストを参照 (これがCS0234, CS0246の原因) ↓↓↓
using Microsoft.AspNetCore.Identity.EntityFrameworkCore; 
// ↓↓↓ 2. IdentityUserを参照 (これが CS0246 の原因) ↓↓↓
using Microsoft.AspNetCore.Identity; 
using NoodleMaps.Models;

namespace NoodleMaps.Data
{
    // 3. IdentityDbContext<IdentityUser> を継承し、CS0311エラーを解消
    public class NoodleDbContext : IdentityDbContext<IdentityUser>
    {
        public NoodleDbContext(DbContextOptions<NoodleDbContext> options)
            : base(options)
        {
        }
        
        public DbSet<NoodleEntry> NoodleEntry { get; set; } = default!;
    }
}