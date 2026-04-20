namespace BellenodeApi.Models;

public enum RestaurantRole { User, Admin }

public class UserRestaurantAccess
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int RestaurantId { get; set; }
    public RestaurantRole RestaurantRole { get; set; } = RestaurantRole.User;

    public User User { get; set; } = null!;
    public Restaurant Restaurant { get; set; } = null!;
}
