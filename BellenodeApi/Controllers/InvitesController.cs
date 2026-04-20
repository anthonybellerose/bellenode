using BellenodeApi.Data;
using BellenodeApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BellenodeApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InvitesController : BellenodeControllerBase
{
    private readonly BellenodeDbContext _db;

    public InvitesController(BellenodeDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();
        if (!await IsRestaurantAdmin(_db, restaurantId.Value)) return Forbid();

        var invites = await _db.InviteTokens
            .Where(i => i.RestaurantId == restaurantId && i.UsedAt == null && i.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new { i.Id, i.Token, i.ExpiresAt, i.CreatedAt })
            .ToListAsync();

        return Ok(invites);
    }

    [HttpPost]
    public async Task<IActionResult> Create()
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();
        if (!await IsRestaurantAdmin(_db, restaurantId.Value)) return Forbid();

        var invite = new InviteToken
        {
            RestaurantId = restaurantId.Value,
            Token = Guid.NewGuid().ToString("N"),
            CreatedByUserId = CurrentUserId,
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        };
        _db.InviteTokens.Add(invite);
        await _db.SaveChangesAsync();

        return Ok(new { invite.Id, invite.Token, invite.ExpiresAt });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Revoke(int id)
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();
        if (!await IsRestaurantAdmin(_db, restaurantId.Value)) return Forbid();

        var invite = await _db.InviteTokens
            .FirstOrDefaultAsync(i => i.Id == id && i.RestaurantId == restaurantId);
        if (invite is null) return NotFound();

        _db.InviteTokens.Remove(invite);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
