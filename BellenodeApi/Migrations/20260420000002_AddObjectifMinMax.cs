using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BellenodeApi.Migrations
{
    public partial class AddObjectifMinMax : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Rename ObjectifQty → MinQty
            migrationBuilder.RenameColumn(
                name: "ObjectifQty",
                table: "RestaurantObjectifs",
                newName: "MinQty");

            // Add MaxQty (default 0)
            migrationBuilder.AddColumn<int>(
                name: "MaxQty",
                table: "RestaurantObjectifs",
                type: "int",
                nullable: false,
                defaultValue: 0);

            // Add LotQty (default 1)
            migrationBuilder.AddColumn<int>(
                name: "LotQty",
                table: "RestaurantObjectifs",
                type: "int",
                nullable: false,
                defaultValue: 1);

            // Set MaxQty = MinQty * 2 for existing rows that have a value
            migrationBuilder.Sql("UPDATE RestaurantObjectifs SET MaxQty = MinQty * 2 WHERE MinQty > 0");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "MaxQty", table: "RestaurantObjectifs");
            migrationBuilder.DropColumn(name: "LotQty", table: "RestaurantObjectifs");
            migrationBuilder.RenameColumn(
                name: "MinQty",
                table: "RestaurantObjectifs",
                newName: "ObjectifQty");
        }
    }
}
