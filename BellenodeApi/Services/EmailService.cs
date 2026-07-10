using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace BellenodeApi.Services;

public record EmailAttachment(string Filename, string ContentType, byte[] Content);

public class EmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<EmailService> _log;
    private readonly IHttpClientFactory _httpFactory;

    public EmailService(IConfiguration config, ILogger<EmailService> log, IHttpClientFactory httpFactory)
    {
        _config = config;
        _log = log;
        _httpFactory = httpFactory;
    }

    public Task SendAsync(string toEmail, string toName, string subject, string htmlBody)
        => SendAsync(toEmail, toName, subject, htmlBody, null);

    public async Task SendAsync(string toEmail, string toName, string subject, string htmlBody, EmailAttachment? attachment)
    {
        var apiKey    = _config["Resend:ApiKey"];
        var fromEmail = _config["Resend:FromEmail"] ?? "noreply@bellenode.com";
        var fromName  = _config["Resend:FromName"]  ?? "Bellenode";

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _log.LogWarning("Resend API key non configurée, email pour {to} non envoyé", toEmail);
            return;
        }

        object payload;
        if (attachment is not null)
        {
            payload = new
            {
                from        = $"{fromName} <{fromEmail}>",
                to          = new[] { toEmail },
                subject,
                html        = htmlBody,
                attachments = new[]
                {
                    new
                    {
                        filename = attachment.Filename,
                        content  = Convert.ToBase64String(attachment.Content),
                    }
                }
            };
        }
        else
        {
            payload = new
            {
                from    = $"{fromName} <{fromEmail}>",
                to      = new[] { toEmail },
                subject,
                html    = htmlBody,
            };
        }

        var json = JsonSerializer.Serialize(payload);

        try
        {
            var client = _httpFactory.CreateClient("resend");
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            var response = await client.PostAsync(
                "https://api.resend.com/emails",
                new StringContent(json, Encoding.UTF8, "application/json")
            );

            if (response.IsSuccessStatusCode)
                _log.LogInformation("Email Resend envoyé à {to}", toEmail);
            else
            {
                var body = await response.Content.ReadAsStringAsync();
                _log.LogError("Resend erreur {status}: {body}", response.StatusCode, body);
            }
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Erreur envoi Resend à {to}", toEmail);
        }
    }
}
