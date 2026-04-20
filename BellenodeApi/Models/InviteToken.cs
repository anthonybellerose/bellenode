using System.ComponentModel.DataAnnotations;

namespace BellenodeApi.Models;

public class InviteToken
{
    public int Id { get; set; }
    public int RestaurantId { get; set; }

    [Required, MaxLength(64)]
    public string Token { get; set; } = Guid.NewGuid().ToString("N");

    public int CreatedByUserId { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Restaurant Restaurant { get; set; } = null!;
}
