#!/bin/bash
set -eu
project_dir=$(cd "$(dirname "$0")/.." && pwd)
version=$(node -p "require('$project_dir/package.json').version")
arch=$(dpkg --print-architecture)
build_dir=$(mktemp -d)
package_root="$build_dir/kpa1500-web_${version}_${arch}"
trap 'rm -rf "$build_dir"' EXIT

install -d "$package_root/DEBIAN" "$package_root/opt/kpa1500-web/src" "$package_root/opt/kpa1500-web/public" "$package_root/opt/kpa1500-web/assets" "$package_root/usr/bin" "$package_root/usr/share/applications" "$package_root/usr/share/icons/hicolor/scalable/apps" "$package_root/lib/systemd/system"
install -m 644 "$project_dir"/src/*.js "$package_root/opt/kpa1500-web/src/"
install -m 644 "$project_dir"/public/* "$package_root/opt/kpa1500-web/public/"
install -m 644 "$project_dir/assets/kpa1500.svg" "$package_root/opt/kpa1500-web/assets/"
install -m 755 "$project_dir/packaging/kpa1500-web-launcher" "$package_root/usr/bin/kpa1500-web"
install -m 644 "$project_dir/packaging/kpa1500-web.desktop" "$package_root/usr/share/applications/kpa1500-web.desktop"
install -m 644 "$project_dir/assets/kpa1500.svg" "$package_root/usr/share/icons/hicolor/scalable/apps/kpa1500-web.svg"
install -m 644 "$project_dir/packaging/kpa1500-web.service" "$package_root/lib/systemd/system/kpa1500-web.service"
install -m 755 "$project_dir/packaging/postinst" "$package_root/DEBIAN/postinst"
install -m 755 "$project_dir/packaging/prerm" "$package_root/DEBIAN/prerm"
install -m 755 "$project_dir/packaging/postrm" "$package_root/DEBIAN/postrm"

installed_size=$(du -sk "$package_root" | cut -f1)
cat >"$package_root/DEBIAN/control" <<EOF
Package: kpa1500-web
Version: $version
Section: hamradio
Priority: optional
Architecture: $arch
Depends: nodejs (>= 20), chromium, curl, openssl, qrencode, adduser
Installed-Size: $installed_size
Maintainer: KPA1500 Web Remote Community
Description: Web-accessible Elecraft KPA1500 remote host
 Graphical Raspberry Pi host for configuring, monitoring, and controlling an
 Elecraft KPA1500 over Ethernet or Host PC USB, with authenticated browser access.
EOF

mkdir -p "$project_dir/dist"
dpkg-deb --root-owner-group --build "$package_root" "$project_dir/dist/kpa1500-web_${version}_${arch}.deb"
