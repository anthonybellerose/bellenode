using BellenodeApi.Models;
using Microsoft.EntityFrameworkCore;

namespace BellenodeApi.Data;

public class BellenodeDbContext : DbContext
{
    public BellenodeDbContext(DbContextOptions<BellenodeDbContext> options) : base(options) { }

    public DbSet<Product> Products => Set<Product>();
    public DbSet<CaisseMapping> CaisseMappings => Set<CaisseMapping>();
    public DbSet<InventoryItem> Inventory => Set<InventoryItem>();
    public DbSet<ScanBatch> ScanBatches => Set<ScanBatch>();
    public DbSet<ScanOperation> ScanOperations => Set<ScanOperation>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Product>()
            .HasIndex(p => p.CodeUpc)
            .IsUnique();

        modelBuilder.Entity<CaisseMapping>()
            .HasIndex(c => c.CodeCaisse)
            .IsUnique();

        modelBuilder.Entity<InventoryItem>()
            .HasIndex(i => i.Code)
            .IsUnique();

        modelBuilder.Entity<Product>()
            .Property(p => p.Prix)
            .HasColumnType("decimal(10,2)");

        modelBuilder.Entity<ScanOperation>()
            .HasOne(o => o.ScanBatch)
            .WithMany(b => b.Operations)
            .HasForeignKey(o => o.ScanBatchId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
