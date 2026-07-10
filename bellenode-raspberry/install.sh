#!/bin/bash
# Installation de Bellenode Scanner sur Raspberry Pi
# Usage : sudo bash install.sh

set -euo pipefail

# Utilisateur réel (celui qui a lancé "sudo bash install.sh"), pas root.
# Bookworm ne crée plus d'utilisateur "pi" par défaut, donc on ne peut pas
# le supposer — on prend l'utilisateur choisi à l'imaging.
REAL_USER="${SUDO_USER:-$(whoami)}"
INSTALL_DIR="/home/$REAL_USER/bellenode-raspberry"
SERVICE_FILE="bellenode-scanner.service"

echo "=== Bellenode Scanner — Installation ==="
echo "► Utilisateur détecté : $REAL_USER"

# ── Dépendances système ───────────────────────────────────────────────────────
echo "► Installation des dépendances..."
apt-get update -qq
apt-get install -y python3 python3-pip python3-tk python3-evdev openssh-server

# Dépendances Python
pip3 install requests evdev Pillow --break-system-packages 2>/dev/null || pip3 install requests evdev Pillow

# ── Dossiers ──────────────────────────────────────────────────────────────────
echo "► Création des dossiers..."
mkdir -p "$INSTALL_DIR"/{config,data,logs,sounds}

# ── Copie des fichiers ────────────────────────────────────────────────────────
echo "► Copie des fichiers..."
cp -r ./* "$INSTALL_DIR/"

# config.ini n'est jamais versionné (contient le mot de passe Bellenode) — on part
# du gabarit s'il n'existe pas déjà (ex: mise à jour d'une install existante).
if [[ ! -f "$INSTALL_DIR/config/config.ini" && -f "$INSTALL_DIR/config/config.ini.example" ]]; then
    cp "$INSTALL_DIR/config/config.ini.example" "$INSTALL_DIR/config/config.ini"
fi

chown -R "$REAL_USER:$REAL_USER" "$INSTALL_DIR"
chmod +x "$INSTALL_DIR/main.py" "$INSTALL_DIR/update.sh"

# ── Permissions evdev (scanner HID sans root) ─────────────────────────────────
echo "► Configuration permissions scanner..."
usermod -aG input "$REAL_USER"
echo 'SUBSYSTEM=="input", GROUP="input", MODE="0660"' > /etc/udev/rules.d/99-bellenode-scanner.rules
udevadm control --reload-rules

# ── SSH ───────────────────────────────────────────────────────────────────────
echo "► Activation SSH..."
systemctl enable ssh
systemctl start ssh

# ── Tailscale ─────────────────────────────────────────────────────────────────
echo "► Installation de Tailscale..."
curl -fsSL https://tailscale.com/install.sh | sh

echo ""
echo "  ⚠  Tailscale installé mais PAS encore connecté."
echo "     Après l'installation, lance cette commande :"
echo "     sudo tailscale up"
echo "     Puis approuve le Pi sur : https://login.tailscale.com/admin"
echo ""

# ── Service systemd ───────────────────────────────────────────────────────────
echo "► Installation du service systemd..."
sed -e "s|__USER__|$REAL_USER|g" -e "s|__INSTALL_DIR__|$INSTALL_DIR|g" \
    "$INSTALL_DIR/$SERVICE_FILE" > /etc/systemd/system/$SERVICE_FILE
systemctl daemon-reload
systemctl enable bellenode-scanner.service

# ── Résumé ────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║         ✅  Installation terminée                    ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "ÉTAPES SUIVANTES :"
echo ""
echo "  1. Connecte Tailscale au réseau :"
echo "       sudo tailscale up"
echo "     → Approuve le Pi sur https://login.tailscale.com/admin"
echo "     → Note l'IP Tailscale du Pi (ex: 100.x.x.x)"
echo ""
echo "  2. Configure Bellenode :"
echo "       nano $INSTALL_DIR/config/config.ini"
echo "     → api.email          courriel Bellenode"
echo "     → api.password       mot de passe Bellenode"
echo "     → api.restaurant_id  ID du restaurant"
echo ""
echo "  3. Démarre le scanner :"
echo "       sudo systemctl start bellenode-scanner"
echo ""
echo "  4. Depuis n'importe où (via Tailscale) :"
echo "       ssh $REAL_USER@<IP-Tailscale-du-Pi>"
echo "       tail -f $INSTALL_DIR/logs/bellenode.log"
echo "       bash $INSTALL_DIR/update.sh"
echo ""
