using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BellenodeApi.Models;

public enum ScanMode
{
    Add,
    Remove,
    Set
}

public class ScanOperation
{
    public int Id { get; set; }

    public int ScanBatchId { get; set; }

    [ForeignKey(nameof(ScanBatchId))]
    public ScanBatch? ScanBatch { get; set; }

    public ScanMode Mode { get; set; }

    [Required, MaxLength(32)]
    public string Code { get; set; } = "";

    public int Quantite { get; set; } = 1;

    public bool IsReferenced { get; set; }

    public int QtyAvant { get; set; }
    public int QtyApres { get; set; }
}
