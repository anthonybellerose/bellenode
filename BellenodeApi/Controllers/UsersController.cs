using BellenodeApi.Data;
using BellenodeApi.Models;
using BellenodeApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BellenodeApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "SuperAdmin")]
public class UsersController : BellenodeControllerBase
{
    private readonly BellenodeDbContext _db;

    public UsersController(BellenodeDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var users = await _db.Users
            .Include(u => u.RestaurantAccesses)
            .ThenInclude(a => a.Restaurant)
            .OrderBy(u => u.Nom)
            .ToListAsync();

        return Ok(users.Select(u => new
        {
            u.Id,
            u.Email,
            u.Nom,
            role = u.Role.ToString(),
            u.CreatedAt,
            restaurants = u.RestaurantAccesses.Select(a => new { a.RestaurantId, a.Restaurant.Nom, restaurantRole = a.RestaurantRole.ToString() })
        }));
    }

    public record RestaurantAssignment(int RestaurantId, string RestaurantRole);
    public record CreateUserRequest(string Email, string Nom, string Password, string Role, List<RestaurantAssignment> Restaurants);

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest req)
    {
        if (await _db.Users.AnyAsync(u => u.Email.ToLower() == req.Email.ToLower().Trim()))
            return BadRequest(new { error = "Ce courriel est déjà utilisé." });

        if (!Enum.TryParse<UserRole>(req.Role, out var role))
            return BadRequest(new { error = "Rôle invalide." });

        var user = new User
        {
            Email = req.Email.Trim().ToLower(),
            Nom = req.Nom.Trim(),
            PasswordHash = AuthService.HashPassword(req.Password),
            Role = role
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        foreach (var assignment in req.Restaurants)
        {
            if (await _db.Restaurants.AnyAsync(r => r.Id == assignment.RestaurantId))
            {
                Enum.TryParse<RestaurantRole>(assignment.RestaurantRole, out var rRole);
                _db.UserRestaurantAccesses.Add(new UserRestaurantAccess
                {
                    UserId = user.Id,
                    RestaurantId = assignment.RestaurantId,
                    RestaurantRole = rRole
                });
            }
        }
        await _db.SaveChangesAsync();

        return Ok(new { user.Id, user.Email, user.Nom, role = user.Role.ToString() });
    }

    public record UpdateUserRequest(string Email, string Nom, string Role, string? Password, List<RestaurantAssignment> Restaurants);

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateUserRequest req)
    {
        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound();

        if (!Enum.TryParse<UserRole>(req.Role, out var role))
            return BadRequest(new { error = "Rôle invalide." });

        var emailConflict = await _db.Users
            .AnyAsync(u => u.Email.ToLower() == req.Email.ToLower().Trim() && u.Id != id);
        if (emailConflict)
            return BadRequest(new { error = "Ce courriel est déjà utilisé." });

        user.Email = req.Email.Trim().ToLower();
        user.Nom = req.Nom.Trim();
        user.Role = role;
        if (!string.IsNullOrWhiteSpace(req.Password))
            user.PasswordHash = AuthService.HashPassword(req.Password);

        var existing = await _db.UserRestaurantAccesses
            .Where(a => a.UserId == id)
            .ToListAsync();
        _db.UserRestaurantAccesses.RemoveRange(existing);

        foreach (var assignment in req.Restaurants)
        {
            if (await _db.Restaurants.AnyAsync(r => r.Id == assignment.RestaurantId))
            {
                Enum.TryParse<RestaurantRole>(assignment.RestaurantRole, out var rRole);
                _db.UserRestaurantAccesses.Add(new UserRestaurantAccess
                {
                    UserId = user.Id,
                    RestaurantId = assignment.RestaurantId,
                    RestaurantRole = rRole
                });
            }
        }

        await _db.SaveChangesAsync();
        return Ok(new { user.Id, user.Email, user.Nom, role = user.Role.ToString() });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (id == CurrentUserId)
            return BadRequest(new { error = "Vous ne pouvez pas supprimer votre propre compte." });

        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound();

        _db.Users.Remove(user);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
