namespace BellenodeApi.Services;

/// Tolère un écart d'un zéro (souvent en tête) entre un code scanné/recherché et celui
/// enregistré — fréquent avec les codes affichés sur SAQ.com (padding EAN-13 vs UPC-A
/// physique sur la bouteille). Retourne les variantes à essayer EN PLUS du code exact.
public static class BarcodeTolerance
{
    public static IEnumerable<string> ZeroVariants(string code)
    {
        yield return "0" + code;
        if (code.Length > 1 && code[0] == '0')
            yield return code[1..];
    }
}
