using BellenodeApi.Data;
using BellenodeApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BellenodeApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ScanController : BellenodeControllerBase
{
    private readonly BellenodeDbContext _db;

    public ScanController(BellenodeDbContext db) => _db = db;

    public record RawOp(string Mode, string Code, int? Quantite);
    public record SubmitBatchRequest(string? Note, string? CreatedBy, List<RawOp> Operations);

    [HttpPost("batch")]
    public async Task<IActionResult> SubmitBatch([FromBody] SubmitBatchRequest req)
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();

        if (req.Operations == null || req.Operations.Count == 0)
            return BadRequest(new { error = "Aucune opération." });

        var referencedCodes = new HashSet<string>(
            await _db.Products.Select(p => p.CodeUpc).ToListAsync());

        var mappings = await _db.CaisseMappings
            .ToDictionaryAsync(m => m.CodeCaisse, m => (m.CodeUnite, m.Quantite));

        var converted = new List<(ScanMode mode, string code, int qty)>();
        foreach (var raw in req.Operations)
        {
            var mode = ParseMode(raw.Mode);
            if (mode is null) continue;

            var qty = raw.Quantite is > 0 ? raw.Quantite.Value : 1;
            var code = raw.Code.Trim();

            if (mappings.TryGetValue(code, out var map))
                converted.Add((mode.Value, map.CodeUnite, qty * map.Quantite));
            else
                converted.Add((mode.Value, code, qty));
        }

        if (converted.Count == 0)
            return BadRequest(new { error = "Aucune opération valide." });

        var batch = new ScanBatch
        {
            RestaurantId = restaurantId.Value,
            Note = req.Note,
            CreatedBy = req.CreatedBy,
            CreatedAt = DateTime.UtcNow,
            LignesOps = converted.Count
        };
        _db.ScanBatches.Add(batch);
        await _db.SaveChangesAsync();

        var touchedCodes = new HashSet<string>();
        var setInitialized = new HashSet<string>();
        var totalAdds = 0;
        var totalSubs = 0;

        var affectedCodes = converted.Select(c => c.code).Distinct().ToList();
        var existingInventory = await _db.Inventory
            .Where(i => i.RestaurantId == restaurantId && affectedCodes.Contains(i.Code))
            .ToDictionaryAsync(i => i.Code);

        foreach (var (mode, code, qty) in converted)
        {
            var isRef = referencedCodes.Contains(code);

            if (!existingInventory.TryGetValue(code, out var inv))
            {
                inv = new InventoryItem { Code = code, RestaurantId = restaurantId.Value, Quantite = 0, IsReferenced = isRef };
                _db.Inventory.Add(inv);
                existingInventory[code] = inv;
            }
            else
            {
                inv.IsReferenced = isRef;
            }

            var qtyAvant = inv.Quantite;

            switch (mode)
            {
                case ScanMode.Add:
                    inv.Quantite += qty;
                    totalAdds += qty;
                    break;
                case ScanMode.Remove:
                    inv.Quantite = Math.Max(0, inv.Quantite - qty);
                    totalSubs += qty;
                    break;
                case ScanMode.Set:
                    if (!setInitialized.Contains(code))
                    {
                        inv.Quantite = qty;
                        setInitialized.Add(code);
                    }
                    else
                    {
                        inv.Quantite += qty;
                    }
                    break;
            }

            inv.UpdatedAt = DateTime.UtcNow;

            _db.ScanOperations.Add(new ScanOperation
            {
                ScanBatchId = batch.Id,
                Mode = mode,
                Code = code,
                Quantite = qty,
                IsReferenced = isRef,
                QtyAvant = qtyAvant,
                QtyApres = inv.Quantite
            });

            touchedCodes.Add(code);
        }

        batch.ProduitsTouches = touchedCodes.Count;
        batch.TotalAjouts = totalAdds;
        batch.TotalRetraits = totalSubs;

        await _db.SaveChangesAsync();

        return Ok(new
        {
            batchId = batch.Id,
            lignesOps = batch.LignesOps,
            produitsTouches = batch.ProduitsTouches,
            totalAjouts = totalAdds,
            totalRetraits = totalSubs
        });
    }

    public record ParseTextRequest(string Content);

    [HttpPost("parse-text")]
    public IActionResult ParseText([FromBody] ParseTextRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Content))
            return Ok(new List<RawOp>());

        var ops = new List<RawOp>();
        var currentMode = "+";

        foreach (var rawLine in req.Content.Split('\n'))
        {
            var line = rawLine.Trim('\r', ' ', '\t');
            if (string.IsNullOrWhiteSpace(line)) continue;
            if (line.StartsWith("#")) continue;

            var upper = line.ToUpperInvariant();
            if (upper is "+" or "A" or "ADD") { currentMode = "+"; continue; }
            if (upper is "-" or "R" or "REM" or "REMOVE") { currentMode = "-"; continue; }
            if (upper is "=" or "S" or "SET") { currentMode = "="; continue; }

            ops.Add(new RawOp(currentMode, line, 1));
        }

        return Ok(ops);
    }

    private static ScanMode? ParseMode(string raw) =>
        raw?.Trim().ToUpperInvariant() switch
        {
            "+" or "A" or "ADD" => ScanMode.Add,
            "-" or "R" or "REM" or "REMOVE" => ScanMode.Remove,
            "=" or "S" or "SET" => ScanMode.Set,
            _ => null
        };
}
