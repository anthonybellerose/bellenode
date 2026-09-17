using BellenodeApi.Data;
using Microsoft.EntityFrameworkCore;

namespace BellenodeApi.Services;

/// Recroise les items d'inventaire marqués "non référencés" contre le catalogue produits
/// (CodeUpc + AltCodes) et les mappings de caisse — corrige les IsReferenced désynchronisés
/// et supprime les lignes orphelines de code caisse. Extrait de InventoryController pour être
/// aussi appelé après chaque batch de scan (voir ScanController), pas seulement quand la page
/// web "Non référencés" est visitée — un produit ajouté au catalogue après coup doit se
/// raccrocher à son inventaire existant sans attendre qu'un humain retourne sur cette page.
public static class InventoryReconciliation
{
    public static async Task ReconcileAsync(BellenodeDbContext db, int restaurantId)
    {
        var items = await db.Inventory
            .Where(i => i.RestaurantId == restaurantId && !i.IsReferenced)
            .ToListAsync();
        if (items.Count == 0) return;

        var codes = items.Select(i => i.Code).ToHashSet();
        var matchedUpc = await db.Products
            .Where(p => codes.Contains(p.CodeUpc))
            .Select(p => p.CodeUpc)
            .ToListAsync();
        var matched = new HashSet<string>(matchedUpc);

        var altProducts = await db.Products
            .Where(p => p.AltCodes != null)
            .Select(p => p.AltCodes!)
            .ToListAsync();
        foreach (var altStr in altProducts)
            foreach (var alt in altStr.Split(';', StringSplitOptions.RemoveEmptyEntries))
                if (codes.Contains(alt)) matched.Add(alt);

        // Auto-corriger les flags désynchronisés (vrai produit retrouvé)
        var toFix = items.Where(i => matched.Contains(i.Code)).ToList();
        foreach (var inv in toFix) { inv.IsReferenced = true; inv.UpdatedAt = DateTime.UtcNow; }

        // Un code caisse n'accumule jamais son propre inventaire (ScanController le convertit
        // toujours vers le produit unité au moment du scan) — une ligne encore présente pour
        // un code caisse mappé est donc orpheline, scannée avant l'ajout du mapping.
        var remaining = items.Where(i => !matched.Contains(i.Code)).ToList();
        var caisseCodes = new HashSet<string>(await db.CaisseMappings.Select(m => m.CodeCaisse).ToListAsync());
        var orphaned = remaining.Where(i => caisseCodes.Contains(i.Code)).ToList();
        if (orphaned.Count > 0)
            db.Inventory.RemoveRange(orphaned);

        if (toFix.Count > 0 || orphaned.Count > 0)
            await db.SaveChangesAsync();
    }
}
