#!/bin/sh

# Create directories if not exist
mkdir -p /app/data/icons /app/data/ssh_keys /app/data/ssl

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
