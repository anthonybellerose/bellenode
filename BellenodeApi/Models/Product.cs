using System.ComponentModel.DataAnnotations;

namespace BellenodeApi.Models;

public class Product
{
    public int Id { get; set; }

    [Required, MaxLength(32)]
    public string CodeUpc { get; set; } = "";

    [Required, MaxLength(200)]
    public string Nom { get; set; } = "";

    [MaxLength(32)]
    public string? CodeSaq { get; set; }

    public decimal? Prix { get; set; }

    public int? UnitesParCaisse { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
