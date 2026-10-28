import fs from 'fs';
import path from 'path';

console.log("🔍 Запуск предсборочной проверки безопасности (check-release)...");

// 1. Проверяем наличие .env в дистрибутиве
const distEnvPath = path.join(process.cwd(), 'dist', '.env');
if (fs.existsSync(distEnvPath)) {
  console.error("❌ КРИТИЧЕСКАЯ ОШИБКА: Обнаружен файл .env в папке dist/!");
  console.error("Пожалуйста, удалите dist/.env перед сборкой или отправкой в релиз.");
  process.exit(1);
}

// 2. Проверяем, что .env.example не содержит реальных секретов
const envExamplePath = path.join(process.cwd(), '.env.example');
if (fs.existsSync(envExamplePath)) {
  const content = fs.readFileSync(envExamplePath, 'utf8');
  if (content.includes('01121943') || content.includes('ADM') || content.includes('nekabitursecret')) {
    console.warn("⚠️ ПРЕДУПРЕЖДЕНИЕ: В .env.example найдены старые известные или подозрительные тестовые секреты.");
  }
}

// 3. Проверка на создание архива при наличии локального .env
const rootEnvPath = path.join(process.cwd(), '.env');
if (process.argv.includes('--strict') && fs.existsSync(rootEnvPath)) {
  console.error("❌ КРИТИЧЕСКАЯ ОШИБКА: Попытка создания релиза при наличии локального .env файла!");
  console.error("Для создания финального чистого архива временно удалите или переименуйте локальный .env файл.");
  process.exit(1);
}

console.log("✅ Все проверки безопасности успешно пройдены!");
process.exit(0);
