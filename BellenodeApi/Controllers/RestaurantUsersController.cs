using BellenodeApi.Data;
using BellenodeApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BellenodeApi.Controllers;

[ApiController]
[Route("api/restaurant-users")]
[Authorize]
public class RestaurantUsersController : BellenodeControllerBase
{
    private readonly BellenodeDbContext _db;

    public RestaurantUsersController(BellenodeDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();
        if (!await IsRestaurantAdmin(_db, restaurantId.Value)) return Forbid();

        var users = await _db.UserRestaurantAccesses
            .Where(a => a.RestaurantId == restaurantId)
            .Include(a => a.User)
            .OrderBy(a => a.User.Nom)
            .Select(a => new
            {
                userId = a.UserId,
                nom = a.User.Nom,
                email = a.User.Email,
                restaurantRole = a.RestaurantRole.ToString(),
                isSelf = a.UserId == CurrentUserId
            })
            .ToListAsync();

        return Ok(users);
    }

    public record UpdateRoleRequest(string RestaurantRole);

    [HttpPatch("{userId}")]
    public async Task<IActionResult> UpdateRole(int userId, [FromBody] UpdateRoleRequest req)
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();
        if (!await IsRestaurantAdmin(_db, restaurantId.Value)) return Forbid();
        if (userId == CurrentUserId) return BadRequest(new { error = "Vous ne pouvez pas modifier votre propre rôle." });

        if (!Enum.TryParse<RestaurantRole>(req.RestaurantRole, out var role))
            return BadRequest(new { error = "Rôle invalide." });

        var access = await _db.UserRestaurantAccesses
            .FirstOrDefaultAsync(a => a.UserId == userId && a.RestaurantId == restaurantId);
        if (access is null) return NotFound();

        access.RestaurantRole = role;
        await _db.SaveChangesAsync();
        return Ok(new { userId, restaurantRole = role.ToString() });
    }

    [HttpDelete("{userId}")]
    public async Task<IActionResult> Remove(int userId)
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();
        if (!await IsRestaurantAdmin(_db, restaurantId.Value)) return Forbid();
        if (userId == CurrentUserId) return BadRequest(new { error = "Vous ne pouvez pas vous retirer vous-même." });

        var access = await _db.UserRestaurantAccesses
            .FirstOrDefaultAsync(a => a.UserId == userId && a.RestaurantId == restaurantId);
        if (access is null) return NotFound();

        _db.UserRestaurantAccesses.Remove(access);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
