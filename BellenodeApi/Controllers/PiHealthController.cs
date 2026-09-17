using BellenodeApi.Data;
using BellenodeApi.Models;
using BellenodeApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BellenodeApi.Controllers;

// Historique de santé matérielle du Raspberry Pi (température, throttling) — le Pi est
// dans un endroit qui chauffe l'été, et rien n'enregistrait cette donnée avant (impossible
// de savoir après coup s'il y a eu de la surchauffe, voir session 2026-09-17). Chaque
// lecture est conservée en base pour survivre aux redémarrages fréquents du Pi (le
// compteur "throttled" du Pi lui-même se réinitialise à chaque boot).
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PiHealthController : BellenodeControllerBase
{
    private const decimal AlertThresholdC = 70m;
    private static readonly TimeSpan AlertCooldown = TimeSpan.FromHours(3);
    private const string AlertEmail = "anthonybellerose2504@gmail.com";

    private readonly BellenodeDbContext _db;
    private readonly EmailService _email;

    public PiHealthController(BellenodeDbContext db, EmailService email)
    {
        _db = db;
        _email = email;
    }

    public record HealthReport(decimal TempC, bool Throttled);

    [HttpPost]
    public async Task<IActionResult> Report([FromBody] HealthReport report)
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();

        var isHot = report.TempC >= AlertThresholdC || report.Throttled;
        var alertSent = false;

        if (isHot)
        {
            var lastAlert = await _db.PiHealthLogs
                .Where(h => h.RestaurantId == restaurantId && h.AlertSent)
                .OrderByDescending(h => h.RecordedAt)
                .FirstOrDefaultAsync();

            if (lastAlert is null || DateTime.UtcNow - lastAlert.RecordedAt > AlertCooldown)
            {
                var reason = report.Throttled
                    ? $"le Raspberry Pi signale du throttling/sous-tension (température actuelle {report.TempC}°C)"
                    : $"la température du Raspberry Pi a atteint {report.TempC}°C";
                try
                {
                    await _email.SendAsync(
                        AlertEmail, "Anthony",
                        "⚠ Bellenode — alerte température Raspberry Pi",
                        $"<p>{reason}.</p><p>Vérifie la ventilation/l'emplacement de l'appareil si ça persiste.</p>");
                    alertSent = true;
                }
                catch
                {
                    // Une alerte email ratée ne doit pas empêcher d'enregistrer la lecture.
                }
            }
        }

        _db.PiHealthLogs.Add(new PiHealthLog
        {
            RestaurantId = restaurantId.Value,
            TempC = report.TempC,
            Throttled = report.Throttled,
            AlertSent = alertSent,
        });
        await _db.SaveChangesAsync();

        return Ok();
    }

    [HttpGet]
    public async Task<IActionResult> GetHistory([FromQuery] int hours = 24)
    {
        var restaurantId = await GetAuthorizedRestaurantId(_db);
        if (restaurantId is null) return Forbid();

        var since = DateTime.UtcNow.AddHours(-Math.Clamp(hours, 1, 24 * 90));
        var rows = await _db.PiHealthLogs
            .Where(h => h.RestaurantId == restaurantId && h.RecordedAt >= since)
            .OrderBy(h => h.RecordedAt)
            .Select(h => new { h.TempC, h.Throttled, h.RecordedAt })
            .ToListAsync();

        return Ok(rows);
    }
}
