using System.ComponentModel.DataAnnotations;

namespace BellenodeApi.Models;

public class CommandeConfig
{
    public int Id { get; set; }
    public int RestaurantId { get; set; }

    [MaxLength(100)] public string? NumeroClient { get; set; }
    [MaxLength(50)]  public string? Telephone { get; set; }
    [MaxLength(200)] public string? NomEtablissement { get; set; }
    [MaxLength(200)] public string? Courriel { get; set; }
    [MaxLength(200)] public string? Responsable { get; set; }

    [MaxLength(200)] public string? EmailDestinataire { get; set; }
    [MaxLength(300)] public string? EmailSujet { get; set; }
    public string? EmailMessage { get; set; }
}
