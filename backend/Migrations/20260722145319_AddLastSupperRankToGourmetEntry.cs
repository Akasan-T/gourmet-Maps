using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NoodleMaps.Migrations
{
    /// <inheritdoc />
    public partial class AddLastSupperRankToGourmetEntry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LastSupperRank",
                table: "GourmetEntries",
                type: "INTEGER",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastSupperRank",
                table: "GourmetEntries");
        }
    }
}
