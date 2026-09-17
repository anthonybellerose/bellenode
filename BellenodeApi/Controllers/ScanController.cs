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

        var products = await _db.Products
            .Select(p => new { p.CodeUpc, p.AltCodes })
            .ToListAsync();

        var referencedCodes = new HashSet<string>(products.Select(p => p.CodeUpc));

        // Résout un code alternatif (ex: UPC avec un 0 en trop, fréquent sur le site SAQ)
        // vers le CodeUpc canonique du produit, pour que l'inventaire s'accumule sur une
        // seule ligne au lieu d'en créer une deuxième "non référencée" pour le même produit.
        var altCodeMap = new Dictionary<string, string>();
        foreach (var p in products)
        {
            if (string.IsNullOrEmpty(p.AltCodes)) continue;
            foreach (var alt in p.AltCodes.Split(';', StringSplitOptions.RemoveEmptyEntries))
                altCodeMap[alt] = p.CodeUpc;
        }

        var mappings = await _db.CaisseMappings
            .ToDictionaryAsync(m => m.CodeCaisse, m => (m.CodeUnite, m.Quantite));

        // Résout un code vers son CodeUpc canonique, en tolérant un écart d'un zéro (ex: SAQ.com
        // affiche parfois un UPC avec un 0 en trop par rapport à celui sur la bouteille) si aucun
        // match exact n'existe. ViaTolerance=true seulement quand c'est cette tolérance qui a
        // permis le match (pas un AltCode déjà connu) — sert à décider si on doit l'enregistrer.
        (string Code, bool ViaTolerance)? ResolveCanonical(string rawCode)
        {
            if (referencedCodes.Contains(rawCode)) return (rawCode, false);
            if (altCodeMap.TryGetValue(rawCode, out var direct)) return (direct, false);
            foreach (var variant in BarcodeTolerance.ZeroVariants(rawCode))
            {
                if (referencedCodes.Contains(variant)) return (variant, true);
                if (altCodeMap.TryGetValue(variant, out var viaAlt)) return (viaAlt, true);
            }
            return null;
        }

        // Un match trouvé seulement via tolérance est enregistré comme code alternatif
        // permanent sur le produit — le prochain scan de ce code exact le retrouvera
        // directement, sans repasser par la tolérance (catalogue qui s'auto-corrige).
        async Task PersistAsAltCode(string canonicalCode, string newAlt)
        {
            var product = await _db.Products.FirstOrDefaultAsync(p => p.CodeUpc == canonicalCode);
            if (product is null) return;
            var existing = string.IsNullOrEmpty(product.AltCodes)
                ? new List<string>()
                : product.AltCodes.Split(';', StringSplitOptions.RemoveEmptyEntries).ToList();
            if (existing.Contains(newAlt)) return;
            existing.Add(newAlt);
            product.AltCodes = string.Join(';', existing);
            product.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            altCodeMap[newAlt] = canonicalCode;
        }

        var converted = new List<(ScanMode mode, string code, int qty)>();
        foreach (var raw in req.Operations)
        {
            var mode = ParseMode(raw.Mode);
            if (mode is null) continue;

            var qty = raw.Mode == "=" ? (raw.Quantite ?? 0) : (raw.Quantite is > 0 ? raw.Quantite.Value : 1);
            var code = raw.Code.Trim();

            // Code::Code et InventoryItem::Code sont limités à 32 caractères en BD (MaxLength).
            // Un code plus long (ex: touches restées appuyées sur un clavier de scan) faisait
            // planter tout le batch avec un 500 non géré au SaveChangesAsync, et le Pi retentait
            // ce même scan cassé indéfiniment toutes les 30s sans jamais réussir. On l'ignore
            // proprement ici à la place.
            if (code.Length == 0 || code.Length > 32) continue;

            if (mappings.TryGetValue(code, out var map))
            {
                converted.Add((mode.Value, map.CodeUnite, qty * map.Quantite));
                continue;
            }

            var resolved = ResolveCanonical(code);
            if (resolved is { } r)
            {
                if (r.ViaTolerance)
                    await PersistAsAltCode(r.Code, code);
                converted.Add((mode.Value, r.Code, qty));
            }
            else
            {
                converted.Add((mode.Value, code, qty));
            }
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

        // Recroise TOUS les non-référencés du restaurant contre le catalogue à chaque batch —
        // pas seulement les codes de ce batch — pour qu'un produit ajouté au catalogue après
        // coup se raccroche à son inventaire existant sans attendre une visite de la page
        // "Non référencés" (voir InventoryReconciliation).
        await InventoryReconciliation.ReconcileAsync(_db, restaurantId.Value);

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
