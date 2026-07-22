using BellenodeApi.Data;
using BellenodeApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BellenodeApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProductsController : BellenodeControllerBase
{
    private readonly BellenodeDbContext _db;

    public ProductsController(BellenodeDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search = null)
    {
        if (string.IsNullOrWhiteSpace(search))
            return Ok(Array.Empty<Product>());

        var s = search.Trim().ToLower();
        var matches = await _db.Products
            .Where(p => p.Nom.ToLower().Contains(s) ||
                        p.CodeUpc.Contains(s) ||
                        (p.CodeSaq != null && p.CodeSaq.Contains(s)))
            .OrderBy(p => p.Nom)
            .Take(300)
            .ToListAsync();

        // Priorise les produits déjà tenus en inventaire pour ce restaurant (déjà scannés
        // au moins une fois) avant le reste du catalogue SAQ, pour le retrait manuel par nom.
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        var invCodes = restaurantId is null
            ? new HashSet<string>()
            : (await _db.Inventory
                .Where(i => i.RestaurantId == restaurantId)
                .Select(i => i.Code)
                .ToListAsync())
                .ToHashSet();

        var ordered = matches
            .OrderByDescending(p => invCodes.Contains(p.CodeUpc))
            .ThenBy(p => p.Nom)
            .Take(50)
            .ToList();

        return Ok(ordered);
    }

    // Liste allégée (codeUpc, nom, volume, imageUrl) du catalogue complet, sans le
    // filtre de recherche de GetAll — utilisée pour le cache local du scanner
    // Raspberry Pi, qui doit pouvoir résoudre n'importe quel produit du catalogue
    // SAQ dès le premier scan (y compris sa photo, mise en cache localement sur le Pi).
    [HttpGet("cache-pi")]
    public async Task<IActionResult> GetCachePi()
    {
        var products = await _db.Products
            .Select(p => new { p.CodeUpc, p.Nom, p.Volume, p.ImageUrl })
            .ToListAsync();
        return Ok(products);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(int id)
    {
        var product = await _db.Products.FindAsync(id);
        return product is null ? NotFound() : Ok(product);
    }

    [HttpGet("by-upc/{code}")]
    public async Task<IActionResult> GetByUpc(string code)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.CodeUpc == code);
        if (product is not null) return Ok(product);

        // Chercher dans les codes alternatifs
        var candidates = await _db.Products
            .Where(p => p.AltCodes != null && p.AltCodes.Contains(code))
            .ToListAsync();
        var match = candidates.FirstOrDefault(p =>
            p.AltCodes!.Split(';', StringSplitOptions.RemoveEmptyEntries).Contains(code));
        return match is null ? NotFound() : Ok(match);
    }

    [HttpPost]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<IActionResult> Create([FromBody] Product input)
    {
        input.Id = 0;
        input.CreatedAt = DateTime.UtcNow;
        input.UpdatedAt = DateTime.UtcNow;
        _db.Products.Add(input);
        await _db.SaveChangesAsync();

        // Marquer les items d'inventaire avec ce code comme référencés
        var allCodes = new HashSet<string> { input.CodeUpc };
        if (!string.IsNullOrEmpty(input.AltCodes))
            foreach (var c in input.AltCodes.Split(';', StringSplitOptions.RemoveEmptyEntries))
                allCodes.Add(c);
        var invItems = await _db.Inventory.Where(i => allCodes.Contains(i.Code)).ToListAsync();
        foreach (var inv in invItems) { inv.IsReferenced = true; inv.UpdatedAt = DateTime.UtcNow; }
        if (invItems.Count > 0) await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(Get), new { id = input.Id }, input);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<IActionResult> Update(int id, [FromBody] Product input)
    {
        var existing = await _db.Products.FindAsync(id);
        if (existing is null) return NotFound();

        existing.CodeUpc = input.CodeUpc;
        existing.Nom = input.Nom;
        existing.CodeSaq = input.CodeSaq;
        existing.Prix = input.Prix;
        existing.UnitesParCaisse = input.UnitesParCaisse;
        existing.LotQty = input.LotQty;
        existing.AltCodes = string.IsNullOrWhiteSpace(input.AltCodes) ? null : input.AltCodes;
        existing.Volume = string.IsNullOrWhiteSpace(input.Volume) ? null : input.Volume;
        existing.ImageUrl = string.IsNullOrWhiteSpace(input.ImageUrl) ? null : input.ImageUrl;
        existing.Url = string.IsNullOrWhiteSpace(input.Url) ? null : input.Url;
        existing.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(existing);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<IActionResult> Delete(int id)
    {
        var existing = await _db.Products.FindAsync(id);
        if (existing is null) return NotFound();

        _db.Products.Remove(existing);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
