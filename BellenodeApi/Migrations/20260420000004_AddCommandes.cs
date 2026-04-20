using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BellenodeApi.Migrations
{
    public partial class AddCommandes : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CommandeConfigs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false).Annotation("SqlServer:Identity", "1, 1"),
                    RestaurantId = table.Column<int>(type: "int", nullable: false),
                    NumeroClient = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Telephone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    NomEtablissement = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Courriel = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Responsable = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                },
                constraints: table => table.PrimaryKey("PK_CommandeConfigs", x => x.Id));

            migrationBuilder.CreateIndex(
                name: "IX_CommandeConfigs_RestaurantId",
                table: "CommandeConfigs",
                column: "RestaurantId",
                unique: true);

            migrationBuilder.CreateTable(
                name: "CommandesSAQ",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false).Annotation("SqlServer:Identity", "1, 1"),
                    RestaurantId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<System.DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                },
                constraints: table => table.PrimaryKey("PK_CommandesSAQ", x => x.Id));

            migrationBuilder.CreateTable(
                name: "CommandeSAQItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false).Annotation("SqlServer:Identity", "1, 1"),
                    CommandeId = table.Column<int>(type: "int", nullable: false),
                    CodeSaq = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    NomProduit = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Volume = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Quantite = table.Column<int>(type: "int", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CommandeSAQItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CommandeSAQItems_CommandesSAQ_CommandeId",
                        column: x => x.CommandeId,
                        principalTable: "CommandesSAQ",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CommandeSAQItems_CommandeId",
                table: "CommandeSAQItems",
                column: "CommandeId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "CommandeSAQItems");
            migrationBuilder.DropTable(name: "CommandesSAQ");
            migrationBuilder.DropTable(name: "CommandeConfigs");
        }
    }
}
