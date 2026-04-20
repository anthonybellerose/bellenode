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
            .Where(o => o.RestaurantId == restaurantId && o.ObjectifQty > 0)
            .ToListAsync();

        var invMap = await inv.ToDictionaryAsync(i => i.Code, i => i.Quantite);
        var bas = 0;
        var rupture = 0;
        foreach (var obj in objectifs)
        {
            var qty = invMap.TryGetValue(obj.CodeUpc, out var q) ? q : 0;
            if (qty == 0) rupture++;
            else if (qty < obj.ObjectifQty) bas++;
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
    public async Task<IActionResult> Objectifs([FromQuery] string? status = null)
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();

        var products = await _db.Products.OrderBy(p => p.Nom).ToListAsync();
        var inv = await _db.Inventory
            .Where(i => i.RestaurantId == restaurantId)
            .ToDictionaryAsync(i => i.Code, i => i.Quantite);
        var objMap = await _db.RestaurantObjectifs
            .Where(o => o.RestaurantId == restaurantId)
            .ToDictionaryAsync(o => o.CodeUpc, o => o.ObjectifQty);

        var rows = products.Select(p =>
        {
            var qty = inv.TryGetValue(p.CodeUpc, out var q) ? q : 0;
            objMap.TryGetValue(p.CodeUpc, out var objectif);
            var manque = Math.Max(0, objectif - qty);
            string statut;
            if (objectif == 0) statut = "ignore";
            else if (qty == 0) statut = "rupture";
            else if (qty < objectif) statut = "bas";
            else statut = "ok";

            return new
            {
                productId = p.Id,
                code = p.CodeUpc,
                nom = p.Nom,
                codeSaq = p.CodeSaq,
                prix = p.Prix,
                qtyActuelle = qty,
                objectifQty = objectif > 0 ? (int?)objectif : null,
                manque,
                statut
            };
        }).ToList();

        if (!string.IsNullOrWhiteSpace(status))
            rows = rows.Where(r => r.statut == status).ToList();

        return Ok(rows);
    }

    public record ObjectifInput(int? ObjectifQty);

    [HttpPatch("objectifs/{codeUpc}")]
    public async Task<IActionResult> SetObjectif(string codeUpc, [FromBody] ObjectifInput body)
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();

        var existing = await _db.RestaurantObjectifs
            .FirstOrDefaultAsync(o => o.RestaurantId == restaurantId && o.CodeUpc == codeUpc);

        var qty = body.ObjectifQty ?? 0;

        if (existing is null)
        {
            _db.RestaurantObjectifs.Add(new RestaurantObjectif
            {
                RestaurantId = restaurantId.Value,
                CodeUpc = codeUpc,
                ObjectifQty = qty
            });
        }
        else
        {
            existing.ObjectifQty = qty;
        }

        await _db.SaveChangesAsync();
        return Ok(new { codeUpc, objectifQty = qty });
    }
}
