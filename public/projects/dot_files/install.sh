#!/usr/bin/env bash
# yusukensanta/dot_files bootstrap installer
#
# Usage:
#   curl -sSL https://yusukensanta.github.io/projects/dot_files/install.sh | bash
#   curl -sSL https://yusukensanta.github.io/projects/dot_files/install.sh | bash -s -- --yes
#
# What this does:
#   1. Clones (or updates) yusukensanta/dot_files into $DOTFILES_DIR (default: ~/dot_files)
#   2. Runs its scripts/sync_to_win.sh to copy configs into $HOME
#
# What this does NOT do:
#   - Install system packages, Docker, language runtimes, etc.
#     Run scripts/install_libraries.sh and scripts/install_zsh_tools.sh
#     yourself from the cloned repo if you want those.
#
# scripts/sync_to_win.sh uses `rsync -a --delete`, which will overwrite and
# remove files under $HOME that aren't present in the repo (for the specific
# config paths it manages: .config/{nvim,zsh,sheldon,starship.toml}, .zshrc,
# .tmux.conf, and Alacritty/Neovim on Windows if run from WSL). Back up any
# existing configs first if you're unsure.

set -euo pipefail

REPO_URL="${DOTFILES_REPO_URL:-https://github.com/yusukensanta/dot_files.git}"
DOTFILES_DIR="${DOTFILES_DIR:-$HOME/dot_files}"
ASSUME_YES=false

for arg in "$@"; do
    case "$arg" in
        -y|--yes) ASSUME_YES=true ;;
        *) echo "Unknown option: $arg" >&2; exit 1 ;;
    esac
done

require() {
    command -v "$1" >/dev/null 2>&1 || { echo "❌ Required command not found: $1" >&2; exit 1; }
}

require git
require rsync

echo "🔄 dot_files bootstrap"
echo "   Repo:   $REPO_URL"
echo "   Target: $DOTFILES_DIR"
echo ""

if [[ -d "$DOTFILES_DIR/.git" ]]; then
    echo "📦 Existing checkout found, pulling latest..."
    git -C "$DOTFILES_DIR" pull --ff-only
else
    echo "📦 Cloning..."
    git clone "$REPO_URL" "$DOTFILES_DIR"
fi

echo ""
echo "⚠️  This will sync configs into \$HOME using rsync --delete,"
echo "    overwriting/removing files not present in the repo"
echo "    (nvim, zsh, sheldon, starship.toml, .zshrc, .tmux.conf)."

if ! $ASSUME_YES; then
    if [[ -r /dev/tty ]]; then
        read -r -p "Continue? [y/N] " reply < /dev/tty
        case "$reply" in
            [yY]|[yY][eE][sS]) ;;
            *) echo "Aborted. Re-run with --yes to skip this prompt."; exit 0 ;;
        esac
    else
        echo "❌ No TTY to confirm and --yes not passed. Aborting." >&2
        echo "   Re-run with: bash -s -- --yes" >&2
        exit 1
    fi
fi

"$DOTFILES_DIR/scripts/sync_to_win.sh"

echo ""
echo "✅ Configs synced from $DOTFILES_DIR into \$HOME."
echo ""
echo "Optional next steps (run from $DOTFILES_DIR):"
echo "   ./scripts/install_libraries.sh   # apt packages, asdf, Docker, fish"
echo "   ./scripts/install_zsh_tools.sh   # zsh-abbr, starship, sheldon"
