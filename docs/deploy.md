# راه‌اندازی دوپینگ

دوپینگ حالا یک اپ کامل است: یک سرور Next.js (سایت، پنل گیمر، پنل مدیریت، API و کارهای پس‌زمینه) و یک دیتابیس PostgreSQL. هر سرویسی که Docker و PostgreSQL بدهد کافی است.

## ۱. متغیرها

فایل `.env.example` را به `.env` کپی کن و پر کن:

| متغیر | توضیح |
|---|---|
| `APP_URL` | آدرس عمومی سایت، مثل `https://doping.games`. بانک بعد از پرداخت به همین آدرس برمی‌گردد. |
| `DATABASE_URL` | آدرس PostgreSQL. با docker-compose خودکار ساخته می‌شود. |
| `DOPING_KMS_KEYS` / `DOPING_KMS_ACTIVE` | کلید رمزگذاری رمز روترها، رمز RCON و کلیدهای خصوصی WireGuard. با `openssl rand -base64 32` بساز، مثلاً `DOPING_KMS_KEYS=k2026:<کلید>` و `DOPING_KMS_ACTIVE=k2026`. **این کلید را گم نکن**؛ بدون آن کانفیگ کاربرها قابل بازسازی نیست. بدون آن اپ در حالت production بالا نمی‌آید. |
| `ADMIN_EMAIL` / `ADMIN_USERNAME` / `ADMIN_PASSWORD` | اولین حساب مدیر، فقط وقتی هیچ مدیری وجود ندارد ساخته می‌شود (رمز حداقل ۱۲ کاراکتر). |
| `ZARINPAL_MERCHANT_ID` | مرچنت زرین‌پال. تا خالی باشد، درگاه **آزمایشی** داخلی فعال است و پولی جابه‌جا نمی‌شود. |
| `PAYMENT_MODE` | `live` یا `sandbox` (فقط وقتی مرچنت تنظیم شده). |
| `POSTGRES_PASSWORD` | رمز دیتابیس در docker-compose. |

اختیاری: `REGISTRATION=false` (ثبت‌نام بسته)، `QUOTA_INTERVAL_SEC` (پیش‌فرض ۳۰۰ ثانیه)، `SERVER_POLL_SEC` (پیش‌فرض ۳۰)، `TRUST_PROXY`، `COOKIE_SECURE`.

## ۲. اجرا با Docker Compose (VPS یا هر سروری با Docker)

```bash
cp .env.example .env    # پر کن
docker compose up -d --build
```

سایت روی پورت ۳۰۰۰ بالا می‌آید. جلویش یک reverse proxy با SSL بگذار (Caddy، nginx یا پنل سرویس). جدول‌های دیتابیس بار اول خودکار ساخته می‌شوند.

اگر سرور به رجیستری npm دسترسی ندارد: `NPM_REGISTRY=https://<آینه>/ docker compose build`.

## ۳. اجرا روی PaaS (مثل لیارا، هم‌روش، آروان یا «گره»)

1. یک دیتابیس **PostgreSQL** از خود سرویس بساز و آدرسش را در `DATABASE_URL` بگذار.
2. اپ جدید از نوع **Docker** بساز و مخزن (شاخه `main`) را وصل کن؛ `Dockerfile` داخل مخزن استفاده می‌شود.
3. متغیرهای بخش ۱ را در تنظیمات اپ وارد کن.
4. پورت: ۳۰۰۰ (اگر سرویس `PORT` را خودش می‌دهد، اپ همان را گوش می‌دهد).
5. Health check: مسیر `/api/healthz`.
6. منابع: حداقل ۵۱۲ مگابایت رم برای اجرا؛ مرحله build حدود ۱.۵ گیگ رم می‌خواهد.
7. دامنه و SSL را وصل کن و `APP_URL` را با همان دامنه تنظیم کن.

فقط **یک** نمونه از اپ کافی است. اگر چند نمونه اجرا کنی، کارهای پس‌زمینه با قفل دیتابیس فقط روی یکی اجرا می‌شوند؛ ولی محدودیت تعداد درخواست (rate limit) هر نمونه جداست.

## ۴. بعد از اولین اجرا

1. با `ADMIN_EMAIL` و `ADMIN_PASSWORD` از `/login` وارد شو؛ مستقیم به «مرکز کنترل» می‌روی.
2. **روترها و نودها → افزودن روتر**: آی‌پی، پورت `www-ssl`، کاربر و رمز API، اینترفیس WireGuard و رنج آی‌پی تانل. بعد «تست اتصال و سینک» را بزن. اولین اتصال موفق، گواهی روتر را پین می‌کند و از آن به بعد هر گواهی دیگری رد می‌شود.
3. **سرورهای بازی**: هاست، پورت و رمز RCON هر سرور. وضعیت زنده هر ۳۰ ثانیه با A2S خوانده می‌شود.
4. **تنظیمات سایت**: متن‌ها، قیمت‌ها، بازی‌ها، سوال‌ها، DNS و پیش‌فرض‌های WireGuard.
5. **فروش و درگاه**: کد تخفیف و روشن/خاموش کردن درگاه‌ها.

## ۵. آماده‌سازی میکروتیک (RouterOS v7)

```
/certificate add name=api common-name=router-api days-valid=3650
/certificate sign api
/ip service set www-ssl certificate=api disabled=no port=443 address=<آی‌پی سرور پنل>/32
/user group add name=doping-api policy=read,write,api,rest-api,!ftp,!ssh,!telnet,!winbox,!web,!password,!policy,!sensitive
/user add name=doping-api group=doping-api password=<رمز حداقل ۱۲ کاراکتر> address=<آی‌پی سرور پنل>/32
/interface wireguard add name=wg-doping listen-port=51820
/ip address add address=10.10.30.1/24 interface=wg-doping
```

پنل از طریق همین REST، Peer و Simple Queue هر مشتری را می‌سازد، حجم مصرفی را از شمارنده صف‌ها می‌خواند و وقتی حجم یا زمان تمام شد Peer را غیرفعال می‌کند. آی‌پی‌های DNS در address-list `doping-dns-allowed` ثبت می‌شوند؛ فایروال DNS باید فقط به همین لیست جواب بدهد.

## ۶. پشتیبان‌گیری

- دیتابیس: `docker compose exec db pg_dump -U doping doping > backup.sql`
- کلید `DOPING_KMS_KEYS` را جدا و امن نگه دار.
