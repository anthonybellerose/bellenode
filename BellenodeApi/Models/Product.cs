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
    public int? LotQty { get; set; }

    [MaxLength(500)]
    public string? AltCodes { get; set; } // codes séparés par ";" ex: "3179077542588;0012345678905"

    [MaxLength(32)]
    public string? Volume { get; set; } // ex: "750ml", "1L"

    [MaxLength(500)]
    public string? ImageUrl { get; set; }

    [MaxLength(500)]
    public string? Url { get; set; } // lien vers la fiche produit (ex: SAQ)

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
