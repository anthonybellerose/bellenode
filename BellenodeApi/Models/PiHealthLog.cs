using System.ComponentModel.DataAnnotations.Schema;

namespace BellenodeApi.Models;

public class PiHealthLog
{
    public int Id { get; set; }

    public int RestaurantId { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal TempC { get; set; }

    // Vrai si vcgencmd get_throttled renvoie un bitmask non nul (sous-tension ou
    // throttling thermique, actuel ou survenu depuis le dernier démarrage du Pi).
    public bool Throttled { get; set; }

    public bool AlertSent { get; set; }

    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
}
