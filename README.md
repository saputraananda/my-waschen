# My Waschen

Aplikasi manajemen laundry berbasis web menggunakan **React Vite** (frontend) + **Express.js** (backend) dalam satu repo.

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, React Router DOM
- **Backend**: Express.js, MySQL2
- **Dev Tools**: Nodemon, Concurrently

## Struktur Proyek

```
my-waschen/
├── api/
│   ├── controllers/   # Controller logic
│   ├── db/            # Koneksi database (MySQL)
│   ├── middleware/    # Middleware Express
│   └── routes/        # Definisi route API
├── public/            # Aset statis publik
├── src/
│   ├── assets/        # Aset frontend
│   ├── components/    # Komponen React
│   ├── pages/         # Halaman React
│   ├── utils/         # Fungsi utility
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── .env               # Environment development
├── .env.prod          # Environment production
├── index.html
├── nodemon.json
├── package.json
├── postcss.config.js
├── server.js          # Entry point Express
├── tailwind.config.js
└── vite.config.js
```

## Setup & Menjalankan

### Install dependencies
```bash
npm install
```

### Development (frontend + backend bersamaan)
```bash
npm run dev
```

### Build production
```bash
npm run build
```

### Menjalankan production
```bash
node server.js
```

## API Routes

| Method | Endpoint      | Keterangan          |
|--------|---------------|---------------------|
| GET    | /api/health   | Health check server |

## Environment Variables

Salin `.env` untuk development, `.env.prod` untuk production.

| Variable   | Keterangan             |
|------------|------------------------|
| HOST       | Host database MySQL    |
| PORT       | Port database MySQL    |
| USER       | Username database      |
| PASS       | Password database      |
| DB         | Nama database          |
| APP_PORT   | Port server Express    |
| NODE_ENV   | Mode environment       |
