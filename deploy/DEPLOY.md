# Droplet Deployment

This app now runs as a plain Node server with local Playwright extraction and disk-based playlist output.

## 1. Server packages

```sh
sudo apt update
sudo apt install -y nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
cd /srv
sudo mkdir -p mews /var/www/mews/playlists
sudo chown -R "$USER":"$USER" /srv/mews
sudo chown -R www-data:www-data /var/www/mews
```

## 2. Application install

```sh
cd /srv
git clone <your-repo-url> mews
cd mews
npm install
npx playwright install --with-deps chromium
cp .env.example .env
```

Edit `.env`:

```env
PORT=3000
PLAYLIST_OUTPUT_DIR=/var/www/mews/playlists
```

## 3. Systemd service

```sh
sudo cp deploy/mews.service /etc/systemd/system/mews.service
sudo systemctl daemon-reload
sudo systemctl enable mews
sudo systemctl start mews
sudo systemctl status mews
```

If your repo path or runtime user differs, adjust `WorkingDirectory`, `EnvironmentFile`, `ExecStart`, `User`, and `Group` in `deploy/mews.service` first.

## 4. Nginx

```sh
sudo cp deploy/nginx.conf /etc/nginx/sites-available/mews
sudo ln -sf /etc/nginx/sites-available/mews /etc/nginx/sites-enabled/mews
sudo nginx -t
sudo systemctl reload nginx
```

If another default site is present, remove or disable it:

```sh
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl reload nginx
```

## 5. Verify

```sh
curl http://127.0.0.1:3000/
curl -X POST http://127.0.0.1:3000/api/build \
	-H 'Content-Type: application/json' \
	-d '{"playlist_url":"https://open.spotify.com/playlist/..."}'
```

Service logs:

```sh
journalctl -u mews -f
```
