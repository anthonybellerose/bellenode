using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BellenodeApi.Migrations
{
    /// <inheritdoc />
    public partial class AddProductVolumeImageUrl : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'AltCodes')
                    ALTER TABLE Products ADD AltCodes NVARCHAR(500) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'ImageUrl')
                    ALTER TABLE Products ADD ImageUrl NVARCHAR(500) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'Url')
                    ALTER TABLE Products ADD Url NVARCHAR(500) NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Products') AND name = 'Volume')
                    ALTER TABLE Products ADD Volume NVARCHAR(32) NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AltCodes",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "ImageUrl",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Url",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Volume",
                table: "Products");
        }
    }
}
