using System.ComponentModel.DataAnnotations;

namespace BellenodeApi.Models;

public class Restaurant
{
    public int Id { get; set; }

    [Required, MaxLength(200)]
    public string Nom { get; set; } = "";

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<UserRestaurantAccess> UserAccesses { get; set; } = new();
}
