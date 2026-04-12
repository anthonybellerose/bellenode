using BellenodeApi.Models;
using Microsoft.EntityFrameworkCore;

namespace BellenodeApi.Data;

public static class SeedData
{
    public static async Task InitializeAsync(BellenodeDbContext db)
    {
        await db.Database.MigrateAsync();

        if (!await db.Products.AnyAsync())
        {
            db.Products.AddRange(BuildProducts());
        }

        if (!await db.CaisseMappings.AnyAsync())
        {
            db.CaisseMappings.AddRange(BuildMappings());
        }

        await db.SaveChangesAsync();
    }

    private static List<Product> BuildProducts() => new()
    {
        new() { CodeUpc = "4901777035614", Nom = "Midori liqueur de melon - 750ml", CodeSaq = "10757154", Prix = 34.00m },
        new() { CodeUpc = "080686821311", Nom = "Canadian Club Whisky - 1.14L", CodeSaq = "11495424", Prix = 45.00m },
        new() { CodeUpc = "088004400361", Nom = "De Kuyper Peachthree Schnapps - 1.14L", CodeSaq = "268722", Prix = 38.75m },
        new() { CodeUpc = "814789003325", Nom = "Chemineaud - 1.14L", CodeSaq = "3723", Prix = 45.00m },
        new() { CodeUpc = "089540448985", Nom = "Malibu Coconut Rhum - 750ml", CodeSaq = "477836", Prix = 28.75m },
        new() { CodeUpc = "080480007553", Nom = "Bacardi White Rhum - 1.14L", CodeSaq = "15511938", Prix = 40.00m },
        new() { CodeUpc = "048415363396", Nom = "Meaghers Creme De Menthe verte - 750ml", CodeSaq = "196287", Prix = 28.90m },
        new() { CodeUpc = "624177063769", Nom = "Monalisa Amaretto - 1.14L", CodeSaq = "12171940", Prix = 40.75m },
        new() { CodeUpc = "088544016756", Nom = "Southern Comfort - 1.14L", CodeSaq = "11582940", Prix = 40.00m },
        new() { CodeUpc = "620213190208", Nom = "Bombay Sapphire-London Dry - 1.14L", CodeSaq = "11530841", Prix = 49.00m },
        new() { CodeUpc = "835229000506", Nom = "Absolut Vodka - 1.14L", CodeSaq = "11401133", Prix = 47.00m },
        new() { CodeUpc = "5011013100095", Nom = "Baileys Original Irish Cream - 1.14L", CodeSaq = "10666826", Prix = 47.25m },
        new() { CodeUpc = "5000329002353", Nom = "Beefeater London Dry Gin - 1.14L", CodeSaq = "11405679", Prix = 40.25m },
        new() { CodeUpc = "3041311026096", Nom = "Marie Brizard Curacao bleu - 750ml", CodeSaq = "195370", Prix = 23.95m },
        new() { CodeUpc = "048415163088", Nom = "Meagher's Triple Sec - 750ml", CodeSaq = "5215", Prix = 30.00m },
        new() { CodeUpc = "624177100013", Nom = "Melville Stinger Premixxx - 1.14L", CodeSaq = "12211180", Prix = 38.75m },
        new() { CodeUpc = "048415163071", Nom = "Meaghers Apricot Brandy - 750ml", CodeSaq = "196204", Prix = 30.50m },
        new() { CodeUpc = "050037599183", Nom = "Tia Maria Coffee Liqueur - 750ml", CodeSaq = "630913", Prix = 34.00m },
        new() { CodeUpc = "4067700028457", Nom = "Jagermeister - 750ml", CodeSaq = "15092614", Prix = 35.00m },
        new() { CodeUpc = "3035542002004", Nom = "Cointreau Liqueur - 750ml", CodeSaq = "6502", Prix = 46.75m },
        new() { CodeUpc = "3018300014488", Nom = "Grand Marnier - 1.14L", CodeSaq = "10512190", Prix = 76.25m },
        new() { CodeUpc = "088004400163", Nom = "Fireball Cinnamon Whisky - 1.14L", CodeSaq = "12719784", Prix = 37.00m },
        new() { CodeUpc = "3269552642770", Nom = "Gauthier Vs Cognac - 750ml", CodeSaq = "63461", Prix = 57.75m },
        new() { CodeUpc = "085592160158", Nom = "Tequila Rose - 750ml", CodeSaq = "10210651", Prix = 34.75m },
        new() { CodeUpc = "3451740000428", Nom = "PanoramixGin sec - 750ml", CodeSaq = "13916237", Prix = 50.00m },
        new() { CodeUpc = "628055952985", Nom = "Gin Mangue Anas - Artist in Residence - 750ml", CodeSaq = "15198849", Prix = 31.50m },
        new() { CodeUpc = "628308620128", Nom = "AIR, Limonade Framboise Yuzu - 700ml", CodeSaq = "15507007", Prix = 21.65m },
        new() { CodeUpc = "628308620234", Nom = "Gin fruits sauvages - Artist in residence - 700ml", CodeSaq = "15453774", Prix = 34.00m },
        new() { CodeUpc = "627843872610", Nom = "Rosemont Rhum Epice - 750ml", CodeSaq = "14018359", Prix = 41.00m },
        new() { CodeUpc = "8004160681309", Nom = "Liqueur Frangelico - 750ml", CodeSaq = "11098761", Prix = 32.75m },
        new() { CodeUpc = "080915078264", Nom = "Bols Liqueur de Bananes - 750ml", CodeSaq = "41327", Prix = 21.75m },
        new() { CodeUpc = "8006550943233", Nom = "Sambuca Ramazzotti - 750ml", CodeSaq = "323972", Prix = 26.90m },
        new() { CodeUpc = "3380140240854", Nom = "Belle de Brillet Liqueur Poire & Cognac - 700ml", CodeSaq = "10825920", Prix = 54.75m },
        new() { CodeUpc = "087000151109", Nom = "Rhum Epice Captain Morgan - 1.14L", CodeSaq = "11584478", Prix = 48.25m },
        new() { CodeUpc = "776103000277", Nom = "Vodka Smirnoff - 1.14L", CodeSaq = "11584486", Prix = 41.50m },
        new() { CodeUpc = "057496090022", Nom = "Global 40% d'alcool -1.14L", CodeSaq = "14433069", Prix = 36.75m },
        new() { CodeUpc = "088004400354", Nom = "De kuyper Creme De Menthe Blanche - 1.14L", CodeSaq = "255091", Prix = 34.50m },
        new() { CodeUpc = "056049139164", Nom = "Bancs Publics Corbieres - 750ml", CodeSaq = "15408607", Prix = 13.40m },
        new() { CodeUpc = "663935100100", Nom = "Rivage de Sandbanks - 750ml", CodeSaq = "14902646", Prix = 16.95m },
        new() { CodeUpc = "056049028918", Nom = "Cliff 79 Chardonay - 750ml", CodeSaq = "11529591", Prix = 12.65m },
        new() { CodeUpc = "056049021599", Nom = "Cliff 79 Cabarnet - 750ml", CodeSaq = "11133036", Prix = 12.65m },
        new() { CodeUpc = "8001660126750", Nom = "Ruffino Orvieto Classico - 750ml", CodeSaq = "31062", Prix = 14.95m },
        new() { CodeUpc = "8001660109753", Nom = "Ruffino Riserva Ducale Chianti - 750ml", CodeSaq = "45195", Prix = 29.95m },
        new() { CodeUpc = "063657035962", Nom = "Liberado Cabarnet Sauvignon Tempranillo - 750ml", CodeSaq = "13285367", Prix = 14.95m },
        new() { CodeUpc = "056049138624", Nom = "Etienne Marceau Sauvignon Blanc - 750ml", CodeSaq = "15116794", Prix = 13.05m },
        new() { CodeUpc = "620654022946", Nom = "Inniskillin Reserve Shiraz Cabarnet - 750ml", CodeSaq = "15449898", Prix = 32.00m },
        new() { CodeUpc = "056049135029", Nom = "Pereira Lisbonne - 750ml", CodeSaq = "13774945", Prix = 14.80m },
        new() { CodeUpc = "8410388013363", Nom = "Murviedro Passion Monastrell - 750ml", CodeSaq = "15324366", Prix = 15.10m },
        new() { CodeUpc = "8001660197156", Nom = "Ruffino Lumina Pinot Grigio - 750ml", CodeSaq = "12270471", Prix = 15.95m },
        new() { CodeUpc = "056049136941", Nom = "Piola Shiraz Mendoza - 750ml", CodeSaq = "14262984", Prix = 11.15m },
        new() { CodeUpc = "628504255377", Nom = "Noroi Orange - 750ml", CodeSaq = "14422992", Prix = 48.25m },
        new() { CodeUpc = "082000006374", Nom = "Smirnoff Vodka Soda Framboise Rosee - 355ml 4x", CodeSaq = "14398777", Prix = 10.40m },
        new() { CodeUpc = "8001660101757", Nom = "Ruffino Chianti - 750ml", CodeSaq = "1743", Prix = 17.40m },
        new() { CodeUpc = "8410388101473", Nom = "Agarena Murviedro Tempranillo - 750ml", CodeSaq = "620674", Prix = 10.30m },
        new() { CodeUpc = "056049132813", Nom = "Etienne Marceau Cabarnet-Sauvignon-Syrah - 4L", CodeSaq = "13360101", Prix = 50.25m },
        new() { CodeUpc = "774336442734", Nom = "Jouvenceau Blanc Heritage - 4L", CodeSaq = "444273", Prix = 39.25m },
        new() { CodeUpc = "3179077542588", Nom = "Cellier Des Dauphins Prestige Blanc - 250ml", CodeSaq = "496349", Prix = 5.40m },
        new() { CodeUpc = "3179077542564", Nom = "Cellier Des Dauphins Prestige Rouge - 250ml", CodeSaq = "464669", Prix = 5.40m },
        new() { CodeUpc = "8716000966537", Nom = "Galliano Liqueur De Vanille - 500ml", CodeSaq = "508150", Prix = 24.40m },
        new() { CodeUpc = "3104052010158", Nom = "Le Coq D'Or Pineau Des Charentes - 750ml", CodeSaq = "24208", Prix = 24.25m },
        new() { CodeUpc = "080686832034", Nom = "Sauza-Silver - 1.14L", CodeSaq = "11495571", Prix = 52.75m },
        new() { CodeUpc = "721733000029", Nom = "Patron Silver - 750ml", CodeSaq = "10689981", Prix = 86.75m },
        new() { CodeUpc = "811538019569", Nom = "Proper No.Twelve Whiskey - 750ml", CodeSaq = "14128566", Prix = 42.50m },
        new() { CodeUpc = "082000802723", Nom = "Smirnoff ICE - 24 can", CodeSaq = "11927670", Prix = 67.20m },
        new() { CodeUpc = "620213250100", Nom = "Rev - 330ml", CodeSaq = "542977", Prix = 4.05m },
        new() { CodeUpc = "089540535067", Nom = "Kahlua liqueur de cafe - 750ml", CodeSaq = "577957", Prix = 33.00m },
        new() { CodeUpc = "6001108030139", Nom = "Amarula - 1,14l", CodeSaq = "12821771", Prix = 43.00m },
        new() { CodeUpc = "6282501010588", Nom = "Saint-creme - 750ml", CodeSaq = "13917766", Prix = 39.75m },
        new() { CodeUpc = "080432402689", Nom = "Chivas Regal - 1.14L", CodeSaq = "11405652", Prix = 91.25m },
        new() { CodeUpc = "050037014501", Nom = "Disarono - 750ml", CodeSaq = "2253", Prix = 35.25m },
        new() { CodeUpc = "4067700012265", Nom = "Jagermeister Herbal Liqueur - 1.14L", CodeSaq = "11184896", Prix = 52.00m },
        new() { CodeUpc = "00088004400699", Nom = "Dr. McGillicuddy's Caramel Écossais - 750ml", CodeSaq = "12496541", Prix = 21.55m },
    };

