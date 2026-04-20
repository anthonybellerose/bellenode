using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BellenodeApi.Migrations
{
    public partial class AddProductLotQty : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LotQty",
                table: "Products",
                type: "int",
                nullable: true);

            // LotQty on RestaurantObjectifs becomes nullable (default was 1)
            migrationBuilder.AlterColumn<int>(
                name: "LotQty",
                table: "RestaurantObjectifs",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: false,
                oldDefaultValue: 1);

            // Rows that have LotQty=1 (the old default) become null so they inherit from product
            migrationBuilder.Sql("UPDATE RestaurantObjectifs SET LotQty = NULL WHERE LotQty = 1");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "LotQty", table: "Products");
            migrationBuilder.AlterColumn<int>(
                name: "LotQty",
                table: "RestaurantObjectifs",
                type: "int",
                nullable: false,
                defaultValue: 1,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);
        }
    }
}
