namespace BellenodeApi.Models;

public class UserRestaurantAccess
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int RestaurantId { get; set; }

    public User User { get; set; } = null!;
    public Restaurant Restaurant { get; set; } = null!;
}