    private static List<CaisseMapping> BuildMappings() => new()
    {
        new() { CodeCaisse = "00082000770916", CodeUnite = "776103000277", Quantite = 8 },
        new() { CodeCaisse = "00082000784722", CodeUnite = "087000151109", Quantite = 8 },
        new() { CodeCaisse = "3179077542465", CodeUnite = "3179077542588", Quantite = 4 },
        new() { CodeCaisse = "620213250209", CodeUnite = "620213250100", Quantite = 4 },
        new() { CodeCaisse = "3179077102997", CodeUnite = "3179077542588", Quantite = 24 },
        new() { CodeCaisse = "0110063657035969", CodeUnite = "063657035962", Quantite = 12 },
        new() { CodeCaisse = "03179077102997", CodeUnite = "3179077542588", Quantite = 24 },
        new() { CodeCaisse = "0110056049138621", CodeUnite = "056049138624", Quantite = 12 },
        new() { CodeCaisse = "0110056049139161", CodeUnite = "056049139164", Quantite = 12 },
        new() { CodeCaisse = "03179077102980", CodeUnite = "3179077542564", Quantite = 24 },
        new() { CodeCaisse = "18001660101754", CodeUnite = "8001660101757", Quantite = 12 },
        new() { CodeCaisse = "13390140240851", CodeUnite = "3380140240854", Quantite = 12 },
        new() { CodeCaisse = "10620213250107", CodeUnite = "620213250100", Quantite = 24 },
        new() { CodeCaisse = "0110056049028915", CodeUnite = "056049028918", Quantite = 12 },
        new() { CodeCaisse = "18001660197153", CodeUnite = "8001660197156", Quantite = 12 },
        new() { CodeCaisse = "0110056049136948", CodeUnite = "056049136941", Quantite = 12 },
        new() { CodeCaisse = "0110056049021596", CodeUnite = "056049021599", Quantite = 12 },
    };
}
