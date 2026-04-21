using BellenodeApi.Data;
using BellenodeApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BellenodeApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class StatsController : BellenodeControllerBase
{
    private readonly BellenodeDbContext _db;
    public StatsController(BellenodeDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int jours = 30)
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();
        jours = Math.Clamp(jours, 1, 365);
        var since = DateTime.UtcNow.AddDays(-jours).Date;

        // --- Statut inventaire (même logique que Objectifs) ---
        var invItems = await _db.Inventory.Where(i => i.RestaurantId == restaurantId).ToListAsync();
        var invMap = invItems.ToDictionary(i => i.Code, i => i.Quantite);
        var products = await _db.Products.ToListAsync();
        var objMap = await _db.RestaurantObjectifs
            .Where(o => o.RestaurantId == restaurantId)
            .ToDictionaryAsync(o => o.CodeUpc, o => o);

        int statOk = 0, statBas = 0, statRupture = 0, statIgnore = 0;
        decimal valeur = 0m;
        foreach (var p in products)
        {
            var qty = invMap.TryGetValue(p.CodeUpc, out var q) ? q : 0;
            objMap.TryGetValue(p.CodeUpc, out var obj);
            var min = obj?.MinQty ?? 0;
            var max = obj?.MaxQty ?? 0;

            if (min == 0 && max == 0) statIgnore++;
            else if (qty == 0) statRupture++;
            else if (qty < min) statBas++;
            else statOk++;

            if (p.Prix.HasValue) valeur += p.Prix.Value * qty;
        }

        // --- Opérations de retrait sur la période ---
        var removeOps = await _db.ScanOperations
            .Where(o => o.ScanBatch!.RestaurantId == restaurantId
                     && o.ScanBatch.CreatedAt >= since
                     && o.Mode == ScanMode.Remove)
            .Select(o => new { o.Code, o.Quantite, o.ScanBatch!.CreatedAt })
            .ToListAsync();

        // --- Top 10 produits consommés ---
        var topGrouped = removeOps
            .GroupBy(o => o.Code)
            .Select(g => new { code = g.Key, total = g.Sum(x => x.Quantite) })
            .OrderByDescending(g => g.total)
            .Take(10)
            .ToList();

        var topCodes = topGrouped.Select(g => g.code).ToList();
        var nameByCode = products
            .Where(p => topCodes.Contains(p.CodeUpc))
            .ToDictionary(p => p.CodeUpc, p => p.Nom);
        var topConsommes = topGrouped.Select(g => new {
            code = g.code,
            nom = nameByCode.TryGetValue(g.code, out var n) ? n : g.code,
            total = g.total
        }).ToList();

        // --- Consommation par jour (toutes les dates, même les vides) ---
        var parJourMap = removeOps
            .GroupBy(o => o.CreatedAt.Date)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Quantite));

        var parJour = new List<object>();
        for (int i = 0; i < jours; i++)
        {
            var d = since.AddDays(i);
            parJour.Add(new {
                date = d.ToString("yyyy-MM-dd"),
                total = parJourMap.TryGetValue(d, out var t) ? t : 0
            });
        }

        return Ok(new {
            periode = jours,
            statut = new { ok = statOk, bas = statBas, rupture = statRupture, ignore = statIgnore },
            valeurInventaire = valeur,
            topConsommes,
            parJour,
            totalRetraits = removeOps.Sum(o => o.Quantite)
        });
    }
}
