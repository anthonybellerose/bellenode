using BellenodeApi.Data;
using BellenodeApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BellenodeApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CaisseMappingsController : ControllerBase
{
    private readonly BellenodeDbContext _db;

    public CaisseMappingsController(BellenodeDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var mappings = await (from m in _db.CaisseMappings
                              join p in _db.Products on m.CodeUnite equals p.CodeUpc into gj
                              from p in gj.DefaultIfEmpty()
                              orderby m.CodeCaisse
                              select new
                              {
                                  m.Id,
                                  m.CodeCaisse,
                                  m.CodeUnite,
                                  m.Quantite,
                                  nomUnite = p != null ? p.Nom : null
                              }).ToListAsync();

        return Ok(mappings);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CaisseMapping input)
    {
        input.Id = 0;
        input.CreatedAt = DateTime.UtcNow;
        _db.CaisseMappings.Add(input);
        await _db.SaveChangesAsync();
        return Ok(input);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] CaisseMapping input)
    {
        var existing = await _db.CaisseMappings.FindAsync(id);
        if (existing is null) return NotFound();

        existing.CodeCaisse = input.CodeCaisse;
        existing.CodeUnite = input.CodeUnite;
        existing.Quantite = input.Quantite;

        await _db.SaveChangesAsync();
        return Ok(existing);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var existing = await _db.CaisseMappings.FindAsync(id);
        if (existing is null) return NotFound();

        _db.CaisseMappings.Remove(existing);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
