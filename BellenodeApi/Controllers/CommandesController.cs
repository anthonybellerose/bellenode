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
}
