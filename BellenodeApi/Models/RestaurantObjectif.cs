using System.ComponentModel.DataAnnotations;

namespace BellenodeApi.Models;

public class RestaurantObjectif
{
    public int Id { get; set; }
    public int RestaurantId { get; set; }

    [Required, MaxLength(32)]
    public string CodeUpc { get; set; } = "";

    public int MinQty { get; set; }
    public int MaxQty { get; set; }
    public int LotQty { get; set; } = 1;
}
