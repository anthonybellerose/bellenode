using BellenodeApi.Data;
using BellenodeApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BellenodeApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class JoinRequestsController : BellenodeControllerBase
{
    private readonly BellenodeDbContext _db;

    public JoinRequestsController(BellenodeDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();

        if (!await IsRestaurantAdmin(_db, restaurantId.Value)) return Forbid();

        var requests = await _db.JoinRequests
            .Include(j => j.User)
            .Where(j => j.RestaurantId == restaurantId && j.Status == JoinRequestStatus.Pending)
            .OrderBy(j => j.CreatedAt)
            .Select(j => new
            {
                j.Id,
                j.Status,
                j.CreatedAt,
                user = new { j.User.Id, j.User.Nom, j.User.Email }
            })
            .ToListAsync();

        return Ok(requests);
    }

    [HttpPost("{id}/approve")]
    public async Task<IActionResult> Approve(int id)
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();
        if (!await IsRestaurantAdmin(_db, restaurantId.Value)) return Forbid();

        var request = await _db.JoinRequests
            .FirstOrDefaultAsync(j => j.Id == id && j.RestaurantId == restaurantId && j.Status == JoinRequestStatus.Pending);

        if (request is null) return NotFound();

        request.Status = JoinRequestStatus.Approved;
        request.ReviewedAt = DateTime.UtcNow;

        var alreadyHasAccess = await _db.UserRestaurantAccesses
            .AnyAsync(a => a.UserId == request.UserId && a.RestaurantId == request.RestaurantId);

        if (!alreadyHasAccess)
        {
            _db.UserRestaurantAccesses.Add(new UserRestaurantAccess
            {
                UserId = request.UserId,
                RestaurantId = request.RestaurantId,
                RestaurantRole = RestaurantRole.User
            });
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Accès accordé." });
    }

    [HttpPost("{id}/reject")]
    public async Task<IActionResult> Reject(int id)
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();
        if (!await IsRestaurantAdmin(_db, restaurantId.Value)) return Forbid();

        var request = await _db.JoinRequests
            .FirstOrDefaultAsync(j => j.Id == id && j.RestaurantId == restaurantId && j.Status == JoinRequestStatus.Pending);

        if (request is null) return NotFound();

        request.Status = JoinRequestStatus.Rejected;
        request.ReviewedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Demande refusée." });
    }
}
