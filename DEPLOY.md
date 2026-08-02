# Deploy lên Hostinger VPS

Ứng dụng là Next.js (Node.js) chạy bằng `next start`, đứng sau Nginx reverse proxy,
được PM2 quản lý process và tự khởi động lại khi VPS reboot. GitHub Actions tự
động deploy mỗi khi push lên nhánh `main`.

## 1. Chuẩn bị VPS lần đầu (SSH vào VPS Hostinger)

```bash
# Cài Node.js 20 LTS (bắt buộc >=20.9 cho Next.js 16)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs git nginx

# Cài PM2 (quản lý process, tự restart khi crash/reboot)
sudo npm install -g pm2

# Clone repo (thay <github-user>/ghe-1a bằng repo thật)
sudo mkdir -p /var/www/ghe-1a
sudo chown $USER:$USER /var/www/ghe-1a
git clone git@github.com:<github-user>/ghe-1a.git /var/www/ghe-1a
cd /var/www/ghe-1a

# Tạo file môi trường thật trên server (KHÔNG commit file này)
cp .env.example .env.local
nano .env.local   # điền CONTENTFUL_SPACE_ID, CONTENTFUL_ACCESS_TOKEN, KIT_API_KEY, KIT_FORM_ID, NEXT_PUBLIC_SITE_URL

npm ci
npm run build

# Khởi động qua PM2 và lưu lại để tự chạy sau khi reboot VPS
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # chạy lệnh mà PM2 in ra để đăng ký systemd service
```

## 2. Cấu hình Nginx reverse proxy

Tạo `/etc/nginx/sites-available/ghe-1a`:

```nginx
server {
    listen 80;
    server_name ghe1a.com www.ghe1a.com;  # hoặc subdomain tạm thời của Hostinger

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/ghe-1a /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# HTTPS miễn phí (sau khi đã trỏ domain thật về VPS)
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ghe1a.com -d www.ghe1a.com
```

## 3. CI/CD tự động qua GitHub Actions

Workflow đã có sẵn ở [.github/workflows/deploy.yml](.github/workflows/deploy.yml):
mỗi lần push lên `main`, GitHub SSH vào VPS, `git pull`, `npm ci`, `npm run build`,
rồi `pm2 reload` — không downtime.

Vào **GitHub repo → Settings → Secrets and variables → Actions** và thêm:

| Secret          | Giá trị                                            |
|------------------|----------------------------------------------------|
| `VPS_HOST`       | IP hoặc hostname của VPS Hostinger                  |
| `VPS_USERNAME`   | user SSH (vd: `root` hoặc user bạn tạo)             |
| `VPS_SSH_KEY`    | private key SSH tương ứng (dạng PEM, toàn bộ nội dung) |
| `VPS_PORT`       | cổng SSH (thường `22`)                              |
| `VPS_APP_PATH`   | đường dẫn repo trên VPS, vd `/var/www/ghe-1a`       |

## 4. Domain

- Chưa có domain: dùng subdomain Hostinger cấp trước, trỏ A record về IP VPS.
- Khi mua domain riêng (vd `ghe1a.com`): tạo A record `@` và `www` trỏ về IP VPS,
  cập nhật `server_name` trong Nginx và chạy lại `certbot`.

## 5. Sau khi deploy lần đầu

- Kiểm tra `pm2 status` và `pm2 logs ghe-1a` nếu có lỗi.
- Xem [CONTENTFUL.md](CONTENTFUL.md) để chuyển từ nội dung mẫu sang Contentful thật.
