using BellenodeApi.Data;
using BellenodeApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BellenodeApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : BellenodeControllerBase
{
    private readonly BellenodeDbContext _db;
    private readonly AuthService _auth;

    public AuthController(BellenodeDbContext db, AuthService auth)
    {
        _db = db;
        _auth = auth;
    }

    public record LoginRequest(string Email, string Password);

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == req.Email.ToLower().Trim());

        if (user is null || !AuthService.VerifyPassword(req.Password, user.PasswordHash))
            return Unauthorized(new { error = "Courriel ou mot de passe invalide." });

        var token = _auth.GenerateToken(user);

        return Ok(new
        {
            token,
            user = new { user.Id, user.Email, user.Nom, role = user.Role.ToString() }
        });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();

        return Ok(new { user.Id, user.Email, user.Nom, role = user.Role.ToString() });
    }

    [Authorize]
    [HttpGet("restaurants")]
    public async Task<IActionResult> MyRestaurants()
    {
        if (IsSuperAdmin)
        {
            var all = await _db.Restaurants
                .Where(r => r.IsActive)
                .OrderBy(r => r.Nom)
                .Select(r => new { r.Id, r.Nom })
                .ToListAsync();
            return Ok(all);
        }

        var restaurants = await _db.UserRestaurantAccesses
            .Where(a => a.UserId == CurrentUserId && a.Restaurant.IsActive)
            .OrderBy(a => a.Restaurant.Nom)
            .Select(a => new { a.Restaurant.Id, a.Restaurant.Nom })
            .ToListAsync();

        return Ok(restaurants);
    }
}
