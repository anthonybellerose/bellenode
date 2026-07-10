using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BellenodeApi.Migrations;

public partial class AddCommandeEmailConfig : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "EmailDestinataire",
            table: "CommandeConfigs",
            type: "nvarchar(200)",
            maxLength: 200,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "EmailSujet",
            table: "CommandeConfigs",
            type: "nvarchar(300)",
            maxLength: 300,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "EmailMessage",
            table: "CommandeConfigs",
            type: "nvarchar(max)",
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "EmailDestinataire", table: "CommandeConfigs");
        migrationBuilder.DropColumn(name: "EmailSujet", table: "CommandeConfigs");
        migrationBuilder.DropColumn(name: "EmailMessage", table: "CommandeConfigs");
    }
}
