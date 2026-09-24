const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Muat konfigurasi dari file .env backend jika ada
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Path data minio di root project
const dataDir = path.resolve(__dirname, '..', 'minio_data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const env = {
  ...process.env,
  MINIO_ROOT_USER: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  MINIO_ROOT_PASSWORD: process.env.MINIO_SECRET_KEY || 'minioadmin',
};

console.log(`[MinIO] Starting MinIO server using data dir: ${dataDir}...`);

// Jalankan tanpa shell: true agar tidak memicu DEP0190 warning
const minio = spawn('minio.exe', ['server', dataDir, '--console-address', ':9001'], {
  env,
  stdio: 'inherit',
});

minio.on('error', (err) => {
  console.error('[MinIO Error]', err.message);
});

minio.on('exit', (code) => {
  console.log(`[MinIO] Process exited with code ${code}`);
});

process.on('SIGINT', () => {
  minio.kill('SIGINT');
  process.exit();
});

process.on('SIGTERM', () => {
  minio.kill('SIGTERM');
  process.exit();
});
