using System.Security.Claims;
using BellenodeApi.Data;
using BellenodeApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BellenodeApi.Controllers;

public class BellenodeControllerBase : ControllerBase
{
    protected int CurrentUserId =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    protected bool IsSuperAdmin =>
        User.FindFirstValue(ClaimTypes.Role) == "SuperAdmin";

    protected async Task<int?> GetAuthorizedRestaurantId(BellenodeDbContext db)
    {
        if (!Request.Headers.TryGetValue("X-Restaurant-Id", out var header) ||
            !int.TryParse(header, out var restaurantId))
            return null;

        if (IsSuperAdmin) return restaurantId;

        var hasAccess = await db.UserRestaurantAccesses
            .AnyAsync(a => a.UserId == CurrentUserId && a.RestaurantId == restaurantId);

        return hasAccess ? restaurantId : null;
    }

    protected async Task<bool> IsRestaurantAdmin(BellenodeDbContext db, int restaurantId)
    {
        if (IsSuperAdmin) return true;
        var access = await db.UserRestaurantAccesses
            .FirstOrDefaultAsync(a => a.UserId == CurrentUserId && a.RestaurantId == restaurantId);
        return access?.RestaurantRole == RestaurantRole.Admin;
    }
}
