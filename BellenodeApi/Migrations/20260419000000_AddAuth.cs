using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BellenodeApi.Migrations
{
    public partial class AddAuth : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Restaurants
            migrationBuilder.CreateTable(
                name: "Restaurants",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nom = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table => table.PrimaryKey("PK_Restaurants", x => x.Id));

            // 2. Users
            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Email = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Nom = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Role = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table => table.PrimaryKey("PK_Users", x => x.Id));

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            // 3. UserRestaurantAccesses
            migrationBuilder.CreateTable(
                name: "UserRestaurantAccesses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    RestaurantId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserRestaurantAccesses", x => x.Id);
                    table.ForeignKey("FK_UserRestaurantAccesses_Users_UserId", x => x.UserId, "Users", "Id", onDelete: ReferentialAction.Cascade);
                    table.ForeignKey("FK_UserRestaurantAccesses_Restaurants_RestaurantId", x => x.RestaurantId, "Restaurants", "Id", onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserRestaurantAccesses_UserId_RestaurantId",
                table: "UserRestaurantAccesses",
                columns: new[] { "UserId", "RestaurantId" },
                unique: true);

            // 4. RestaurantObjectifs
            migrationBuilder.CreateTable(
                name: "RestaurantObjectifs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RestaurantId = table.Column<int>(type: "int", nullable: false),
                    CodeUpc = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ObjectifQty = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table => table.PrimaryKey("PK_RestaurantObjectifs", x => x.Id));

            migrationBuilder.CreateIndex(
                name: "IX_RestaurantObjectifs_RestaurantId_CodeUpc",
                table: "RestaurantObjectifs",
                columns: new[] { "RestaurantId", "CodeUpc" },
                unique: true);

            // 5. Migrate ObjectifQty from Products to RestaurantObjectifs for restaurant 1
            migrationBuilder.Sql(@"
                INSERT INTO RestaurantObjectifs (RestaurantId, CodeUpc, ObjectifQty)
                SELECT 1, CodeUpc, ObjectifQty
                FROM Products
                WHERE ObjectifQty IS NOT NULL AND ObjectifQty > 0
            ");

            // 6. Drop ObjectifQty from Products
            migrationBuilder.DropColumn(name: "ObjectifQty", table: "Products");

            // 7. Add RestaurantId to Inventory (nullable first)
            migrationBuilder.AddColumn<int>(
                name: "RestaurantId",
                table: "Inventory",
                type: "int",
                nullable: true);

            // 8. Set existing Inventory rows to restaurant 1
            migrationBuilder.Sql("UPDATE Inventory SET RestaurantId = 1");

            // 9. Make RestaurantId NOT NULL
            migrationBuilder.AlterColumn<int>(
                name: "RestaurantId",
                table: "Inventory",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            // 10. Drop old unique index on Code, add new on (Code, RestaurantId)
            migrationBuilder.DropIndex(name: "IX_Inventory_Code", table: "Inventory");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_Code_RestaurantId",
                table: "Inventory",
                columns: new[] { "Code", "RestaurantId" },
                unique: true);

            // 11. Add RestaurantId to ScanBatches (nullable first)
            migrationBuilder.AddColumn<int>(
                name: "RestaurantId",
                table: "ScanBatches",
                type: "int",
                nullable: true);

            // 12. Set existing ScanBatches rows to restaurant 1
            migrationBuilder.Sql("UPDATE ScanBatches SET RestaurantId = 1");

            // 13. Make RestaurantId NOT NULL
            migrationBuilder.AlterColumn<int>(
                name: "RestaurantId",
                table: "ScanBatches",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "RestaurantObjectifs");
            migrationBuilder.DropTable(name: "UserRestaurantAccesses");
            migrationBuilder.DropTable(name: "Users");
            migrationBuilder.DropTable(name: "Restaurants");

            migrationBuilder.DropColumn(name: "RestaurantId", table: "Inventory");
            migrationBuilder.DropColumn(name: "RestaurantId", table: "ScanBatches");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_Code",
                table: "Inventory",
                column: "Code",
                unique: true);

            migrationBuilder.AddColumn<int>(
                name: "ObjectifQty",
                table: "Products",
                type: "int",
                nullable: true);
        }
    }
}
