#!/bin/sh
set -e

cd /var/www/html

echo "== Waiting for WordPress DB to accept a connection =="
# Probe with a raw PHP/mysqli check instead of `wp db check`: wp-cli runs the
# mysql client with --no-defaults, and this image's bundled MariaDB client then
# rejects the MySQL 8.0 self-signed cert (ERROR 2026). PHP mysqli handles it
# fine — and it is what every wp-cli command below uses anyway. Also works
# before `wp core install` (wp eval refuses to run on an uninstalled site).
until php -r '$m = @new mysqli(getenv("WORDPRESS_DB_HOST"), getenv("WORDPRESS_DB_USER"), getenv("WORDPRESS_DB_PASSWORD"), getenv("WORDPRESS_DB_NAME")); exit($m->connect_errno ? 1 : 0);' 2>/dev/null; do
  echo "  db not ready yet, retrying..."
  sleep 3
done

echo "== Installing WordPress core (if not already installed) =="
if ! wp core is-installed --path=/var/www/html 2>/dev/null; then
  wp core install \
    --path=/var/www/html \
    --url="http://localhost:8888" \
    --title="CircuitCart Store" \
    --admin_user=admin \
    --admin_password=admin123 \
    --admin_email=admin@example.com \
    --skip-email
else
  echo "  already installed, skipping"
fi

echo "== Installing & activating Storefront theme =="
wp theme install storefront --activate --path=/var/www/html

echo "== Installing & activating WooCommerce =="
wp plugin install woocommerce --activate --path=/var/www/html

echo "== Basic WooCommerce onboarding (currency, base location) =="
wp option update woocommerce_currency "USD" --path=/var/www/html
wp option update woocommerce_default_country "US:CA" --path=/var/www/html
wp option update woocommerce_store_address "123 Main St" --path=/var/www/html
wp option update woocommerce_store_city "San Francisco" --path=/var/www/html
wp option update woocommerce_onboarding_profile '{"skipped":true}' --format=json --path=/var/www/html

echo "== Installing WordPress Importer (needed to import demo product XML) =="
wp plugin install wordpress-importer --activate --path=/var/www/html

echo "== Importing WooCommerce demo products =="
if [ -f wp-content/plugins/woocommerce/sample-data/sample_products.xml ]; then
  wp import wp-content/plugins/woocommerce/sample-data/sample_products.xml \
    --authors=create --path=/var/www/html
else
  echo "  sample_products.xml not found in this WooCommerce version, skipping"
fi

echo "== Creating the default WooCommerce pages (Shop, Cart, Checkout, My Account) =="
wp option get woocommerce_shop_page_id --path=/var/www/html >/dev/null 2>&1 || \
  wp wc tool run install_pages --user=admin --path=/var/www/html 2>/dev/null || true

echo "== Setting the storefront home page to show the Shop =="
SHOP_ID=$(wp option get woocommerce_shop_page_id --path=/var/www/html 2>/dev/null || echo "")
if [ -n "$SHOP_ID" ]; then
  wp option update show_on_front "page" --path=/var/www/html
  wp option update page_on_front "$SHOP_ID" --path=/var/www/html
fi

echo "== Launching the store (disable WooCommerce 'Coming Soon' mode) =="
# WooCommerce 9.x puts fresh stores behind a 'Coming Soon' page by default once
# onboarding is skipped — anonymous visitors see that placeholder instead of the
# shop. Force it off so the storefront is live immediately after provisioning.
wp option update woocommerce_coming_soon no --path=/var/www/html

echo "== Flushing rewrite rules =="
wp rewrite structure '/%postname%/' --path=/var/www/html
wp rewrite flush --path=/var/www/html

echo "== Planting the leftover migration backup for the pivot chain =="
mkdir -p wp-content/uploads/2025/migration-backup
cp /oldsite_backup.sql wp-content/uploads/2025/migration-backup/oldsite_backup.sql
chmod 644 wp-content/uploads/2025/migration-backup/oldsite_backup.sql
# Deliberately NON-browseable: the player must discover the .sql by shell
# enumeration (find / -name '*.sql') from the www-data foothold, not by
# browsing wp-content/uploads/. Apache honors .htaccess here (the official WP
# image sets AllowOverride All for /var/www/html), so Options -Indexes forces a
# 403 on directory listing and the file is reachable only by exact path.
printf 'Options -Indexes\n' > wp-content/uploads/2025/migration-backup/.htaccess
chmod 644 wp-content/uploads/2025/migration-backup/.htaccess

echo 'define('WP_HOME', 'http://' .$_SERVER['HTTP_HOST']);' >> wp-config.php
echo 'define('WP_SITEURL', 'http://' . $_SERVER['HTTP_HOST']);' >> wp-config.php


echo "== DONE =="
echo "Store URL:   http://localhost:8888/"
echo "Admin URL:   http://localhost:8888/wp-admin/"
echo "Admin user:  admin"
echo "Admin pass:  admin123"
