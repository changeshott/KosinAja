// npm run dev: build ulang ketiga file CSS setiap ada perubahan HTML/JS/CSS (Ctrl+C untuk berhenti).
// Dijalankan lewat Node supaya tiga watcher bisa jalan bersamaan di Windows maupun Linux/macOS.
const { spawn } = require('child_process');

const BUNDLE = [
  ['frontend/tailwind/situs.css', 'frontend/assets/css/situs.css'],
  ['frontend/tailwind/auth.css', 'frontend/assets/css/auth.css'],
  ['frontend/tailwind/admin.css', 'frontend/assets/css/admin.css'],
];

const proses = BUNDLE.map(([masuk, keluar]) =>
  spawn('npx', ['tailwindcss', '-i', masuk, '-o', keluar, '--watch'], { stdio: 'inherit', shell: true }));

process.on('SIGINT', () => {
  proses.forEach((p) => p.kill());
  process.exit(0);
});
