using System.Text.RegularExpressions;
using BellenodeApi.Data;
using BellenodeApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BellenodeApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public partial class CommandesController : BellenodeControllerBase
{
    private readonly BellenodeDbContext _db;
    public CommandesController(BellenodeDbContext db) => _db = db;

    [GeneratedRegex(@"\b(\d+(?:[.,]\d+)?\s*(?:ml|mL|L|cl|l))\b")]
    private static partial Regex VolumeRegex();

    private static string? ExtractVolume(string nom)
    {
        var m = VolumeRegex().Match(nom);
        return m.Success ? m.Value.Trim() : null;
    }

    // GET /api/commandes/config
    [HttpGet("config")]
    public async Task<IActionResult> GetConfig()
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();

        var config = await _db.CommandeConfigs.FirstOrDefaultAsync(c => c.RestaurantId == restaurantId);
        if (config is null)
        {
            var resto = await _db.Restaurants.FindAsync(restaurantId.Value);
            return Ok(new { numeroClient = (string?)null, telephone = (string?)null,
                nomEtablissement = resto?.Nom, courriel = (string?)null, responsable = (string?)null });
        }

        return Ok(new {
            config.NumeroClient, config.Telephone, config.NomEtablissement,
            config.Courriel, config.Responsable
        });
    }

    public record ConfigInput(string? NumeroClient, string? Telephone, string? NomEtablissement, string? Courriel, string? Responsable);

    // PUT /api/commandes/config
    [HttpPut("config")]
    public async Task<IActionResult> UpdateConfig([FromBody] ConfigInput body)
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();
        if (!await IsRestaurantAdmin(_db, restaurantId.Value)) return Forbid();

        var config = await _db.CommandeConfigs.FirstOrDefaultAsync(c => c.RestaurantId == restaurantId);
        if (config is null)
        {
            config = new CommandeConfig { RestaurantId = restaurantId.Value };
            _db.CommandeConfigs.Add(config);
        }

        config.NumeroClient = body.NumeroClient;
        config.Telephone = body.Telephone;
        config.NomEtablissement = body.NomEtablissement;
        config.Courriel = body.Courriel;
        config.Responsable = body.Responsable;

        await _db.SaveChangesAsync();
        return Ok(config);
    }

    // GET /api/commandes
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();

        var commandes = await _db.CommandesSAQ
            .Where(c => c.RestaurantId == restaurantId)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new {
                c.Id, c.CreatedAt, c.CreatedBy, c.Note,
                nbItems = c.Items.Count,
                totalBtls = c.Items.Sum(i => i.Quantite)
            })
            .ToListAsync();

        return Ok(commandes);
    }

    // GET /api/commandes/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> Get(int id)
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();

        var commande = await _db.CommandesSAQ
            .Include(c => c.Items)
            .FirstOrDefaultAsync(c => c.Id == id && c.RestaurantId == restaurantId);

        if (commande is null) return NotFound();

        var config = await _db.CommandeConfigs.FirstOrDefaultAsync(c => c.RestaurantId == restaurantId);
        var resto = await _db.Restaurants.FindAsync(restaurantId.Value);

        return Ok(new {
            commande.Id, commande.CreatedAt, commande.CreatedBy, commande.Note,
            config = new {
                numeroClient = config?.NumeroClient,
                telephone = config?.Telephone,
                nomEtablissement = config?.NomEtablissement ?? resto?.Nom,
                courriel = config?.Courriel,
                responsable = config?.Responsable ?? commande.CreatedBy
            },
            items = commande.Items.Select(i => new {
                i.Id, i.CodeSaq, i.NomProduit, i.Volume, i.Quantite
            }).OrderBy(i => i.NomProduit).ToList()
        });
    }

    public record ItemInput(string CodeSaq, string NomProduit, string? Volume, int Quantite);
    public record CreateCommandeInput(string? Note, List<ItemInput> Items);

    // POST /api/commandes
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCommandeInput body)
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();

        if (body.Items == null || body.Items.Count == 0)
            return BadRequest(new { error = "Aucun item dans la commande." });

        var commande = new CommandeSAQ
        {
            RestaurantId = restaurantId.Value,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = User.FindFirst("nom")?.Value ?? User.Identity?.Name,
            Note = body.Note,
            Items = body.Items
                .Where(i => i.Quantite > 0 && !string.IsNullOrWhiteSpace(i.CodeSaq))
                .Select(i => new CommandeSAQItem
                {
                    CodeSaq = i.CodeSaq,
                    NomProduit = i.NomProduit,
                    Volume = i.Volume ?? ExtractVolume(i.NomProduit),
                    Quantite = i.Quantite
                }).ToList()
        };

        if (commande.Items.Count == 0)
            return BadRequest(new { error = "Aucun item valide." });

        _db.CommandesSAQ.Add(commande);
        await _db.SaveChangesAsync();

        return Ok(new { commande.Id, nbItems = commande.Items.Count, totalBtls = commande.Items.Sum(i => i.Quantite) });
    }

    // DELETE /api/commandes/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();
        if (!await IsRestaurantAdmin(_db, restaurantId.Value)) return Forbid();

        var commande = await _db.CommandesSAQ.FirstOrDefaultAsync(c => c.Id == id && c.RestaurantId == restaurantId);
        if (commande is null) return NotFound();

        _db.CommandesSAQ.Remove(commande);
        await _db.SaveChangesAsync();
        return NoContent();
    }
    // GET /api/commandes/{id}/export-saq
    [HttpGet("{id}/export-saq")]
    public async Task<IActionResult> ExportSaq(int id)
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();

        var commande = await _db.CommandesSAQ
            .Include(c => c.Items)
            .FirstOrDefaultAsync(c => c.Id == id && c.RestaurantId == restaurantId);

        if (commande is null) return NotFound();

        var config = await _db.CommandeConfigs.FirstOrDefaultAsync(c => c.RestaurantId == restaurantId);
        var resto = await _db.Restaurants.FindAsync(restaurantId.Value);

        var nomEtablissement = config?.NomEtablissement ?? resto?.Nom ?? "";
        var numeroClient    = config?.NumeroClient ?? "";
        var telephone       = config?.Telephone ?? "";
        var courriel        = config?.Courriel ?? "";
        var responsable     = config?.Responsable ?? commande.CreatedBy ?? "";
        var totalBtls       = commande.Items.Sum(i => i.Quantite);
        var dateStr         = commande.CreatedAt.ToString("yyyy-MM-dd");

        using var wb = new ClosedXML.Excel.XLWorkbook();
        var ws = wb.AddWorksheet("Commande SAQ");

        // Largeurs colonnes (même que le fichier SAQ)
        ws.Column(1).Width = 16; // Code Article
        ws.Column(2).Width = 10; // Quantité
        ws.Column(3).Width = 40; // Nom du produit
        ws.Column(4).Width = 12; // Format

        // Logo SAQ — positionné sur A2 (rows 2-5, cols A-C)
        var asm = System.Reflection.Assembly.GetExecutingAssembly();
        using var logoStream = asm.GetManifestResourceStream("BellenodeApi.Resources.saq_logo.jpeg");
        if (logoStream != null)
        {
            ws.AddPicture(logoStream)
              .MoveTo(ws.Cell("A2"))
              .WithSize(240, 60);
        }

        // Rows 2-5 : "Formulaire de commande" (aligné à droite, logo sur la gauche)
        ws.Range("A2:D5").Merge();
        ws.Cell("A2").Value = "Formulaire de commande";
        ws.Cell("A2").Style
            .Alignment.SetHorizontal(ClosedXML.Excel.XLAlignmentHorizontalValues.Right)
            .Alignment.SetVertical(ClosedXML.Excel.XLAlignmentVerticalValues.Center)
            .Font.SetBold(true)
            .Font.SetFontSize(14);

        // Rows 6-10 : infos client
        static void InfoRow(ClosedXML.Excel.IXLWorksheet sheet, int row, string label, string value)
        {
            sheet.Cell(row, 1).Value = label;
            sheet.Cell(row, 1).Style.Font.SetBold(true);
            sheet.Range(row, 2, row, 4).Merge();
            sheet.Cell(row, 2).Value = value;
        }

        InfoRow(ws, 6,  "Numéro de client :",            numeroClient);
        InfoRow(ws, 7,  "Numéro de téléphone :",         telephone);
        InfoRow(ws, 8,  "Nom d'établissement :",          nomEtablissement);
        InfoRow(ws, 9,  "Courriel :",                     courriel);
        InfoRow(ws, 10, "Responsable de la commande :",   responsable);

        // Row 11 : séparateur
        ws.Row(11).Height = 6;

        // Row 12 : total
        ws.Cell(12, 1).Value = "Total de la commande";
        ws.Cell(12, 1).Style.Font.SetBold(true);
        ws.Cell(12, 2).Value = totalBtls;
        ws.Cell(12, 2).Style.Font.SetBold(true);
        ws.Range(12, 3, 12, 4).Merge();
        ws.Cell(12, 3).Value = "BTLS";
        ws.Cell(12, 3).Style.Font.SetBold(true);

        // Row 13 : en-têtes de colonnes
        var saqBlue  = ClosedXML.Excel.XLColor.FromHtml("#003DA5");
        var headers  = new[] { "Code\nArticle", "Quantité\nCmdée en bouteille", "Nom du produit", "Format" };
        for (int c = 1; c <= 4; c++)
        {
            ws.Cell(13, c).Value = headers[c - 1];
            ws.Cell(13, c).Style
                .Font.SetBold(true)
                .Font.SetFontColor(ClosedXML.Excel.XLColor.White)
                .Fill.SetBackgroundColor(saqBlue)
                .Alignment.SetWrapText(true)
                .Alignment.SetHorizontal(ClosedXML.Excel.XLAlignmentHorizontalValues.Center)
                .Alignment.SetVertical(ClosedXML.Excel.XLAlignmentVerticalValues.Center);
        }
        ws.Row(13).Height = 36;

        // Données (même ordre que le fichier SAQ : Code, Qté, Nom, Format)
        var items = commande.Items.OrderBy(i => i.NomProduit).ToList();
        var lightGray = ClosedXML.Excel.XLColor.FromHtml("#F2F2F2");
        for (int i = 0; i < items.Count; i++)
        {
            var r    = 14 + i;
            var item = items[i];
            ws.Cell(r, 1).Value = item.CodeSaq;
            ws.Cell(r, 2).Value = item.Quantite;
            ws.Cell(r, 3).Value = item.NomProduit;
            ws.Cell(r, 4).Value = item.Volume ?? "";
            ws.Cell(r, 2).Style.Alignment.SetHorizontal(ClosedXML.Excel.XLAlignmentHorizontalValues.Center);
            if (i % 2 == 0)
                ws.Range(r, 1, r, 4).Style.Fill.SetBackgroundColor(lightGray);
        }

        // Bordures sur les données + en-têtes
        if (items.Count > 0)
        {
            ws.Range(13, 1, 13 + items.Count, 4).Style
                .Border.SetOutsideBorder(ClosedXML.Excel.XLBorderStyleValues.Thin)
                .Border.SetInsideBorder(ClosedXML.Excel.XLBorderStyleValues.Thin);
        }

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        var filename = $"commande-saq-{id}-{dateStr}.xlsx";
        return File(ms.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename);
    }
}
