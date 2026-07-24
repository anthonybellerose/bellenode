using BellenodeApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace BellenodeApi.Data;

public class BellenodeDbContext : DbContext
{
    public BellenodeDbContext(DbContextOptions<BellenodeDbContext> options) : base(options) { }

    // SQL Server ne conserve pas le DateTimeKind : toute date relue depuis la BD revient en
    // "Unspecified", donc le JSON part sans indicateur de fuseau et le navigateur la réinterprète
    // comme une heure locale au lieu de la convertir depuis l'UTC. On force Kind=Utc à la lecture
    // (l'écriture ne change rien, toutes les dates sont déjà DateTime.UtcNow côté C#).
    private class UtcDateTimeConverter : ValueConverter<DateTime, DateTime>
    {
        public UtcDateTimeConverter() : base(
            v => v,
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc))
        { }
    }

    private class UtcNullableDateTimeConverter : ValueConverter<DateTime?, DateTime?>
    {
        public UtcNullableDateTimeConverter() : base(
            v => v,
            v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v)
        { }
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
        configurationBuilder.Properties<DateTime?>().HaveConversion<UtcNullableDateTimeConverter>();
    }

    public DbSet<Product> Products => Set<Product>();
    public DbSet<CaisseMapping> CaisseMappings => Set<CaisseMapping>();
    public DbSet<InventoryItem> Inventory => Set<InventoryItem>();
    public DbSet<ScanBatch> ScanBatches => Set<ScanBatch>();
    public DbSet<ScanOperation> ScanOperations => Set<ScanOperation>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Restaurant> Restaurants => Set<Restaurant>();
    public DbSet<UserRestaurantAccess> UserRestaurantAccesses => Set<UserRestaurantAccess>();
    public DbSet<RestaurantObjectif> RestaurantObjectifs => Set<RestaurantObjectif>();
    public DbSet<JoinRequest> JoinRequests => Set<JoinRequest>();
    public DbSet<InviteToken> InviteTokens => Set<InviteToken>();
    public DbSet<CommandeConfig> CommandeConfigs => Set<CommandeConfig>();
    public DbSet<CommandeSAQ> CommandesSAQ => Set<CommandeSAQ>();
    public DbSet<CommandeSAQItem> CommandeSAQItems => Set<CommandeSAQItem>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PasswordResetToken>()
            .HasIndex(t => t.Token)
            .IsUnique();

        modelBuilder.Entity<PasswordResetToken>()
            .HasOne(t => t.User)
            .WithMany()
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Product>()
            .HasIndex(p => p.CodeUpc)
            .IsUnique();

        modelBuilder.Entity<Product>()
            .Property(p => p.Prix)
            .HasColumnType("decimal(10,2)");

        modelBuilder.Entity<CaisseMapping>()
            .HasIndex(c => c.CodeCaisse)
            .IsUnique();

        modelBuilder.Entity<InventoryItem>()
            .HasIndex(i => new { i.Code, i.RestaurantId })
            .IsUnique();

        modelBuilder.Entity<ScanOperation>()
            .HasOne(o => o.ScanBatch)
            .WithMany(b => b.Operations)
            .HasForeignKey(o => o.ScanBatchId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<UserRestaurantAccess>()
            .HasOne(a => a.User)
            .WithMany(u => u.RestaurantAccesses)
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserRestaurantAccess>()
            .HasOne(a => a.Restaurant)
            .WithMany(r => r.UserAccesses)
            .HasForeignKey(a => a.RestaurantId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserRestaurantAccess>()
            .HasIndex(a => new { a.UserId, a.RestaurantId })
            .IsUnique();

        modelBuilder.Entity<RestaurantObjectif>()
            .HasIndex(o => new { o.RestaurantId, o.CodeUpc })
            .IsUnique();

        modelBuilder.Entity<JoinRequest>()
            .HasOne(j => j.User).WithMany().HasForeignKey(j => j.UserId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<JoinRequest>()
            .HasOne(j => j.Restaurant).WithMany().HasForeignKey(j => j.RestaurantId).OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<InviteToken>()
            .HasOne(i => i.Restaurant).WithMany().HasForeignKey(i => i.RestaurantId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<InviteToken>()
            .HasIndex(i => i.Token).IsUnique();

        modelBuilder.Entity<CommandeConfig>()
            .HasIndex(c => c.RestaurantId)
            .IsUnique();

        modelBuilder.Entity<CommandeSAQ>()
            .HasMany(c => c.Items)
            .WithOne(i => i.Commande)
            .HasForeignKey(i => i.CommandeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
