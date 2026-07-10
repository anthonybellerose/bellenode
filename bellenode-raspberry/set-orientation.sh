#!/bin/bash
# Ajuste l'orientation de l'écran du Raspberry Pi (écran officiel 7" Touch Display 2 ou HDMI).
# Usage : sudo ./set-orientation.sh [normal|right|inverted|left]
#   normal   = 0°   (défaut)
#   right    = 90°  (rotation horaire)
#   inverted = 180°
#   left     = 270° (rotation anti-horaire)
#
# Utilise raspi-config, qui gère aussi la rotation du tactile pour l'écran
# officiel (nécessaire sinon le doigt et l'affichage ne correspondent plus).
# Redémarrage requis pour appliquer le changement.

set -e

if [ "$EUID" -ne 0 ]; then
  echo "Ce script doit être lancé avec sudo : sudo $0 $*" >&2
  exit 1
fi

ORIENTATION="${1:-normal}"

case "$ORIENTATION" in
  normal)   VALUE=0 ;;
  right)    VALUE=1 ;;
  inverted) VALUE=2 ;;
  left)     VALUE=3 ;;
  *)
    echo "Orientation invalide : $ORIENTATION" >&2
    echo "Usage : sudo $0 [normal|right|inverted|left]" >&2
    exit 1
    ;;
esac

if command -v raspi-config >/dev/null 2>&1; then
  raspi-config nonint do_display_rotate "$VALUE"
  echo "Orientation réglée sur '$ORIENTATION' (valeur $VALUE) via raspi-config."
else
  # Repli si raspi-config est absent : édite directement config.txt.
  # Note : ce repli ne gère PAS la rotation du tactile, seulement l'affichage.
  if [ -f /boot/firmware/config.txt ]; then
    CONFIG_TXT=/boot/firmware/config.txt
  else
    CONFIG_TXT=/boot/config.txt
  fi

  sed -i '/^display_lcd_rotate=/d; /^display_hdmi_rotate=/d' "$CONFIG_TXT"
  {
    echo "display_lcd_rotate=$VALUE"
    echo "display_hdmi_rotate=$VALUE"
  } >> "$CONFIG_TXT"
  echo "Orientation réglée sur '$ORIENTATION' (valeur $VALUE) dans $CONFIG_TXT."
  echo "⚠ raspi-config introuvable : la rotation du tactile n'est pas ajustée automatiquement."
fi

echo "Redémarrage requis : sudo reboot"
