# Deploy lên Hostinger

Site đang chạy trên **Hostinger "Websites" (Node.js hosting)** — sản phẩm hosting
tự quản lý của Hostinger, có sẵn tích hợp GitHub riêng, khác với thuê 1 VPS trần rồi
tự cài Node/PM2/Nginx. Không cần SSH tay hay GitHub Actions cho việc deploy.

## 1. Deploy tự động

Website đã được **kết nối với GitHub repo này** trong Hostinger hPanel (mục
**Connected with GitHub**, xem trong Dashboard của website) với **Auto-deployment**
bật sẵn — mỗi lần push lên `main`, Hostinger tự `git pull`, `npm ci`, `npm run
build`, rồi khởi động lại app. Không cần làm gì thêm, chỉ cần `git push`.

Muốn deploy lại thủ công (vd sau khi đổi biến môi trường): vào Dashboard của
website trên hPanel → bấm **Redeploy**.

## 2. Biến môi trường

Đặt ở **hPanel → Websites → ghe1a.com → Environment variables** (không phải file
`.env.local` — file đó chỉ dùng khi chạy local). Cần các biến giống
[.env.example](.env.example):

- `CONTENTFUL_SPACE_ID`, `CONTENTFUL_ACCESS_TOKEN` — bắt buộc để site đọc nội dung
  thật thay vì dữ liệu mẫu trong `content/sample/`
- `NEXT_PUBLIC_SITE_URL=https://ghe1a.com`
- `KIT_API_KEY`, `KIT_FORM_ID` — cho form đăng ký bản tin
- `REVALIDATE_SECRET`, `HOSTINGER_API_TOKEN`, `HOSTINGER_USERNAME`,
  `HOSTINGER_DOMAIN` — tuỳ chọn, xem [CONTENTFUL.md](CONTENTFUL.md#auto-refresh-site-khi-bấm-publish)

Đổi biến môi trường xong nhớ bấm **Redeploy** để áp dụng.

## 3. Cache — vì sao nội dung mới đôi khi chưa lên ngay

Có 2 lớp cache tách biệt nhau:

- **Next.js ISR** (trong code, `export const revalidate = 60` ở các trang đọc
  Contentful) — tự làm mới dữ liệu tối đa 1 phút/lần, không cần deploy lại.
- **CDN của Hostinger** (`hcdn`) — cache HTML tới 1 năm phía trước server. Sau khi
  Contentful publish, nếu 1 phút trôi qua mà site vẫn chưa cập nhật, vào Dashboard
  website → **Essentials → Cache → Clear cache**.

Redeploy **không** tự xoá cache CDN — 2 việc độc lập nhau.

## 4. Domain & SSL

Quản lý ở **Manage domain** trong Dashboard website — Hostinger tự cấp SSL (mục
**SSL** hiện ✓ trong Dashboard).

## 5. Kiểm tra khi có lỗi

- **Runtime logs** (sidebar website) — log lỗi runtime của app đang chạy.
- **Deployments** (sidebar website) — xem lịch sử build, log build lỗi nếu có.
- Xem [CONTENTFUL.md](CONTENTFUL.md) để chuyển từ nội dung mẫu sang Contentful thật.

---

## Phụ lục: setup VPS thuần (không dùng, giữ lại tham khảo)

Kế hoạch ban đầu trước khi chuyển sang Hostinger Websites — tự thuê VPS, cài
Node/PM2/Nginx, deploy qua GitHub Actions SSH
([.github/workflows/deploy.yml](.github/workflows/deploy.yml), hiện đã tắt
trigger tự động vì không dùng tới, chỉ chạy được qua "Run workflow" thủ công).
Không cần làm theo phần này trừ khi thật sự chuyển sang tự quản lý VPS.

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

cp .env.example .env.local
nano .env.local

npm ci
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Nginx reverse proxy (`/etc/nginx/sites-available/ghe-1a`):

```nginx
server {
    listen 80;
    server_name ghe1a.com www.ghe1a.com;

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

Muốn bật lại workflow SSH tự động: thêm `push: {branches: [main]}` vào phần
`on:` của `deploy.yml`, và thêm 5 secret sau vào **GitHub repo → Settings →
Secrets and variables → Actions**:

| Secret          | Giá trị                                            |
|------------------|----------------------------------------------------|
| `VPS_HOST`       | IP hoặc hostname của VPS                            |
| `VPS_USERNAME`   | user SSH                                            |
| `VPS_SSH_KEY`    | private key SSH (dạng PEM, toàn bộ nội dung)        |
| `VPS_PORT`       | cổng SSH (thường `22`)                              |
| `VPS_APP_PATH`   | đường dẫn repo trên VPS, vd `/var/www/ghe-1a`       |
