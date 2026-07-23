using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NoodleMaps.Migrations
{
    /// <inheritdoc />
    public partial class AddMenuNameToGourmetEntry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MenuName",
                table: "GourmetEntries",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MenuName",
                table: "GourmetEntries");
        }
    }
}
