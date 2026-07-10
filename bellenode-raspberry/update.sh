#!/bin/bash
# Mise à jour de Bellenode Scanner depuis GitHub
# Usage : bash update.sh
# Peut être lancé à distance via SSH depuis le serveur Anthony

set -euo pipefail

# Dossier d'install déduit de l'emplacement du script lui-même — évite de
# supposer un nom d'utilisateur (Bookworm n'a plus d'utilisateur "pi" par défaut).
INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_URL="https://github.com/anthonybellerose/bellenode.git"
TMP_DIR="/tmp/bellenode-update"

echo "=== Bellenode Scanner — Mise à jour ==="

# Télécharger la dernière version
echo "► Téléchargement depuis GitHub..."
rm -rf "$TMP_DIR"
git clone --depth=1 "$REPO_URL" "$TMP_DIR" 2>/dev/null || {
    echo "❌ Impossible de joindre GitHub. Vérifie la connexion internet."
    exit 1
}

# Vérifier que le dossier raspberry existe dans le repo
if [[ ! -d "$TMP_DIR/bellenode-raspberry" ]]; then
    echo "❌ Dossier bellenode-raspberry introuvable dans le repo."
    exit 1
fi

# Arrêt du service
echo "► Arrêt du scanner..."
sudo systemctl stop bellenode-scanner 2>/dev/null || true

# Sauvegarde du config.ini (on ne l'écrase jamais)
cp "$INSTALL_DIR/config/config.ini" "/tmp/config.ini.bak"

# Mise à jour des fichiers Python (pas config/, pas data/, pas logs/)
echo "► Mise à jour des fichiers..."
cp "$TMP_DIR/bellenode-raspberry/"*.py  "$INSTALL_DIR/"
cp "$TMP_DIR/bellenode-raspberry/"*.sh  "$INSTALL_DIR/"
cp "$TMP_DIR/bellenode-raspberry/bellenode-scanner.service" "$INSTALL_DIR/"

# Restaurer le config.ini
cp "/tmp/config.ini.bak" "$INSTALL_DIR/config/config.ini"

# Permissions
chmod +x "$INSTALL_DIR/main.py" "$INSTALL_DIR/update.sh" "$INSTALL_DIR/install.sh"

# Mise à jour du service systemd si changé — substituer les gabarits __USER__/
# __INSTALL_DIR__ comme le fait install.sh (le fichier du repo est un template brut,
# le copier tel quel produit un service invalide : "bad unit file setting")
sed -e "s|__USER__|$(whoami)|g" -e "s|__INSTALL_DIR__|$INSTALL_DIR|g" \
    "$INSTALL_DIR/bellenode-scanner.service" | sudo tee /etc/systemd/system/bellenode-scanner.service > /dev/null
sudo systemctl daemon-reload

# Redémarrage
echo "► Redémarrage du scanner..."
sudo systemctl start bellenode-scanner

# Nettoyage
rm -rf "$TMP_DIR"

echo ""
echo "✅ Mise à jour terminée."
echo ""
echo "► Logs en direct :"
echo "   tail -f $INSTALL_DIR/logs/bellenode.log"
