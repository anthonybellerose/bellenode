using System.ComponentModel.DataAnnotations;

namespace BellenodeApi.Models;

public enum UserRole { User, SuperAdmin }

public class User
{
    public int Id { get; set; }

    [Required, MaxLength(200)]
    public string Email { get; set; } = "";

    [Required]
    public string PasswordHash { get; set; } = "";

    [Required, MaxLength(100)]
    public string Nom { get; set; } = "";

    public UserRole Role { get; set; } = UserRole.User;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<UserRestaurantAccess> RestaurantAccesses { get; set; } = new();
}
