using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BellenodeApi.Migrations
{
    /// <inheritdoc />
    public partial class AddPiHealthLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent (voir gotcha migrations dans CLAUDE.md) : le snapshot local peut être
            // désynchronisé d'une migration appliquée manuellement ailleurs.
            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PiHealthLogs')
BEGIN
    CREATE TABLE [PiHealthLogs] (
        [Id] int NOT NULL IDENTITY(1,1),
        [RestaurantId] int NOT NULL,
        [TempC] decimal(5,2) NOT NULL,
        [Throttled] bit NOT NULL,
        [AlertSent] bit NOT NULL,
        [RecordedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_PiHealthLogs] PRIMARY KEY ([Id])
    );
END
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'PiHealthLogs')
    DROP TABLE [PiHealthLogs];
");
        }
    }
}
