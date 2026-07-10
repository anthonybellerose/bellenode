using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BellenodeApi.Migrations
{
    /// <inheritdoc />
    public partial class AddCommandeEmailSent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CommandesSAQ') AND name = 'EmailEnvoyeA')
                    ALTER TABLE CommandesSAQ ADD EmailEnvoyeA NVARCHAR(200) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CommandesSAQ') AND name = 'EmailEnvoyeLe')
                    ALTER TABLE CommandesSAQ ADD EmailEnvoyeLe DATETIME2 NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "EmailEnvoyeA", table: "CommandesSAQ");
            migrationBuilder.DropColumn(name: "EmailEnvoyeLe", table: "CommandesSAQ");
        }
    }
}
