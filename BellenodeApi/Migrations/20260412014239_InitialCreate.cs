using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BellenodeApi.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CaisseMappings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CodeCaisse = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    CodeUnite = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Quantite = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CaisseMappings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Inventory",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Quantite = table.Column<int>(type: "int", nullable: false),
                    IsReferenced = table.Column<bool>(type: "bit", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Products",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CodeUpc = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Nom = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CodeSaq = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    Prix = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    UnitesParCaisse = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Products", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ScanBatches",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Note = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LignesOps = table.Column<int>(type: "int", nullable: false),
                    ProduitsTouches = table.Column<int>(type: "int", nullable: false),
                    TotalAjouts = table.Column<int>(type: "int", nullable: false),
                    TotalRetraits = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScanBatches", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ScanOperations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ScanBatchId = table.Column<int>(type: "int", nullable: false),
                    Mode = table.Column<int>(type: "int", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Quantite = table.Column<int>(type: "int", nullable: false),
                    IsReferenced = table.Column<bool>(type: "bit", nullable: false),
                    QtyAvant = table.Column<int>(type: "int", nullable: false),
                    QtyApres = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScanOperations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScanOperations_ScanBatches_ScanBatchId",
                        column: x => x.ScanBatchId,
                        principalTable: "ScanBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CaisseMappings_CodeCaisse",
                table: "CaisseMappings",
                column: "CodeCaisse",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_Code",
                table: "Inventory",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Products_CodeUpc",
                table: "Products",
                column: "CodeUpc",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScanOperations_ScanBatchId",
                table: "ScanOperations",
                column: "ScanBatchId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CaisseMappings");

            migrationBuilder.DropTable(
                name: "Inventory");

            migrationBuilder.DropTable(
                name: "Products");

            migrationBuilder.DropTable(
                name: "ScanOperations");

            migrationBuilder.DropTable(
                name: "ScanBatches");
        }
    }
}
