using BellenodeApi.Data;
using BellenodeApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BellenodeApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InventoryController : BellenodeControllerBase
{
    private readonly BellenodeDbContext _db;

    public InventoryController(BellenodeDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search = null, [FromQuery] bool? referenced = null)
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();

        var invQuery = _db.Inventory.Where(i => i.RestaurantId == restaurantId);

        if (referenced.HasValue)
            invQuery = invQuery.Where(i => i.IsReferenced == referenced.Value);

        var items = await invQuery.ToListAsync();
        if (items.Count == 0) return Ok(Array.Empty<object>());

        var codes = items.Select(i => i.Code).Distinct().ToList();
        var products = await _db.Products
            .Where(p => codes.Contains(p.CodeUpc))
            .ToDictionaryAsync(p => p.CodeUpc);

        var rows = items.Select(i =>
        {
            products.TryGetValue(i.Code, out var p);
            return new
            {
                id = i.Id,
                code = i.Code,
                quantite = i.Quantite,
                isReferenced = i.IsReferenced,
                nom = p?.Nom,
                codeSaq = p?.CodeSaq,
                prix = p?.Prix,
                updatedAt = i.UpdatedAt
            };
        }).AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            rows = rows.Where(r => r.code.ToLower().Contains(s) ||
                                   (r.nom != null && r.nom.ToLower().Contains(s)) ||
                                   (r.codeSaq != null && r.codeSaq.Contains(s)));
        }

        return Ok(rows.OrderByDescending(r => r.isReferenced).ThenBy(r => r.nom ?? r.code).ToList());
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary()
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();

        var inv = _db.Inventory.Where(i => i.RestaurantId == restaurantId);

        var totalReferenced = await inv.Where(i => i.IsReferenced).SumAsync(i => (int?)i.Quantite) ?? 0;
        var totalNonReferenced = await inv.Where(i => !i.IsReferenced).SumAsync(i => (int?)i.Quantite) ?? 0;
        var distinctReferenced = await inv.CountAsync(i => i.IsReferenced);
        var distinctNonReferenced = await inv.CountAsync(i => !i.IsReferenced);
        var lastUpdate = await inv.MaxAsync(i => (DateTime?)i.UpdatedAt);

        var objectifs = await _db.RestaurantObjectifs
            .Where(o => o.RestaurantId == restaurantId && o.MinQty > 0 || o.MaxQty > 0)
            .ToListAsync();

        var invMap = await inv.ToDictionaryAsync(i => i.Code, i => i.Quantite);
        var bas = 0;
        var rupture = 0;
        foreach (var obj in objectifs)
        {
            var qty = invMap.TryGetValue(obj.CodeUpc, out var q) ? q : 0;
            if (qty == 0) rupture++;
            else if (qty < obj.MinQty) bas++;
        }

        return Ok(new
        {
            totalReferenced,
            totalNonReferenced,
            distinctReferenced,
            distinctNonReferenced,
            lastUpdate,
            totalProducts = await _db.Products.CountAsync(),
            totalBatches = await _db.ScanBatches.CountAsync(b => b.RestaurantId == restaurantId),
            stockBas = bas,
            stockRupture = rupture,
            stockCibles = objectifs.Count
        });
    }

    [HttpGet("non-referenced")]
    public async Task<IActionResult> NonReferenced()
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();

        var items = await _db.Inventory
            .Where(i => i.RestaurantId == restaurantId && !i.IsReferenced)
            .OrderBy(i => i.Code)
            .ToListAsync();
        return Ok(items);
    }

    [HttpGet("objectifs")]
    public async Task<IActionResult> Objectifs([FromQuery] string? status = null, [FromQuery] bool inventoryOnly = false)
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();

        var invItems = await _db.Inventory
            .Where(i => i.RestaurantId == restaurantId)
            .ToListAsync();
        var invMap = invItems.ToDictionary(i => i.Code, i => i.Quantite);

        var products = await _db.Products.OrderBy(p => p.Nom).ToListAsync();
        if (inventoryOnly)
        {
            var invCodes = invMap.Keys.ToHashSet();
            products = products.Where(p => invCodes.Contains(p.CodeUpc)).ToList();
        }

        var objMap = await _db.RestaurantObjectifs
            .Where(o => o.RestaurantId == restaurantId)
            .ToDictionaryAsync(o => o.CodeUpc, o => o);

        var rows = products.Select(p =>
        {
            var qty = invMap.TryGetValue(p.CodeUpc, out var q) ? q : 0;
            objMap.TryGetValue(p.CodeUpc, out var obj);
            var minQty = obj?.MinQty ?? 0;
            var maxQty = obj?.MaxQty ?? 0;
            var lotEffectif = obj?.LotQty ?? p.LotQty ?? 1;

            string statut;
            if (minQty == 0 && maxQty == 0) statut = "ignore";
            else if (qty == 0) statut = "rupture";
            else if (qty < minQty) statut = "bas";
            else statut = "ok";

            int aCommander = 0;
            if (maxQty > 0 && qty < minQty)
            {
                var besoin = maxQty - qty;
                // Arrondi au multiple de lot le plus proche (demi-lot arrondit up).
                var lots = (int)Math.Round((double)besoin / lotEffectif, MidpointRounding.AwayFromZero);
                // Garde-fou : jamais en-dessous du min. Il faut assez de lots pour atteindre minQty.
                var lotsMin = (int)Math.Ceiling((double)(minQty - qty) / lotEffectif);
                if (lots < lotsMin) lots = lotsMin;
                aCommander = lots * lotEffectif;
            }

            return new
            {
                productId = p.Id,
                code = p.CodeUpc,
                nom = p.Nom,
                codeSaq = p.CodeSaq,
                prix = p.Prix,
                qtyActuelle = qty,
                minQty = minQty > 0 ? (int?)minQty : null,
                maxQty = maxQty > 0 ? (int?)maxQty : null,
                lotQty = obj?.LotQty,
                lotDefault = p.LotQty,
                lotEffectif,
                aCommander = aCommander > 0 ? (int?)aCommander : null,
                statut
            };
        }).ToList();

        if (!string.IsNullOrWhiteSpace(status))
            rows = rows.Where(r => r.statut == status).ToList();

        return Ok(rows);
    }

    public record ObjectifInput(int? MinQty, int? MaxQty, int? LotQty);

    [HttpPatch("objectifs/{codeUpc}")]
    public async Task<IActionResult> SetObjectif(string codeUpc, [FromBody] ObjectifInput body)
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();
        if (!await IsRestaurantAdmin(_db, restaurantId.Value)) return Forbid();

        var existing = await _db.RestaurantObjectifs
            .FirstOrDefaultAsync(o => o.RestaurantId == restaurantId && o.CodeUpc == codeUpc);

        var minQty = body.MinQty ?? 0;
        var maxQty = body.MaxQty ?? 0;
        var lotQty = Math.Max(1, body.LotQty ?? 1);

        if (existing is null)
        {
            _db.RestaurantObjectifs.Add(new RestaurantObjectif
            {
                RestaurantId = restaurantId.Value,
                CodeUpc = codeUpc,
                MinQty = minQty,
                MaxQty = maxQty,
                LotQty = lotQty
            });
        }
        else
        {
            existing.MinQty = minQty;
            existing.MaxQty = maxQty;
            existing.LotQty = lotQty;
        }

        await _db.SaveChangesAsync();
        return Ok(new { codeUpc, minQty, maxQty, lotQty });
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] string? status = null, [FromQuery] bool inventoryOnly = false)
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();

        var resto = await _db.Restaurants.FindAsync(restaurantId.Value);

        var invItems = await _db.Inventory
            .Where(i => i.RestaurantId == restaurantId)
            .ToListAsync();
        var invMap = invItems.ToDictionary(i => i.Code, i => i);

        var products = await _db.Products.OrderBy(p => p.Nom).ToListAsync();
        if (inventoryOnly)
        {
            var invCodes = invMap.Keys.ToHashSet();
            products = products.Where(p => invCodes.Contains(p.CodeUpc)).ToList();
        }

        var objMap = await _db.RestaurantObjectifs
            .Where(o => o.RestaurantId == restaurantId)
            .ToDictionaryAsync(o => o.CodeUpc, o => o);

        var rows = products.Select(p =>
        {
            var inv = invMap.TryGetValue(p.CodeUpc, out var i) ? i : null;
            var qty = inv?.Quantite ?? 0;
            objMap.TryGetValue(p.CodeUpc, out var obj);
            var minQty = obj?.MinQty ?? 0;
            var maxQty = obj?.MaxQty ?? 0;
            var lotEffectif = obj?.LotQty ?? p.LotQty ?? 1;

            string statut;
            if (minQty == 0 && maxQty == 0) statut = "ignore";
            else if (qty == 0) statut = "rupture";
            else if (qty < minQty) statut = "bas";
            else statut = "ok";

            int aCommander = 0;
            if (maxQty > 0 && qty < minQty)
            {
                var besoin = maxQty - qty;
                var lots = (int)Math.Round((double)besoin / lotEffectif, MidpointRounding.AwayFromZero);
                var lotsMin = (int)Math.Ceiling((double)(minQty - qty) / lotEffectif);
                if (lots < lotsMin) lots = lotsMin;
                aCommander = lots * lotEffectif;
            }

            return new {
                p.CodeUpc, p.CodeSaq, p.Nom, p.Prix,
                QtyActuelle = qty, MinQty = minQty, MaxQty = maxQty, LotEff = lotEffectif,
                ACommander = aCommander, Statut = statut, UpdatedAt = inv?.UpdatedAt
            };
        }).ToList();

        if (!string.IsNullOrWhiteSpace(status))
            rows = rows.Where(r => r.Statut == status).ToList();

        using var wb = new ClosedXML.Excel.XLWorkbook();
        var ws = wb.AddWorksheet("Inventaire");

        // Titre
        ws.Cell("A1").Value = $"Inventaire — {resto?.Nom ?? ""}";
        ws.Range("A1:K1").Merge();
        ws.Cell("A1").Style.Font.SetBold(true).Font.SetFontSize(14);
        ws.Cell("A2").Value = $"Export du {DateTime.Now:yyyy-MM-dd HH:mm}";
        ws.Range("A2:K2").Merge();
        ws.Cell("A2").Style.Font.SetFontColor(ClosedXML.Excel.XLColor.Gray).Font.SetItalic(true);

        // En-têtes
        var headers = new[] { "Code UPC", "Code SAQ", "Nom", "Qté actuelle", "Prix", "Min", "Max", "Lot", "À commander", "Statut", "MAJ" };
        var accent  = ClosedXML.Excel.XLColor.FromHtml("#3b82f6");
        for (int c = 0; c < headers.Length; c++)
        {
            var cell = ws.Cell(4, c + 1);
            cell.Value = headers[c];
            cell.Style.Font.SetBold(true)
                .Font.SetFontColor(ClosedXML.Excel.XLColor.White)
                .Fill.SetBackgroundColor(accent)
                .Alignment.SetHorizontal(ClosedXML.Excel.XLAlignmentHorizontalValues.Center);
        }

        // Données
        var statutLabel = new Dictionary<string,string> {
            ["ok"] = "OK", ["bas"] = "Stock bas", ["rupture"] = "Rupture", ["ignore"] = "Sans objectif"
        };
        var statutColor = new Dictionary<string, ClosedXML.Excel.XLColor> {
            ["ok"] = ClosedXML.Excel.XLColor.FromHtml("#dcfce7"),
            ["bas"] = ClosedXML.Excel.XLColor.FromHtml("#fef3c7"),
            ["rupture"] = ClosedXML.Excel.XLColor.FromHtml("#fee2e2"),
            ["ignore"] = ClosedXML.Excel.XLColor.FromHtml("#f3f4f6"),
        };

        for (int i = 0; i < rows.Count; i++)
        {
            var r = 5 + i;
            var row = rows[i];
            ws.Cell(r, 1).Value = row.CodeUpc;
            ws.Cell(r, 1).Style.NumberFormat.SetFormat("@"); // texte
            ws.Cell(r, 2).Value = row.CodeSaq ?? "";
            ws.Cell(r, 3).Value = row.Nom;
            ws.Cell(r, 4).Value = row.QtyActuelle;
            if (row.Prix.HasValue)
            {
                ws.Cell(r, 5).Value = row.Prix.Value;
                ws.Cell(r, 5).Style.NumberFormat.SetFormat("$#,##0.00");
            }
            if (row.MinQty > 0) ws.Cell(r, 6).Value = row.MinQty;
            if (row.MaxQty > 0) ws.Cell(r, 7).Value = row.MaxQty;
            ws.Cell(r, 8).Value = row.LotEff;
            if (row.ACommander > 0) ws.Cell(r, 9).Value = row.ACommander;
            ws.Cell(r, 10).Value = statutLabel[row.Statut];
            if (statutColor.TryGetValue(row.Statut, out var col))
                ws.Cell(r, 10).Style.Fill.SetBackgroundColor(col);
            ws.Cell(r, 11).Value = row.UpdatedAt?.ToString("yyyy-MM-dd HH:mm") ?? "";
        }

        // Auto-filter + largeurs
        if (rows.Count > 0)
            ws.Range(4, 1, 4 + rows.Count, headers.Length).SetAutoFilter();
        ws.Columns().AdjustToContents();
        ws.Column(3).Width = Math.Min(60, ws.Column(3).Width); // Nom
        ws.SheetView.FreezeRows(4);

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        var filename = $"inventaire-{resto?.Nom ?? "bellenode"}-{DateTime.Now:yyyy-MM-dd}.xlsx"
            .Replace(" ", "_");
        return File(ms.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename);
    }
}
