using System.Net;
using System.Net.Mail;

namespace BellenodeApi.Services;

public class EmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<EmailService> _log;
    private static readonly string FallbackLogPath = "/home/serveur02/bellenode_reset_links.log";

    public EmailService(IConfiguration config, ILogger<EmailService> log)
    {
        _config = config;
        _log = log;
    }

    public async Task SendAsync(string toEmail, string toName, string subject, string body)
    {
        var host     = _config["Smtp:Host"];
        var portStr  = _config["Smtp:Port"];
        var user     = _config["Smtp:User"];
        var password = _config["Smtp:Password"];
        var fromEmail = _config["Smtp:FromEmail"] ?? user;
        var fromName  = _config["Smtp:FromName"] ?? "Bellenode";

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(password))
        {
            // SMTP pas configuré — on log le message dans un fichier pour récup manuelle
            _log.LogWarning("SMTP non configuré — email pour {to} écrit dans {path}", toEmail, FallbackLogPath);
            await WriteFallbackAsync(toEmail, subject, body);
            return;
        }

        var port = int.TryParse(portStr, out var p) ? p : 587;

        try
        {
            using var msg = new MailMessage();
            msg.From = new MailAddress(fromEmail!, fromName);
            msg.To.Add(new MailAddress(toEmail, toName));
            msg.Subject = subject;
            msg.Body = body;
            msg.IsBodyHtml = true;

            using var client = new SmtpClient(host, port)
            {
                EnableSsl = true,
                Credentials = new NetworkCredential(user, password)
            };

            await client.SendMailAsync(msg);
            _log.LogInformation("Email envoyé à {to}", toEmail);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Erreur envoi email à {to} — fallback fichier", toEmail);
            await WriteFallbackAsync(toEmail, subject, body);
        }
    }

    private static async Task WriteFallbackAsync(string to, string subject, string body)
    {
        try
        {
            var line = $"\n===== {DateTime.Now:yyyy-MM-dd HH:mm:ss} =====\nTO: {to}\nSUBJECT: {subject}\n\n{body}\n";
            await File.AppendAllTextAsync(FallbackLogPath, line);
        }
        catch { /* ignore — sous SmarterASP on peut pas écrire dehors */ }
    }
}
