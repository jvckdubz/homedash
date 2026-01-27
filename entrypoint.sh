#!/bin/sh

# Create directories if not exist
mkdir -p /app/data/icons /app/data/ssh_keys /app/data/ssl /app/data/pwa

# Generate PWA icons if not exist or if favicon.svg is newer
REGEN_ICONS=false
if [ ! -f /app/data/pwa/apple-touch-icon.png ]; then
    REGEN_ICONS=true
    echo "[PWA] Icons not found, will generate"
elif [ /app/public/favicon.svg -nt /app/data/pwa/apple-touch-icon.png ]; then
    REGEN_ICONS=true
    echo "[PWA] favicon.svg updated, will regenerate icons"
fi

if [ "$REGEN_ICONS" = true ]; then
    echo "[PWA] Generating app icons to /app/data/pwa/..."
    
    if command -v magick > /dev/null 2>&1; then
        # ImageMagick 7 - 8-bit PNG with solid background (required for iOS)
        magick /app/public/favicon.svg -background "#0d0d0f" -flatten -depth 8 -resize 180x180 /app/data/pwa/apple-touch-icon.png 2>/dev/null
        magick /app/public/favicon.svg -background "#0d0d0f" -flatten -depth 8 -resize 152x152 /app/data/pwa/apple-touch-icon-152.png 2>/dev/null
        magick /app/public/favicon.svg -background "#0d0d0f" -flatten -depth 8 -resize 120x120 /app/data/pwa/apple-touch-icon-120.png 2>/dev/null
        magick /app/public/favicon.svg -background "#0d0d0f" -flatten -depth 8 -resize 192x192 /app/data/pwa/icon-192.png 2>/dev/null
        magick /app/public/favicon.svg -background "#0d0d0f" -flatten -depth 8 -resize 512x512 /app/data/pwa/icon-512.png 2>/dev/null
        echo "[PWA] Icons generated with ImageMagick 7 (8-bit sRGB)"
    elif command -v convert > /dev/null 2>&1; then
        # ImageMagick 6
        convert /app/public/favicon.svg -background "#0d0d0f" -flatten -depth 8 -resize 180x180 /app/data/pwa/apple-touch-icon.png 2>/dev/null
        convert /app/public/favicon.svg -background "#0d0d0f" -flatten -depth 8 -resize 152x152 /app/data/pwa/apple-touch-icon-152.png 2>/dev/null
        convert /app/public/favicon.svg -background "#0d0d0f" -flatten -depth 8 -resize 120x120 /app/data/pwa/apple-touch-icon-120.png 2>/dev/null
        convert /app/public/favicon.svg -background "#0d0d0f" -flatten -depth 8 -resize 192x192 /app/data/pwa/icon-192.png 2>/dev/null
        convert /app/public/favicon.svg -background "#0d0d0f" -flatten -depth 8 -resize 512x512 /app/data/pwa/icon-512.png 2>/dev/null
        echo "[PWA] Icons generated with ImageMagick 6 (8-bit sRGB)"
    else
        echo "[PWA] WARNING: ImageMagick not found, PWA icons not generated"
    fi
    
    # Verify
    if [ -f /app/data/pwa/apple-touch-icon.png ]; then
        ls -la /app/data/pwa/
    fi
else
    echo "[PWA] Icons already exist in /app/data/pwa/"
fi

# Generate SSL certificate if not exists
if [ ! -f /app/data/ssl/server.key ] || [ ! -f /app/data/ssl/server.crt ]; then
    echo "[SSL] Generating self-signed certificate..."
    
    # Get container IP
    CONTAINER_IP=$(hostname -i 2>/dev/null | awk '{print $1}')
    
    # Create config for certificate with extended SAN
    cat > /tmp/ssl.conf << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
CN = HomeDash
O = HomeDash
C = US

[v3_req]
basicConstraints = CA:TRUE
keyUsage = digitalSignature, keyEncipherment, keyCertSign
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = homedash.local
DNS.3 = homedash
DNS.4 = *.local
IP.1 = 127.0.0.1
IP.2 = ${CONTAINER_IP:-172.17.0.2}
EOF

    # Add common private network ranges
    echo "IP.3 = 192.168.1.1" >> /tmp/ssl.conf
    echo "IP.4 = 192.168.2.1" >> /tmp/ssl.conf
    echo "IP.5 = 192.168.0.1" >> /tmp/ssl.conf
    echo "IP.6 = 10.0.0.1" >> /tmp/ssl.conf
    
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout /app/data/ssl/server.key \
        -out /app/data/ssl/server.crt \
        -config /tmp/ssl.conf \
        2>/dev/null
    
    rm -f /tmp/ssl.conf
    
    if [ $? -eq 0 ]; then
        echo "[SSL] Certificate generated successfully (valid for 10 years)"
        echo "[SSL] Certificate saved to /app/data/ssl/"
        echo "[SSL] Download from https://your-ip:3443/api/ssl/certificate"
    else
        echo "[SSL] Failed to generate certificate"
    fi
else
    echo "[SSL] Using existing certificate from /app/data/ssl/"
    # Show certificate expiry
    if command -v openssl > /dev/null; then
        EXPIRY=$(openssl x509 -enddate -noout -in /app/data/ssl/server.crt 2>/dev/null | cut -d= -f2)
        echo "[SSL] Certificate expires: $EXPIRY"
    fi
fi

# Execute CMD
exec "$@"
