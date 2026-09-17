using BellenodeApi.Data;
using BellenodeApi.Models;
using BellenodeApi.Services;
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

        // Si la recherche ressemble à un code-barres, tolère un écart d'un zéro (ex: recherche
        // depuis le téléphone en scannant une bouteille dont l'UPC diffère d'un 0 par rapport
        // à celui affiché sur SAQ.com/enregistré) — même tolérance que ScanController.
        string? zeroAdded = s.Length > 0 && s.All(char.IsDigit) ? "0" + s : null;
        string? zeroStripped = s.Length > 1 && s[0] == '0' && s.All(char.IsDigit) ? s[1..] : null;

        var matches = await _db.Products
            .Where(p => p.Nom.ToLower().Contains(s) ||
                        p.CodeUpc.Contains(s) ||
                        (zeroAdded != null && p.CodeUpc.Contains(zeroAdded)) ||
                        (zeroStripped != null && p.CodeUpc.Contains(zeroStripped)) ||
                        (p.CodeSaq != null && p.CodeSaq.Contains(s)) ||
                        (p.AltCodes != null && p.AltCodes.Contains(s)) ||
                        (p.AltCodes != null && zeroAdded != null && p.AltCodes.Contains(zeroAdded)) ||
                        (p.AltCodes != null && zeroStripped != null && p.AltCodes.Contains(zeroStripped)))
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
    //
    // Émet aussi une entrée par code alternatif (AltCodes) pointant vers les mêmes infos,
    // pour que le Pi affiche le bon produit même en scannant un UPC alternatif (ex: un 0
    // en trop, fréquent sur le site SAQ) — sans ça le Pi affiche "non référencé" même
    // pour un produit dont le code alternatif est pourtant déjà connu côté serveur.
    [HttpGet("cache-pi")]
    public async Task<IActionResult> GetCachePi()
    {
        var products = await _db.Products
            .Select(p => new { p.CodeUpc, p.Nom, p.Volume, p.ImageUrl, p.AltCodes })
            .ToListAsync();

        var result = new List<object>(products.Count);
        foreach (var p in products)
        {
            result.Add(new { codeUpc = p.CodeUpc, p.Nom, p.Volume, p.ImageUrl });
            if (!string.IsNullOrEmpty(p.AltCodes))
                foreach (var alt in p.AltCodes.Split(';', StringSplitOptions.RemoveEmptyEntries))
                    result.Add(new { codeUpc = alt, p.Nom, p.Volume, p.ImageUrl });
        }
        return Ok(result);
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

        var match = await FindByAltCode(code);
        if (match is not null) return Ok(match);

        // Tolère un écart d'un zéro (ex: SAQ.com affiche parfois un UPC avec un 0 en trop
        // par rapport à celui sur la bouteille) — même tolérance que ScanController.
        foreach (var variant in BarcodeTolerance.ZeroVariants(code))
        {
            var p = await _db.Products.FirstOrDefaultAsync(p => p.CodeUpc == variant);
            if (p is not null) return Ok(p);
            var alt = await FindByAltCode(variant);
            if (alt is not null) return Ok(alt);
        }

        return NotFound();
    }

    private async Task<Product?> FindByAltCode(string code)
    {
        var candidates = await _db.Products
            .Where(p => p.AltCodes != null && p.AltCodes.Contains(code))
            .ToListAsync();
        return candidates.FirstOrDefault(p =>
            p.AltCodes!.Split(';', StringSplitOptions.RemoveEmptyEntries).Contains(code));
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
