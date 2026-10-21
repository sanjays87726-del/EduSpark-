# Har location me include hota hai (nginx me add_header parent se inherit nahi hota jab child me add_header ho)
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-Frame-Options "SAMEORIGIN" always;          # app apne legal pages iframe me kholta hai (same origin)
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
# HSTS TLS terminate karne wale proxy/CDN par lagao. CSP abhi nahi: app me inline script/onclick bahut hain (nonce refactor ke baad).
