using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NoodleMaps.Migrations
{
    /// <inheritdoc />
    public partial class AddUserToNoodleEntry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "UserId",
                table: "NoodleEntry",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_NoodleEntry_UserId",
                table: "NoodleEntry",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_NoodleEntry_AspNetUsers_UserId",
                table: "NoodleEntry",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_NoodleEntry_AspNetUsers_UserId",
                table: "NoodleEntry");

            migrationBuilder.DropIndex(
                name: "IX_NoodleEntry_UserId",
                table: "NoodleEntry");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "NoodleEntry");
        }
    }
}
