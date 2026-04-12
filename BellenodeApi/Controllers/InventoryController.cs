using BellenodeApi.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BellenodeApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class InventoryController : ControllerBase
{
    private readonly BellenodeDbContext _db;

    public InventoryController(BellenodeDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search = null, [FromQuery] bool? referenced = null)
    {
        var invQuery = _db.Inventory.AsQueryable();

        if (referenced.HasValue)
        {
            invQuery = invQuery.Where(i => i.IsReferenced == referenced.Value);
        }

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

        var result = rows
            .OrderByDescending(r => r.isReferenced)
            .ThenBy(r => r.nom ?? r.code)
            .ToList();

        return Ok(result);
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary()
    {
        var totalReferenced = await _db.Inventory.Where(i => i.IsReferenced).SumAsync(i => (int?)i.Quantite) ?? 0;
        var totalNonReferenced = await _db.Inventory.Where(i => !i.IsReferenced).SumAsync(i => (int?)i.Quantite) ?? 0;
        var distinctReferenced = await _db.Inventory.CountAsync(i => i.IsReferenced);
        var distinctNonReferenced = await _db.Inventory.CountAsync(i => !i.IsReferenced);
        var lastUpdate = await _db.Inventory.MaxAsync(i => (DateTime?)i.UpdatedAt);

        return Ok(new
        {
            totalReferenced,
            totalNonReferenced,
            distinctReferenced,
            distinctNonReferenced,
            lastUpdate,
            totalProducts = await _db.Products.CountAsync(),
            totalBatches = await _db.ScanBatches.CountAsync()
        });
    }

    [HttpGet("non-referenced")]
    public async Task<IActionResult> NonReferenced()
    {
        var items = await _db.Inventory
            .Where(i => !i.IsReferenced)
            .OrderBy(i => i.Code)
            .ToListAsync();
        return Ok(items);
    }
}
