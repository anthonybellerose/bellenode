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

    public record InventoryRow(
        int Id,
        string Code,
        int Quantite,
        bool IsReferenced,
        string? Nom,
        string? CodeSaq,
        decimal? Prix,
        DateTime UpdatedAt);

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search = null, [FromQuery] bool? referenced = null)
    {
        var query = from inv in _db.Inventory
                    join prod in _db.Products on inv.Code equals prod.CodeUpc into gj
                    from prod in gj.DefaultIfEmpty()
                    select new InventoryRow(
                        inv.Id,
                        inv.Code,
                        inv.Quantite,
                        inv.IsReferenced,
                        prod != null ? prod.Nom : null,
                        prod != null ? prod.CodeSaq : null,
                        prod != null ? prod.Prix : null,
                        inv.UpdatedAt);

        if (referenced.HasValue)
        {
            query = query.Where(r => r.IsReferenced == referenced.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(r => r.Code.Contains(s) ||
                                     (r.Nom != null && r.Nom.ToLower().Contains(s)) ||
                                     (r.CodeSaq != null && r.CodeSaq.Contains(s)));
        }

        var result = await query.OrderByDescending(r => r.IsReferenced).ThenBy(r => r.Nom ?? r.Code).ToListAsync();
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
