using System.ComponentModel.DataAnnotations;

namespace BellenodeApi.Models;

public class InventoryItem
{
    public int Id { get; set; }

    [Required, MaxLength(32)]
    public string Code { get; set; } = "";

    public int RestaurantId { get; set; }

    public int Quantite { get; set; }

    public bool IsReferenced { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
