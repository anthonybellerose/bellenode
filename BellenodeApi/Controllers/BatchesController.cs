using BellenodeApi.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BellenodeApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BatchesController : ControllerBase
{
    private readonly BellenodeDbContext _db;

    public BatchesController(BellenodeDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var batches = await _db.ScanBatches
            .OrderByDescending(b => b.CreatedAt)
            .Select(b => new
            {
                b.Id,
                b.Note,
                b.CreatedBy,
                b.CreatedAt,
                b.LignesOps,
                b.ProduitsTouches,
                b.TotalAjouts,
                b.TotalRetraits
            })
            .Take(200)
            .ToListAsync();

        return Ok(batches);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(int id)
    {
        var batch = await _db.ScanBatches
            .Include(b => b.Operations)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (batch is null) return NotFound();

        var productCodes = batch.Operations.Select(o => o.Code).Distinct().ToList();
        var productNames = await _db.Products
            .Where(p => productCodes.Contains(p.CodeUpc))
            .ToDictionaryAsync(p => p.CodeUpc, p => p.Nom);

        return Ok(new
        {
            batch.Id,
            batch.Note,
            batch.CreatedBy,
            batch.CreatedAt,
            batch.LignesOps,
            batch.ProduitsTouches,
            batch.TotalAjouts,
            batch.TotalRetraits,
            operations = batch.Operations.Select(o => new
            {
                o.Id,
                mode = o.Mode.ToString(),
                o.Code,
                nom = productNames.GetValueOrDefault(o.Code),
                o.Quantite,
                o.IsReferenced,
                o.QtyAvant,
                o.QtyApres
            })
        });
    }
}
