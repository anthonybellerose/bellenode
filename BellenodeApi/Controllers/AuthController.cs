using BellenodeApi.Data;
using BellenodeApi.Models;
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
    private readonly EmailService _email;

    public AuthController(BellenodeDbContext db, AuthService auth, EmailService email)
    {
        _db = db;
        _auth = auth;
        _email = email;
    }

    public record LoginRequest(string Email, string Password);

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == req.Email.ToLower().Trim());

        if (user is null || !AuthService.VerifyPassword(req.Password, user.PasswordHash))
            return Unauthorized(new { error = "Courriel ou mot de passe invalide." });

        return Ok(new
        {
            token = _auth.GenerateToken(user),
            user = new { user.Id, user.Email, user.Nom, role = user.Role.ToString() }
        });
    }

    public record RegisterRequest(string Email, string Nom, string Password, int? RestaurantId);

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password) || string.IsNullOrWhiteSpace(req.Nom))
            return BadRequest(new { error = "Tous les champs sont requis." });

        if (await _db.Users.AnyAsync(u => u.Email == req.Email.Trim().ToLower()))
            return BadRequest(new { error = "Ce courriel est déjà utilisé." });

        var user = new User
        {
            Email = req.Email.Trim().ToLower(),
            Nom = req.Nom.Trim(),
            PasswordHash = AuthService.HashPassword(req.Password),
            Role = UserRole.User
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        if (req.RestaurantId.HasValue)
        {
            var restaurant = await _db.Restaurants
                .FirstOrDefaultAsync(r => r.Id == req.RestaurantId && r.IsActive);
            if (restaurant != null)
            {
                _db.JoinRequests.Add(new JoinRequest
                {
                    UserId = user.Id,
                    RestaurantId = req.RestaurantId.Value
                });
                await _db.SaveChangesAsync();
            }
        }

        return Ok(new
        {
            token = _auth.GenerateToken(user),
            user = new { user.Id, user.Email, user.Nom, role = user.Role.ToString() },
            joinRequestSent = req.RestaurantId.HasValue
        });
    }

    [HttpGet("invite/{token}")]
    public async Task<IActionResult> GetInviteInfo(string token)
    {
        var invite = await _db.InviteTokens
            .Include(i => i.Restaurant)
            .FirstOrDefaultAsync(i => i.Token == token && i.UsedAt == null && i.ExpiresAt > DateTime.UtcNow);

        if (invite is null) return NotFound(new { error = "Lien invalide ou expiré." });

        return Ok(new { restaurantId = invite.RestaurantId, restaurantNom = invite.Restaurant.Nom });
    }

    public record RegisterWithInviteRequest(string Email, string Nom, string Password, string Token);

    [HttpPost("register-invite")]
    public async Task<IActionResult> RegisterWithInvite([FromBody] RegisterWithInviteRequest req)
    {
        var invite = await _db.InviteTokens
            .Include(i => i.Restaurant)
            .FirstOrDefaultAsync(i => i.Token == req.Token && i.UsedAt == null && i.ExpiresAt > DateTime.UtcNow);

        if (invite is null) return BadRequest(new { error = "Lien invalide ou expiré." });

        if (await _db.Users.AnyAsync(u => u.Email == req.Email.Trim().ToLower()))
            return BadRequest(new { error = "Ce courriel est déjà utilisé." });

        var user = new User
        {
            Email = req.Email.Trim().ToLower(),
            Nom = req.Nom.Trim(),
            PasswordHash = AuthService.HashPassword(req.Password),
            Role = UserRole.User
        };
        _db.Users.Add(user);
        invite.UsedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        _db.UserRestaurantAccesses.Add(new UserRestaurantAccess
        {
            UserId = user.Id,
            RestaurantId = invite.RestaurantId,
            RestaurantRole = RestaurantRole.User
        });
        await _db.SaveChangesAsync();

        return Ok(new
        {
            token = _auth.GenerateToken(user),
            user = new { user.Id, user.Email, user.Nom, role = user.Role.ToString() },
            restaurant = new { id = invite.RestaurantId, nom = invite.Restaurant.Nom }
        });
    }

    public record ForgotPasswordRequest(string Email);

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest req)
    {
        // Réponse identique qu'on trouve l'email ou non (pas de leak)
        if (string.IsNullOrWhiteSpace(req.Email))
            return Ok(new { ok = true });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == req.Email.ToLower().Trim());
        if (user is not null)
        {
            var tokenBytes = new byte[32];
            System.Security.Cryptography.RandomNumberGenerator.Fill(tokenBytes);
            var token = Convert.ToBase64String(tokenBytes).Replace("+", "-").Replace("/", "_").Replace("=", "");

            _db.PasswordResetTokens.Add(new PasswordResetToken
            {
                UserId = user.Id,
                Token = token,
                ExpiresAt = DateTime.UtcNow.AddHours(2),
                CreatedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync();

            var baseUrl = HttpContext.RequestServices.GetRequiredService<IConfiguration>()["Smtp:PublicBaseUrl"] ?? "https://bellenode.com";
            var link = $"{baseUrl}/reset-password?token={token}";

            var body = $@"<div style='font-family:Arial,sans-serif;color:#1a1a24'>
<h2 style='color:#3b82f6'>Bellenode — Réinitialisation du mot de passe</h2>
<p>Bonjour {System.Net.WebUtility.HtmlEncode(user.Nom)},</p>
<p>Clique sur le lien ci-dessous pour choisir un nouveau mot de passe. Ce lien expire dans 2 heures.</p>
<p><a href='{link}' style='background:#3b82f6;color:#fff;padding:10px 18px;text-decoration:none;border-radius:6px;display:inline-block'>Réinitialiser mon mot de passe</a></p>
<p style='color:#666;font-size:12px'>Si le bouton ne fonctionne pas : {link}</p>
<p style='color:#666;font-size:12px'>Si tu n'as pas demandé cette réinitialisation, ignore cet email.</p>
</div>";

            await _email.SendAsync(user.Email, user.Nom, "Réinitialisation de mot de passe — Bellenode", body);
        }

        return Ok(new { ok = true });
    }

    public record ResetPasswordRequest(string Token, string NewPassword);

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Token) || string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 8)
            return BadRequest(new { error = "Lien invalide ou mot de passe trop court (min 8)." });

        var now = DateTime.UtcNow;
        var tok = await _db.PasswordResetTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Token == req.Token);

        if (tok is null || tok.UsedAt is not null || tok.ExpiresAt < now)
            return BadRequest(new { error = "Lien invalide ou expiré." });

        tok.User.PasswordHash = AuthService.HashPassword(req.NewPassword);
        tok.UsedAt = now;
        await _db.SaveChangesAsync();

        return Ok(new { ok = true });
    }

    public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 8)
            return BadRequest(new { error = "Le nouveau mot de passe doit avoir au moins 8 caractères." });

        if (!AuthService.VerifyPassword(req.CurrentPassword ?? "", user.PasswordHash))
            return BadRequest(new { error = "Mot de passe actuel invalide." });

        user.PasswordHash = AuthService.HashPassword(req.NewPassword);
        await _db.SaveChangesAsync();

        return Ok(new { ok = true });
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
                .Select(r => new { r.Id, r.Nom, restaurantRole = "SuperAdmin" })
                .ToListAsync();
            return Ok(all);
        }

        var restaurants = await _db.UserRestaurantAccesses
            .Where(a => a.UserId == CurrentUserId && a.Restaurant.IsActive)
            .OrderBy(a => a.Restaurant.Nom)
            .Select(a => new
            {
                a.Restaurant.Id,
                a.Restaurant.Nom,
                restaurantRole = a.RestaurantRole.ToString()
            })
            .ToListAsync();

        return Ok(restaurants);
    }
}
