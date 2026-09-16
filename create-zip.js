import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log("📦 Создание безопасного архива релиза...");

// Сначала выполняем строгую проверку безопасности
try {
  execSync('node check-release.js --strict', { stdio: 'inherit' });
} catch (e) {
  console.error("❌ Сборка архива прервана из-за нарушения требований безопасности!");
  process.exit(1);
}

const zipName = 'site-anketnik-release.zip';

// Удаляем старый архив, если он есть
if (fs.existsSync(zipName)) {
  fs.unlinkSync(zipName);
}

// Проверяем наличие утилиты zip в системе
try {
  execSync('zip -v', { stdio: 'ignore' });
} catch (e) {
  console.error("⚠️ Утилита 'zip' не найдена в системе. Пожалуйста, соберите архив вручную, исключив:");
  console.error("   - node_modules/");
  console.error("   - .env");
  console.error("   - data/database.sqlite");
  console.error("   - data/logs.json (или лог-таблицы)");
  console.error("   - data/submissions.json");
  console.error("   - dist/.env");
  process.exit(1);
}

try {
  console.log("🤐 Сжимаем файлы через системный zip...");
  // Исключаем node_modules, локальный .env, базы данных, бэкапы, гиты и логи
  execSync(`zip -r ${zipName} . -x "node_modules/*" ".git/*" ".env*" "data/*.db" "data/*.sqlite" "data/submissions.json" "data/logs.json" "data/limits/*" "data/backups/*" "dist/.env" "bun.lock" "package-lock.json"`, { stdio: 'inherit' });
  console.log(`\n🎉 БЕЗОПАСНЫЙ АРХИВ УСПЕШНО СОЗДАН: ${zipName}`);
} catch (err) {
  console.error("❌ Ошибка при упаковке архива:", err);
  process.exit(1);
}
