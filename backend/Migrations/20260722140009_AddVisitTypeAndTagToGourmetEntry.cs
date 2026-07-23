using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NoodleMaps.Migrations
{
    /// <inheritdoc />
    public partial class AddVisitTypeAndTagToGourmetEntry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Tag",
                table: "GourmetEntries",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VisitType",
                table: "GourmetEntries",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Tag",
                table: "GourmetEntries");

            migrationBuilder.DropColumn(
                name: "VisitType",
                table: "GourmetEntries");
        }
    }
}
