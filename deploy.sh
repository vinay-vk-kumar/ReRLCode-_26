#!/bin/bash
# ============================================================
# SmartCI — EC2 Deployment Script
# Run once on a fresh Ubuntu 22.04 t2.micro/t2.small instance
# Usage: bash deploy.sh
# ============================================================
set -e

DOMAIN="your-domain.com"          # <-- CHANGE THIS
APP_DIR="/home/ubuntu/smartci"

echo "=============================="
echo " SmartCI Deployment Starting  "
echo "=============================="

# ── 1. System dependencies ─────────────────────────────────────────────────
echo "[1/9] Installing system packages..."
sudo apt-get update -y
sudo apt-get install -y git curl nginx python3 python3-pip python3-venv \
  nodejs npm certbot python3-certbot-nginx

# Node.js 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2
sudo npm install -g pm2

echo "✅ System packages installed"

# ── 2. Clone / pull repo ──────────────────────────────────────────────────
echo "[2/9] Pulling latest code..."
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR" && git pull
else
  git clone https://github.com/yourusername/smartci.git "$APP_DIR"
fi
cd "$APP_DIR"

# ── 3. RL Engine (Python FastAPI) ─────────────────────────────────────────
echo "[3/9] Setting up RL Engine..."
cd "$APP_DIR/rl-engine"
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
mkdir -p models logs

# Copy env
[ ! -f .env ] && cp .env.example .env && echo "⚠️  Edit rl-engine/.env with your MONGO_URI"

# Start with PM2
pm2 delete smartci-rl 2>/dev/null || true
pm2 start "source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000" \
  --name smartci-rl --interpreter bash --cwd "$APP_DIR/rl-engine"

echo "✅ RL Engine running on port 8000"

# ── 4. Node.js Backend ────────────────────────────────────────────────────
echo "[4/9] Setting up Node.js backend..."
cd "$APP_DIR/backend"
npm ci --omit=dev
[ ! -f .env ] && cp .env.example .env && echo "⚠️  Edit backend/.env with your MONGO_URI"

pm2 delete smartci-backend 2>/dev/null || true
pm2 start src/index.js --name smartci-backend --cwd "$APP_DIR/backend"

echo "✅ Backend running on port 4000"

# ── 5. Next.js Frontend ───────────────────────────────────────────────────
echo "[5/9] Setting up Next.js frontend..."
cd "$APP_DIR/frontend"
npm ci
[ ! -f .env.local ] && cp .env.local.example .env.local && \
  echo "⚠️  Edit frontend/.env.local with your API URL"

npm run build

pm2 delete smartci-frontend 2>/dev/null || true
pm2 start "npm start" --name smartci-frontend --cwd "$APP_DIR/frontend"

echo "✅ Frontend running on port 3000"

# ── 6. Nginx config ───────────────────────────────────────────────────────
echo "[6/9] Configuring Nginx..."
sudo cp "$APP_DIR/nginx.conf" /etc/nginx/sites-available/smartci
sudo sed -i "s/YOUR_DOMAIN/$DOMAIN/g" /etc/nginx/sites-available/smartci
sudo ln -sf /etc/nginx/sites-available/smartci /etc/nginx/sites-enabled/smartci
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo "✅ Nginx configured"

# ── 7. SSL via Certbot ────────────────────────────────────────────────────
echo "[7/9] Obtaining SSL certificate..."
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN" || \
  echo "⚠️  SSL setup failed — run certbot manually"

# ── 8. PM2 startup ────────────────────────────────────────────────────────
echo "[8/9] Configuring PM2 startup..."
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

# ── 9. Initial training run ───────────────────────────────────────────────
echo "[9/9] Running initial RL training (200 episodes)..."
cd "$APP_DIR/rl-engine"
source venv/bin/activate
python train.py --episodes 200 --agent dqn
deactivate

echo ""
echo "============================================"
echo " ✅ SmartCI deployed successfully!"
echo " 🌐 Visit: https://$DOMAIN"
echo " 📊 API:   https://$DOMAIN/api"
echo " 🤖 RL:    http://localhost:8000/docs"
echo " 📋 PM2:   pm2 status"
echo "============================================"
