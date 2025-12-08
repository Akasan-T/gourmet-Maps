using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NoodleMaps.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "NoodleEntry",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ShopName = table.Column<string>(type: "TEXT", nullable: false),
                    VisitDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Genre = table.Column<string>(type: "TEXT", nullable: false),
                    ScoreA_Soup = table.Column<int>(type: "INTEGER", nullable: false),
                    ScoreB_Noodle = table.Column<int>(type: "INTEGER", nullable: false),
                    ScoreC_Topping = table.Column<int>(type: "INTEGER", nullable: false),
                    ScoreD_Atmosphere = table.Column<int>(type: "INTEGER", nullable: false),
                    ScoreE_CostPerf = table.Column<int>(type: "INTEGER", nullable: false),
                    OverallScore = table.Column<double>(type: "REAL", nullable: false),
                    Latitude = table.Column<double>(type: "REAL", nullable: true),
                    Notes = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NoodleEntry", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "NoodleEntry");
        }
    }
}
