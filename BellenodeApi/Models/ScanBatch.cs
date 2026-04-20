using System.ComponentModel.DataAnnotations;

namespace BellenodeApi.Models;

public class ScanBatch
{
    public int Id { get; set; }

    public int RestaurantId { get; set; }

    [MaxLength(100)]
    public string? Note { get; set; }

    [MaxLength(50)]
    public string? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public int LignesOps { get; set; }
    public int ProduitsTouches { get; set; }
    public int TotalAjouts { get; set; }
    public int TotalRetraits { get; set; }

    public List<ScanOperation> Operations { get; set; } = new();
}
