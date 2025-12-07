using Microsoft.EntityFrameworkCore;
using NoodleMaps.Models; //定義したモデルを参照

namespace NoodleMaps.Data
{
    // DbContextを継承したクラスを作成
    public class NoodleDbContext : DbContext
    {
        // コンストラクタで設定を受ける
        public NoodleDbContext(DbContextOptions<NoodleDbContext> options)
            : base(options)
        {
        }

        // DBテーブルに対応するプロパティ (DbSet)を定義
        public DbSet<NoodleEntry> NoodleEntry { get; set; } = default!;
    }
}