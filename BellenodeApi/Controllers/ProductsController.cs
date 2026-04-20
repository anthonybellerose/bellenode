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
        var query = _db.Products.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(p =>
                p.Nom.ToLower().Contains(s) ||
                p.CodeUpc.Contains(s) ||
                (p.CodeSaq != null && p.CodeSaq.Contains(s)));
        }

        return Ok(await query.OrderBy(p => p.Nom).ToListAsync());
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
        return product is null ? NotFound() : Ok(product);
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
