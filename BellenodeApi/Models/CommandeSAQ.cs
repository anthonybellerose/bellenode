using System.ComponentModel.DataAnnotations;

namespace BellenodeApi.Models;

public class CommandeSAQ
{
    public int Id { get; set; }
    public int RestaurantId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [MaxLength(200)] public string? CreatedBy { get; set; }
    [MaxLength(500)] public string? Note { get; set; }
    public List<CommandeSAQItem> Items { get; set; } = new();
}

public class CommandeSAQItem
{
    public int Id { get; set; }
    public int CommandeId { get; set; }
    public CommandeSAQ Commande { get; set; } = null!;
    [Required, MaxLength(32)]  public string CodeSaq { get; set; } = "";
    [Required, MaxLength(200)] public string NomProduit { get; set; } = "";
    [MaxLength(50)] public string? Volume { get; set; }
    public int Quantite { get; set; }
}
