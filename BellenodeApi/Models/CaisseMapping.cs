using System.ComponentModel.DataAnnotations;

namespace BellenodeApi.Models;

public class CaisseMapping
{
    public int Id { get; set; }

    [Required, MaxLength(32)]
    public string CodeCaisse { get; set; } = "";

    [Required, MaxLength(32)]
    public string CodeUnite { get; set; } = "";

    public int Quantite { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
