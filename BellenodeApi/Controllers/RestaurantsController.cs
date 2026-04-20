using BellenodeApi.Data;
using BellenodeApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BellenodeApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "SuperAdmin")]
public class RestaurantsController : BellenodeControllerBase
{
    private readonly BellenodeDbContext _db;

    public RestaurantsController(BellenodeDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var restaurants = await _db.Restaurants
            .OrderBy(r => r.Nom)
            .Select(r => new { r.Id, r.Nom, r.IsActive, r.CreatedAt })
            .ToListAsync();
        return Ok(restaurants);
    }

    public record RestaurantInput(string Nom);

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] RestaurantInput input)
    {
        var restaurant = new Restaurant { Nom = input.Nom.Trim() };
        _db.Restaurants.Add(restaurant);
        await _db.SaveChangesAsync();
        return Ok(new { restaurant.Id, restaurant.Nom, restaurant.IsActive, restaurant.CreatedAt });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] RestaurantInput input)
    {
        var restaurant = await _db.Restaurants.FindAsync(id);
        if (restaurant is null) return NotFound();

        restaurant.Nom = input.Nom.Trim();
        await _db.SaveChangesAsync();
        return Ok(new { restaurant.Id, restaurant.Nom, restaurant.IsActive });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var restaurant = await _db.Restaurants.FindAsync(id);
        if (restaurant is null) return NotFound();

        restaurant.IsActive = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
