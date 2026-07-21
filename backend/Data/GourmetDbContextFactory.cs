using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace GourmetMaps.Data
{
    // dotnet ef (migrations add / database update など) の設計時に使われるファクトリ。
    // これがあると EF ツールは Program.cs (起動時のシード・DDL 処理) を実行せずに
    // DbContext を組み立てられる。設計時の接続文字列はマイグレーション生成にのみ使う。
    public class GourmetDbContextFactory : IDesignTimeDbContextFactory<GourmetDbContext>
    {
        public GourmetDbContext CreateDbContext(string[] args)
        {
            var options = new DbContextOptionsBuilder<GourmetDbContext>()
                .UseSqlite("Data Source=noodlemaps.db")
                .Options;

            return new GourmetDbContext(options);
        }
    }
}
