import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { initializeApp as initFirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';

// Загружаем переменные окружения
dotenv.config();

// Повторное чтение из .env для надежности при изменении в рантайме
const getEnvConfig = () => {
  let parsed: any = {};
  try {
    const envFile = path.join(process.cwd(), '.env');
    if (fs.existsSync(envFile)) {
      parsed = dotenv.parse(fs.readFileSync(envFile, 'utf8'));
    }
  } catch (e) {}

  // Приоритет отдаем локальному файлу .env, если он существует и содержит непустые поля
  return {
    adminLogin: (parsed.ADMIN_LOGIN || process.env.ADMIN_LOGIN || '').trim(),
    adminPasswordHash: (parsed.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD_HASH || '').trim(),
    serverSecret: parsed.SERVER_SECRET || process.env.SERVER_SECRET || '',
    encryptionSecret: parsed.ENCRYPTION_SECRET || process.env.ENCRYPTION_SECRET || '',
    appUrl: parsed.APP_URL || process.env.APP_URL || ''
  };
};

// Динамическое определение путей для ESM и CommonJS (устраняет ошибку сборки с import.meta.url)
let currentDir = process.cwd();
try {
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    currentDir = path.dirname(fileURLToPath(import.meta.url));
  }
} catch (e) {
  if (typeof __dirname !== 'undefined') {
    currentDir = __dirname;
  }
}

const DATA_DIR = path.join(process.cwd(), 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

// Инициализация Firebase Firestore
let firebaseConfig: any = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.warn("Не удалось прочитать firebase-applet-config.json:", e);
}

let fbApp: any = null;
let firestoreDb: any = null;
if (firebaseConfig && firebaseConfig.projectId) {
  try {
    fbApp = initFirebaseApp(firebaseConfig);
    firestoreDb = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
    console.log("🔥 Firebase Firestore успешно подключен! Проект:", firebaseConfig.projectId, "БД:", firebaseConfig.firestoreDatabaseId);
  } catch (err) {
    console.error("Ошибка инициализации Firebase в server.ts:", err);
  }
}

// Автогенерация защищенного .env для локальной разработки / AI Studio
const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath) && process.env.NODE_ENV !== 'production') {
  const generatedLogin = 'ADM';
  const generatedPassword = '01121943';
  const salt = bcrypt.genSaltSync(10);
  const generatedHash = bcrypt.hashSync(generatedPassword, salt);
  const generatedServerSecret = crypto.randomBytes(32).toString('hex');
  const generatedEncryptionSecret = crypto.randomBytes(32).toString('hex');

  const devEnv = `ADMIN_LOGIN="${generatedLogin}"
ADMIN_PASSWORD_HASH="${generatedHash}"
SERVER_SECRET="${generatedServerSecret}"
ENCRYPTION_SECRET="${generatedEncryptionSecret}"
APP_URL="http://localhost:3000"
`;
  try {
    fs.writeFileSync(envPath, devEnv, 'utf8');
    dotenv.config();
    console.log("===============================================================================");
    console.log("🔒 СГЕНЕРИРОВАН НОВЫЙ ФАЙЛ .env ДЛЯ ЛОКАЛЬНОЙ РАЗРАБОТКИ!");
    console.log(`👤 Логин администратора:  ${generatedLogin}`);
    console.log(`🔑 Пароль администратора: ${generatedPassword}`);
    console.log("===============================================================================");
  } catch (err) {
    console.error("Не удалось создать локальный .env файл:", err);
  }
}

// Проверка наличия обязательных переменных окружения (в соответствии с требованиями аудита безопасности)
const REQUIRED_ENV_VARS = ['ADMIN_LOGIN', 'ADMIN_PASSWORD_HASH', 'SERVER_SECRET', 'ENCRYPTION_SECRET'];
const missingVars = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error("===============================================================================");
  console.error(`КРИТИЧЕСКАЯ ОШИБКА ЗАПУСКА: Отсутствуют обязательные переменные окружения: ${missingVars.join(', ')}`);
  console.error("Приложение отказывается запускаться без надлежащей конфигурации безопасности.");
  console.error("Пожалуйста, настройте переменные в файле .env или в окружении сервера.");
  console.error("Шаблон настроек доступен в файле .env.example.");
  console.error("===============================================================================");
  process.exit(1);
}

const ADMIN_LOGIN = process.env.ADMIN_LOGIN!;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH!;
const SERVER_SECRET = process.env.SERVER_SECRET!;
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET!;
const APP_URL = process.env.APP_URL || '';

// Сессии администратора (токен -> время истечения)
const SESSION_TTL = 2 * 60 * 60 * 1000; // 2 часа

// Создание хэша пароля администратора (HMAC SHA-512) для совместимости со старыми паролями
const generatePasswordHash = (password: string) => {
  return crypto.createHmac('sha512', 'nemk_salt_2026').update(password).digest('hex');
};

// Инициализация директорий
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Вопросы по умолчанию согласно требованиям ТЗ
const DEFAULT_QUESTIONS = [
  {
    id: 'source',
    text: 'Из каких источников Вы узнали о нашем колледже?',
    type: 'select',
    options: ['От друзей, родственников', 'От представителей колледжа', 'Интернет', 'Учебная Сибирь', 'Другое'],
    isDefault: true,
    required: true,
  },
  {
    id: 'influence',
    text: 'Что повлияло на Ваш выбор?',
    type: 'select',
    options: ['Интерес к выбранной специальности (профессии)', 'Мнение друзей, родственников', 'Место положение (рядом с домом)', 'Наличие общежития', 'Другое'],
    isDefault: true,
    required: true,
  },
  {
    id: 'activity',
    text: 'Выберите направление, в котором готовы участвовать:',
    type: 'select',
    options: ['Спортивное', 'Творческое (рисование, музыка, песни и т.д.)', 'Патриотическое', 'Волонтерское', 'Студенческое самоуправление'],
    isDefault: true,
    required: true,
  },
  {
    id: 'residence',
    text: 'Ваше место жительства',
    type: 'select',
    options: ['Новосибирск, Первомайский район', 'Новосибирск, Другие районы', 'Новосибирская область', 'Другие регионы Российской Федерации'],
    isDefault: true,
    required: true,
  }
];

const SEED_NAMES = [
  'Иванов Дмитрий Сергеевич', 'Петрова Анна Алексеевна', 'Смирнов Артем Игоревич',
  'Васильев Максим Владимирович', 'Кузнецова София Дмитриевна', 'Попов Александр Евгеньевич',
  'Соколов Никита Денисович', 'Лебедева Мария Кирилловна', 'Козлов Егор Романович',
  'Новиков Даниил Александрович', 'Морозова Полина Максимовна', 'Петров Владислав Павлович',
  'Волков Илья Семенович', 'Соловьева Дарья Артемовна', 'Павлов Михаил Никитич',
  'Семенов Кирилл Викторович', 'Голубева Алиса Олеговна', 'Виноградов Тимофей Антонович',
  'Богданов Матвей Андреевич', 'Воробьева Елизавета Егоровна'
];

const SEED_REFERRERS = [
  'Иванов Сергей Николаевич', 'Петров Алексей Петрович', 'Смирнова Elena Васильевна',
  'Родители', 'Брат учится в НЭК', 'Знакомый выпускник', 'Преподаватель школы',
  'Куратор на выставке', 'Сестра', 'Друг со старшего курса', 'Никто (самостоятельно)'
];

const SEED_CUSTOM_SOURCES = [
  'Реклама в автобусе', 'Группа ВКонтакте', 'Справочник 2ГИС', 'Школьный профориентатор'
];

function generateMockSubmissions() {
  const submissions = [];
  const now = new Date();
  for (let i = 0; i < 45; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date(now);
    date.setDate(now.getDate() - daysAgo);
    date.setHours(9 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60), 0, 0);

    const nameIdx = Math.floor(Math.random() * SEED_NAMES.length);
    const refIdx = Math.floor(Math.random() * SEED_REFERRERS.length);
    
    let referrerType = null;
    if (refIdx === 4 || refIdx === 9) {
      referrerType = 'student';
    } else if (refIdx === 6 || refIdx === 7) {
      referrerType = 'staff';
    } else if (refIdx !== 10 && Math.random() > 0.7) {
      referrerType = Math.random() > 0.5 ? 'student' : 'staff';
    }

    const sourceOpts = DEFAULT_QUESTIONS[0].options;
    const srcIdx = Math.floor(Math.random() * sourceOpts.length);
    let sourceAns = sourceOpts[srcIdx];
    if (sourceAns === 'Другое') {
      sourceAns = 'Другое: ' + SEED_CUSTOM_SOURCES[Math.floor(Math.random() * SEED_CUSTOM_SOURCES.length)];
    }

    const influenceOpts = DEFAULT_QUESTIONS[1].options;
    const infIdx = Math.floor(Math.random() * influenceOpts.length);
    let influenceAns = influenceOpts[infIdx];
    if (influenceAns === 'Другое') {
      influenceAns = 'Другое: Совет старшего брата';
    }

    const activityOpts = DEFAULT_QUESTIONS[2].options;
    const actIdx = Math.floor(Math.random() * activityOpts.length);
    const activityAns = activityOpts[actIdx];

    const residenceOpts = DEFAULT_QUESTIONS[3].options;
    const resIdx = Math.floor(Math.random() * residenceOpts.length);
    const residenceAns = residenceOpts[resIdx];

    submissions.push({
      id: `mock-${i}-${date.getTime()}`,
      applicantName: SEED_NAMES[nameIdx] + (Math.random() > 0.5 ? ' ' + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + '.' : ''),
      referrerName: SEED_REFERRERS[refIdx],
      referrerType,
      answers: {
        source: sourceAns,
        influence: influenceAns,
        activity: activityAns,
        residence: residenceAns
      },
      submittedAt: date.toISOString()
    });
  }
  return submissions.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

// Инициализация базы данных SQLite
let db: Database<sqlite3.Database, sqlite3.Statement>;

async function initDatabase() {
  const dbFile = path.join(DATA_DIR, 'database.sqlite');
  db = await open({
    filename: dbFile,
    driver: sqlite3.Database
  });

  await db.exec('PRAGMA foreign_keys = ON;');
  await db.exec('PRAGMA journal_mode = WAL;');

  // Таблицаsubmissions
  await db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      applicantName TEXT NOT NULL,
      referrerName TEXT NOT NULL,
      referrerType TEXT,
      answers TEXT NOT NULL,
      submittedAt TEXT NOT NULL,
      consentGiven INTEGER NOT NULL DEFAULT 1,
      consentAt TEXT NOT NULL,
      consentVersion TEXT NOT NULL,
      consentPurpose TEXT NOT NULL,
      consentDataScope TEXT NOT NULL,
      isDuplicate INTEGER NOT NULL DEFAULT 0
    );
  `);

  await db.exec(`CREATE INDEX IF NOT EXISTS idx_submissions_applicantName ON submissions(applicantName);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_submissions_submittedAt ON submissions(submittedAt);`);

  // Таблица questions
  await db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      type TEXT NOT NULL,
      options TEXT,
      isDefault INTEGER NOT NULL,
      required INTEGER NOT NULL
    );
  `);

  // Таблица logs
  await db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL
    );
  `);

  // Таблица sessions
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      expiresAt INTEGER NOT NULL
    );
  `);

  // Таблица captchas
  await db.exec(`
    CREATE TABLE IF NOT EXISTS captchas (
      id TEXT PRIMARY KEY,
      num1 INTEGER NOT NULL,
      num2 INTEGER NOT NULL,
      answer INTEGER NOT NULL,
      expiresAt INTEGER NOT NULL
    );
  `);

  // Наполнение начальными вопросами, если таблица пуста
  const countQuestions = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM questions;');
  if (countQuestions && countQuestions.count === 0) {
    for (const q of DEFAULT_QUESTIONS) {
      await db.run(
        'INSERT INTO questions (id, text, type, options, isDefault, required) VALUES (?, ?, ?, ?, ?, ?)',
        [q.id, q.text, q.type, JSON.stringify(q.options), q.isDefault ? 1 : 0, q.required ? 1 : 0]
      );
    }
  }

  // Наполнение фейковыми данными, если пусто
  const countSubs = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM submissions;');
  if (countSubs && countSubs.count === 0 && process.env.NODE_ENV !== 'production') {
    const mock = generateMockSubmissions();
    for (const s of mock) {
      await db.run(
        `INSERT INTO submissions (
          id, applicantName, referrerName, referrerType, answers, submittedAt, 
          consentGiven, consentAt, consentVersion, consentPurpose, consentDataScope, isDuplicate
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id, 
          s.applicantName, 
          s.referrerName, 
          s.referrerType || null, 
          JSON.stringify(s.answers), 
          s.submittedAt,
          1,
          s.submittedAt,
          '17.07.2026_site_4',
          'Проведение профориентационного анкетирования абитуриентов, определение каналов информирования, сбор статистики',
          'ФИО абитуриента, ФИО рекомендовавшего лица, его отношение к колледжу, ответы на вопросы',
          0
        ]
      );
    }
  }

  // Синхронизация с Firebase Firestore (если настроен)
  if (firestoreDb) {
    try {
      // 1. Проверяем наличие вопросов в Firestore
      const qSnap = await getDocs(collection(firestoreDb, 'questions'));
      if (qSnap.empty) {
        console.log("📝 Заполнение начальных вопросов в Firebase Firestore...");
        for (let i = 0; i < DEFAULT_QUESTIONS.length; i++) {
          const q = DEFAULT_QUESTIONS[i];
          await setDoc(doc(firestoreDb, 'questions', q.id), {
            id: q.id,
            text: q.text,
            type: q.type,
            options: q.options,
            isDefault: q.isDefault,
            required: q.required,
            order: i
          });
        }
        console.log("✅ Вопросы успешно сохранены в Firebase Firestore!");
      }

      // 2. Проверяем наличие анкет в Firestore (миграция существующих данных)
      const subSnap = await getDocs(collection(firestoreDb, 'submissions'));
      if (subSnap.empty && process.env.NODE_ENV !== 'production') {
        const sqliteSubs = await db.all('SELECT * FROM submissions');
        if (sqliteSubs && sqliteSubs.length > 0) {
          console.log(`🚀 Миграция ${sqliteSubs.length} анкет из локальной базы в Firebase Firestore...`);
          const batch = writeBatch(firestoreDb);
          for (const s of sqliteSubs) {
            const subDoc = doc(firestoreDb, 'submissions', s.id);
            batch.set(subDoc, {
              id: s.id,
              applicantName: s.applicantName,
              referrerName: s.referrerName,
              referrerType: s.referrerType || null,
              answers: typeof s.answers === 'string' ? JSON.parse(s.answers) : (s.answers || {}),
              submittedAt: s.submittedAt,
              consentGiven: !!s.consentGiven,
              consentAt: s.consentAt || s.submittedAt,
              consentVersion: s.consentVersion || '17.07.2026_site_4',
              consentPurpose: s.consentPurpose || 'Проведение профориентационного анкетирования',
              consentDataScope: s.consentDataScope || 'ФИО абитуриента, ФИО рекомендателя, ответы на вопросы',
              isDuplicate: !!s.isDuplicate
            });
          }
          await batch.commit();
          console.log("✅ Все анкеты успешно сохранены в Firebase Firestore!");
        }
      }
    } catch (fbInitErr) {
      console.warn("Предупреждение при инициализации Firebase Firestore:", fbInitErr);
    }
  }
}

// Система ведения журналов аудита
async function logAction(action: string, details: string) {
  try {
    const timestamp = new Date().toISOString();
    await db.run('INSERT INTO logs (timestamp, action, details) VALUES (?, ?, ?)', [
      timestamp,
      action,
      details
    ]);

    if (firestoreDb) {
      const logId = 'log-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
      await setDoc(doc(firestoreDb, 'logs', logId), {
        id: logId,
        timestamp,
        action,
        details
      });
    }
  } catch (e) {
    console.error("Ошибка ведения лога:", e);
  }
}

// Выполнение политики хранения данных (Retention Policy) — удаление устаревших (старше 1 года)
async function runRetentionPolicy() {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const thresholdIso = oneYearAgo.toISOString();

    // Находим количество записей к удалению в SQLite
    const countToDelete = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM submissions WHERE submittedAt < ?',
      [thresholdIso]
    );

    const deletedCount = countToDelete?.count || 0;

    if (deletedCount > 0) {
      // Удаляем анкеты старше 1 года
      await db.run('DELETE FROM submissions WHERE submittedAt < ?', [thresholdIso]);
      
      // Очищаем связанные логи аудита (логи старше 1 года)
      await db.run('DELETE FROM logs WHERE timestamp < ?', [thresholdIso]);

      // Также удаляем устаревшие резервные копии (созданные более года назад)
      if (fs.existsSync(BACKUPS_DIR)) {
        const files = await fs.promises.readdir(BACKUPS_DIR);
        for (const f of files) {
          const filePath = path.join(BACKUPS_DIR, f);
          const stat = await fs.promises.stat(filePath);
          if (stat.mtime < oneYearAgo) {
            await fs.promises.unlink(filePath);
            await logAction('Удаление старого бэкапа', `Автоматическое удаление устаревшей резервной копии: ${f}`);
          }
        }
      }

      await logAction('Retention Policy', `Запуск очистки данных. Автоматически удалено устаревших анкет: ${deletedCount}`);
    }
    
    // Очищаем просроченные сессии и капчи
    await db.run('DELETE FROM sessions WHERE expiresAt < ?', [Date.now()]);
    await db.run('DELETE FROM captchas WHERE expiresAt < ?', [Date.now()]);

    // Удаление устаревших данных из Firebase Firestore
    if (firestoreDb) {
      try {
        const subSnap = await getDocs(collection(firestoreDb, 'submissions'));
        const expiredSubDocs: any[] = [];
        subSnap.forEach(d => {
          const data = d.data();
          if (data.submittedAt && data.submittedAt < thresholdIso) {
            expiredSubDocs.push(d.ref);
          }
        });

        if (expiredSubDocs.length > 0) {
          const batch = writeBatch(firestoreDb);
          expiredSubDocs.forEach(ref => batch.delete(ref));
          await batch.commit();
          console.log(`🔥 Firebase Retention Policy: удалено ${expiredSubDocs.length} устаревших анкет`);
        }

        const logSnap = await getDocs(collection(firestoreDb, 'logs'));
        const expiredLogDocs: any[] = [];
        logSnap.forEach(d => {
          const data = d.data();
          if (data.timestamp && data.timestamp < thresholdIso) {
            expiredLogDocs.push(d.ref);
          }
        });

        if (expiredLogDocs.length > 0) {
          const batch = writeBatch(firestoreDb);
          expiredLogDocs.forEach(ref => batch.delete(ref));
          await batch.commit();
        }
      } catch (fbRetErr) {
        console.warn("Предупреждение при выполнении Retention в Firestore:", fbRetErr);
      }
    }

  } catch (err: any) {
    console.error("Ошибка при выполнении политики очистки данных (retention):", err);
    try {
      await logAction('Retention Error', `Ошибка выполнения очистки: ${err.message}`);
    } catch (e) {}
  }
}

// Промежуточное ПО для авторизации администратора на основе SQLite сессий
const requireAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Неавторизованный запрос: отсутствует заголовок авторизации" });
  }
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
  
  try {
    const session = await db.get<{ username: string; expiresAt: number }>('SELECT username, expiresAt FROM sessions WHERE token = ?', [token]);
    if (!session) {
      return res.status(401).json({ error: "Неверный токен авторизации или сессия истекла" });
    }
    
    if (Date.now() > session.expiresAt) {
      await db.run('DELETE FROM sessions WHERE token = ?', [token]);
      return res.status(401).json({ error: "Сессия истекла. Пожалуйста, войдите снова" });
    }
    
    // Продлеваем сессию
    await db.run('UPDATE sessions SET expiresAt = ? WHERE token = ?', [Date.now() + SESSION_TTL, token]);
    next();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// Промежуточное ПО для ограничения частоты запросов (Rate Limiting)
const ipRequests = new Map<string, { count: number, resetTime: number }>();
const rateLimit = (maxRequests: number, windowMs: number) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    const now = Date.now();
    const entry = ipRequests.get(ip);
    
    if (!entry || now > entry.resetTime) {
      ipRequests.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    entry.count++;
    if (entry.count > maxRequests) {
      return res.status(429).json({ error: "Слишком много запросов. Пожалуйста, попробуйте позже." });
    }
    
    next();
  };
};

async function startServer() {
  await initDatabase();
  await runRetentionPolicy();

  // Запуск retention по расписанию каждые 12 часов
  setInterval(runRetentionPolicy, 12 * 60 * 60 * 1000);

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Дополнительная защита сервера и заголовки безопасности
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Настройка строгой CORS и CSP политики в зависимости от окружения
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://2gis.ru https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com ${APP_URL ? APP_URL : ''};`);
    } else {
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://2gis.ru https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.run.app https://*.aistudio.google localhost:* 127.0.0.1:*;");
    }
    next();
  });

  // CORS обработчик
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const isProd = process.env.NODE_ENV === 'production';
    
    if (origin) {
      const cleanOrigin = origin.replace(/\/$/, '');
      const cleanAppUrl = APP_URL.replace(/\/$/, '');
      const isLocalhost = cleanOrigin.startsWith('http://localhost') || cleanOrigin.startsWith('http://127.0.0.1');
      const isAiStudio = cleanOrigin.includes('.run.app') || cleanOrigin.includes('.aistudio.google');

      if (isProd) {
        if (cleanOrigin === cleanAppUrl) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        } else {
          // В продакшене блокируем посторонние Origin
          return res.status(403).json({ error: "CORS Policy: Origin not allowed in Production." });
        }
      } else {
        if (cleanOrigin === cleanAppUrl || isLocalhost || isAiStudio) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        }
      }
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json());

  // Получить новый одноразовый математический капча-челлендж с сервера
  app.get('/api/captcha', rateLimit(30, 60000), async (req, res) => {
    try {
      const id = crypto.randomBytes(16).toString('hex');
      const num1 = Math.floor(Math.random() * 9) + 2; // 2..10
      const num2 = Math.floor(Math.random() * 9) + 2; // 2..10
      const answer = num1 + num2;
      const expiresAt = Date.now() + 10 * 60 * 1000; // TTL 10 минут

      await db.run(
        'INSERT INTO captchas (id, num1, num2, answer, expiresAt) VALUES (?, ?, ?, ?, ?)',
        [id, num1, num2, answer, expiresAt]
      );

      res.json({ id, num1, num2 });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Логин администратора с проверкой брутфорса и запретом на устаревшие учетные данные
  app.post('/api/login', rateLimit(5, 60000), async (req, res) => {
    try {
      const { login, password } = req.body;
      if (!login || !password) {
        return res.status(400).json({ error: "Поля логин и пароль обязательны" });
      }

      let isLoginValid = false;
      const currentConfig = getEnvConfig();
      const targetLogin = currentConfig.adminLogin || ADMIN_LOGIN;
      const targetHash = currentConfig.adminPasswordHash || ADMIN_PASSWORD_HASH;

      if (login.trim() === targetLogin) {
        if (targetHash.startsWith('$2y$') || targetHash.startsWith('$2a$') || targetHash.startsWith('$2b$')) {
          const compatibleHash = targetHash.replace(/^\$2y\$/, '$2a$');
          isLoginValid = bcrypt.compareSync(password, compatibleHash);
        } else {
          const hashedInput = generatePasswordHash(password);
          isLoginValid = (hashedInput === targetHash) || (password === targetHash);
        }
      }
      
      if (isLoginValid) {
        await logAction('Логин', 'Успешная авторизация администратора');
        
        // Генерируем сессионный токен
        const token = crypto.randomBytes(32).toString('hex');
        await db.run('INSERT INTO sessions (token, username, expiresAt) VALUES (?, ?, ?)', [
          token,
          login,
          Date.now() + SESSION_TTL
        ]);
        
        res.json({ token });
      } else {
        await logAction('Сбой логина', `Попытка входа под логином "${login}" с неверным паролем`);
        res.status(401).json({ error: "Неверный логин или пароль" });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Выход администратора (токен аннулируется)
  app.post('/api/logout', requireAdmin, async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
        await db.run('DELETE FROM sessions WHERE token = ?', [token]);
      }
      await logAction('Выход', 'Администратор вышел из системы');
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Информация о подключенной базе данных (Firebase Firestore)
  app.get('/api/db-status', async (req, res) => {
    res.json({
      type: firestoreDb ? 'firebase' : 'sqlite',
      firebaseConnected: !!firestoreDb,
      projectId: firebaseConfig?.projectId || null,
      databaseId: firebaseConfig?.firestoreDatabaseId || '(default)'
    });
  });

  // Получить анкеты (требуется авторизация)
  app.get('/api/submissions', requireAdmin, async (req, res) => {
    try {
      if (firestoreDb) {
        try {
          const subSnap = await getDocs(collection(firestoreDb, 'submissions'));
          const submissions = subSnap.docs.map(d => {
            const data = d.data();
            return {
              ...data,
              answers: typeof data.answers === 'string' ? JSON.parse(data.answers) : (data.answers || {}),
              consentGiven: !!data.consentGiven,
              isDuplicate: !!data.isDuplicate
            };
          });
          submissions.sort((a: any, b: any) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
          return res.json(submissions);
        } catch (fbErr) {
          console.warn("Предупреждение при чтении из Firebase, переключение на локальную БД:", fbErr);
        }
      }

      const rows = await db.all('SELECT * FROM submissions ORDER BY submittedAt DESC');
      const parsedSubmissions = rows.map(r => ({
        ...r,
        answers: JSON.parse(r.answers),
        consentGiven: !!r.consentGiven,
        isDuplicate: !!r.isDuplicate
      }));
      res.json(parsedSubmissions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Подача новой анкеты с сохранением в Firebase Firestore
  app.post('/api/submissions', rateLimit(10, 60000), async (req, res) => {
    try {
      const { applicantName, referrerName, referrerType, answers, consent, consentVersion, captchaId, captchaAnswer } = req.body;
      
      // 1. Проверка согласия на обработку ПДн на сервере
      if (consent !== true && consent !== 'true') {
        return res.status(400).json({ error: "Согласие на обработку персональных данных обязательно для подачи анкеты." });
      }

      if (!applicantName || !referrerName) {
        return res.status(400).json({ error: "Параметры applicantName и referrerName обязательны" });
      }

      // 2. Серверная проверка математической капчи
      if (!captchaId) {
        return res.status(400).json({ error: "Запрос отклонен: отсутствует challenge капчи." });
      }

      const challenge = await db.get<{ answer: number; expiresAt: number }>('SELECT answer, expiresAt FROM captchas WHERE id = ?', [captchaId]);
      if (!challenge) {
        return res.status(400).json({ error: "Запрос отклонен: неверный или недействительный challenge капчи." });
      }

      // Сразу удаляем капчу из базы, гарантируя одноразовость
      await db.run('DELETE FROM captchas WHERE id = ?', [captchaId]);

      if (challenge.expiresAt < Date.now()) {
        return res.status(400).json({ error: "Срок действия капчи истек. Пожалуйста, попробуйте снова." });
      }

      if (parseInt(captchaAnswer) !== challenge.answer) {
        return res.status(400).json({ error: "Неверный ответ на математическую проверку от роботов." });
      }

      // 3. Валидация ФИО
      const cleanName = applicantName.trim();
      const nameParts = cleanName.split(/\s+/);
      const cyrillicRegex = /^[А-Яа-яЁё\s\-]+$/;
      if (nameParts.length < 2 || !cyrillicRegex.test(cleanName)) {
        return res.status(400).json({ error: "Неверный формат ФИО. ФИО должно содержать фамилию и имя на русском языке." });
      }

      // 4. Проверка лимитов и дубликатов в Firebase Firestore
      let isDuplicate = 0;
      let totalCount = 0;

      if (firestoreDb) {
        try {
          const subSnap = await getDocs(collection(firestoreDb, 'submissions'));
          totalCount = subSnap.size;
          if (totalCount >= 5000) {
            return res.status(400).json({ error: "Достигнут лимит в 5000 абитуриентов. Прием новых анкет приостановлен." });
          }
          const lowerName = cleanName.toLowerCase();
          subSnap.forEach(d => {
            const data = d.data();
            if (data.applicantName && data.applicantName.trim().toLowerCase() === lowerName) {
              isDuplicate = 1;
            }
          });
        } catch (fbErr) {
          console.warn("Предупреждение при проверке в Firebase:", fbErr);
        }
      }

      if (!firestoreDb || totalCount === 0) {
        const countRow = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM submissions');
        if (countRow && countRow.count >= 5000) {
          return res.status(400).json({ error: "Достигнут лимит в 5000 абитуриентов. Прием новых анкет приостановлен." });
        }
        const duplicateRow = await db.get<{ count: number }>(
          'SELECT COUNT(*) as count FROM submissions WHERE LOWER(TRIM(applicantName)) = LOWER(TRIM(?))',
          [cleanName]
        );
        if (duplicateRow && duplicateRow.count > 0) isDuplicate = 1;
      }

      const submissionId = 'sub-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
      const submittedAt = new Date().toISOString();

      const consentPurpose = "Проведение профориентационного анкетирования абитуриентов, определение каналов информирования, сбор статистики";
      const consentDataScope = "ФИО абитуриента, ФИО рекомендовавшего лица, его отношение к колледжу, ответы на вопросы";

      const submissionData = {
        id: submissionId,
        applicantName: cleanName,
        referrerName: referrerName.trim(),
        referrerType: referrerType || null,
        answers: answers || {},
        submittedAt,
        consentGiven: true,
        consentAt: submittedAt,
        consentVersion: consentVersion || '17.07.2026_site_4',
        consentPurpose,
        consentDataScope,
        isDuplicate: !!isDuplicate
      };

      // Сохраняем в Firebase Firestore
      if (firestoreDb) {
        try {
          await setDoc(doc(firestoreDb, 'submissions', submissionId), submissionData);
          console.log(`🔥 Анкета ${cleanName} успешно сохранена в Firebase Firestore!`);
        } catch (fbSaveErr) {
          console.error("Ошибка сохранения в Firebase Firestore:", fbSaveErr);
        }
      }

      // Зеркалируем в локальную базу SQLite
      await db.run(
        `INSERT INTO submissions (
          id, applicantName, referrerName, referrerType, answers, submittedAt,
          consentGiven, consentAt, consentVersion, consentPurpose, consentDataScope, isDuplicate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          submissionId,
          cleanName,
          referrerName.trim(),
          referrerType || null,
          JSON.stringify(answers || {}),
          submittedAt,
          1,
          submittedAt,
          consentVersion || '17.07.2026_site_4',
          consentPurpose,
          consentDataScope,
          isDuplicate
        ]
      );

      // Логируем действие
      await logAction('Подача анкеты', `Подана анкета абитуриента "${cleanName}"`);

      // Возвращаем абсолютно нейтральный успешный ответ 201 с созданным объектом!
      res.status(201).json(submissionData);

    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Удаление анкеты (требуется авторизация)
  app.delete('/api/submissions/:id', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const target = await db.get<{ applicantName: string }>('SELECT applicantName FROM submissions WHERE id = ?', [id]);
      
      if (firestoreDb) {
        try {
          await deleteDoc(doc(firestoreDb, 'submissions', id));
          console.log(`🔥 Анкета ${id} удалена из Firebase Firestore`);
        } catch (fbDelErr) {
          console.warn("Ошибка удаления из Firebase Firestore:", fbDelErr);
        }
      }

      await db.run('DELETE FROM submissions WHERE id = ?', [id]);
      await logAction('Удаление анкеты', `Удалена анкета абитуриента "${target?.applicantName || id}"`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Полная очистка БД абитуриентов (требуется авторизация)
  app.post('/api/submissions/clear', requireAdmin, async (req, res) => {
    try {
      if (firestoreDb) {
        try {
          const snap = await getDocs(collection(firestoreDb, 'submissions'));
          const batch = writeBatch(firestoreDb);
          snap.forEach(d => batch.delete(d.ref));
          await batch.commit();
          console.log("🔥 Все анкеты успешно удалены из Firebase Firestore");
        } catch (fbClearErr) {
          console.warn("Ошибка очистки Firebase Firestore:", fbClearErr);
        }
      }

      await db.run('DELETE FROM submissions');
      await logAction('Очистка БД', 'Успешно произведена полная очистка базы данных анкет');
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Эндпоинт для вызова Retention Policy вручную
  app.post('/api/submissions/retention', requireAdmin, async (req, res) => {
    try {
      await runRetentionPolicy();
      res.json({ success: true, message: "Политика удаления устаревших данных успешно выполнена." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Эндпоинты вопросов
  app.get('/api/questions', async (req, res) => {
    try {
      if (firestoreDb) {
        try {
          const qSnap = await getDocs(collection(firestoreDb, 'questions'));
          if (!qSnap.empty) {
            const questions = qSnap.docs.map(d => d.data());
            questions.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
            return res.json(questions);
          }
        } catch (fbQErr) {
          console.warn("Сбой чтения вопросов из Firebase, переключение на SQLite:", fbQErr);
        }
      }

      const rows = await db.all('SELECT * FROM questions');
      const questions = rows.map(r => ({
        id: r.id,
        text: r.text,
        type: r.type,
        options: JSON.parse(r.options || '[]'),
        isDefault: !!r.isDefault,
        required: !!r.required
      }));
      res.json(questions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/questions', requireAdmin, async (req, res) => {
    try {
      const questions = req.body;
      if (!Array.isArray(questions)) {
        return res.status(400).json({ error: "Неверный формат структуры вопросов" });
      }

      // Сохраняем в Firebase Firestore
      if (firestoreDb) {
        try {
          const oldSnap = await getDocs(collection(firestoreDb, 'questions'));
          const batch = writeBatch(firestoreDb);
          oldSnap.forEach(d => batch.delete(d.ref));
          for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const qDoc = doc(firestoreDb, 'questions', q.id);
            batch.set(qDoc, {
              id: q.id,
              text: q.text,
              type: q.type,
              options: q.options || [],
              isDefault: !!q.isDefault,
              required: !!q.required,
              order: i
            });
          }
          await batch.commit();
          console.log("🔥 Вопросы успешно обновлены в Firebase Firestore");
        } catch (fbSaveQErr) {
          console.error("Ошибка сохранения вопросов в Firebase Firestore:", fbSaveQErr);
        }
      }
      
      // Записываем в SQLite
      await db.run('BEGIN TRANSACTION');
      try {
        await db.run('DELETE FROM questions');
        for (const q of questions) {
          await db.run(
            'INSERT INTO questions (id, text, type, options, isDefault, required) VALUES (?, ?, ?, ?, ?, ?)',
            [q.id, q.text, q.type, JSON.stringify(q.options), q.isDefault ? 1 : 0, q.required ? 1 : 0]
          );
        }
        await db.run('COMMIT');
      } catch (err) {
        await db.run('ROLLBACK');
        throw err;
      }

      await logAction('Изменение вопросов', 'Обновлена структура полей и вопросов анкеты абитуриента');
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Журнал аудита
  app.get('/api/logs', requireAdmin, async (req, res) => {
    try {
      if (firestoreDb) {
        try {
          const logsSnap = await getDocs(collection(firestoreDb, 'logs'));
          if (!logsSnap.empty) {
            const logs = logsSnap.docs.map(d => d.data());
            logs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            return res.json(logs.slice(0, 1000));
          }
        } catch (fbLogErr) {
          console.warn("Сбой чтения логов из Firebase, переключение на SQLite:", fbLogErr);
        }
      }

      const rows = await db.all('SELECT timestamp, action, details FROM logs ORDER BY id DESC LIMIT 1000');
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Резервное копирование - Список
  app.get('/api/submissions/backups', requireAdmin, async (req, res) => {
    try {
      const files = await fs.promises.readdir(BACKUPS_DIR);
      const backups = [];
      for (const f of files) {
        if (f.startsWith('backup_') && f.endsWith('.db')) {
          const filePath = path.join(BACKUPS_DIR, f);
          const stat = await fs.promises.stat(filePath);
          backups.push({
            filename: f,
            createdAt: stat.mtime.toISOString(),
            size: stat.size,
            sizeFormatted: (stat.size / 1024).toFixed(1) + ' KB'
          });
        }
      }
      backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(backups);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Резервное копирование - Создать (копируем файл SQLite базы данных)
  app.post('/api/submissions/backup', requireAdmin, async (req, res) => {
    try {
      const dbFile = path.join(DATA_DIR, 'database.sqlite');
      if (!fs.existsSync(dbFile)) {
        return res.status(400).json({ error: "База данных пуста или отсутствует." });
      }
      const dateStr = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
      const backupFilename = `backup_${dateStr}.db`;
      const backupPath = path.join(BACKUPS_DIR, backupFilename);
      
      // Копируем файл базы данных SQLite напрямую
      await fs.promises.copyFile(dbFile, backupPath);
      await logAction('Резервное копирование', `Создана резервная копия БД анкет: ${backupFilename}`);
      res.json({ success: true, filename: backupFilename });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Резервное копирование - Восстановить
  app.post('/api/submissions/restore', requireAdmin, async (req, res) => {
    try {
      const { filename } = req.body;
      if (!filename) {
        return res.status(400).json({ error: "Параметр filename обязателен" });
      }
      
      const safeFilename = path.basename(filename);
      const backupPath = path.resolve(path.join(BACKUPS_DIR, safeFilename));
      if (!backupPath.startsWith(path.resolve(BACKUPS_DIR))) {
        return res.status(400).json({ error: "Недопустимое имя файла или попытка обхода каталога" });
      }
      
      if (!fs.existsSync(backupPath)) {
        return res.status(404).json({ error: "Файл резервной копии не найден" });
      }
      
      // Закрываем текущую базу данных перед копированием поверх нее
      if (db) {
        await db.close();
      }

      const dbFile = path.join(DATA_DIR, 'database.sqlite');
      // Сначала создаем автоматический бэкап текущего состояния перед восстановлением
      if (fs.existsSync(dbFile)) {
        const safetyFilename = `backup_before_restore_${Date.now()}.db`;
        await fs.promises.copyFile(dbFile, path.join(BACKUPS_DIR, safetyFilename));
      }

      await fs.promises.copyFile(backupPath, dbFile);

      // Заново инициализируем базу данных
      await initDatabase();

      await logAction('Восстановление БД', `База данных анкет восстановлена из резервной копии: ${safeFilename}`);
      res.json({ success: true });
    } catch (err: any) {
      // Пытаемся восстановить соединение в случае падения
      try {
        await initDatabase();
      } catch (ex) {}
      res.status(500).json({ error: err.message });
    }
  });

  // Резервное копирование - Удалить
  app.delete('/api/submissions/backups/:filename', requireAdmin, async (req, res) => {
    try {
      const { filename } = req.params;
      if (!filename) {
        return res.status(400).json({ error: "Параметр filename обязателен" });
      }

      const safeFilename = path.basename(filename);
      const backupPath = path.resolve(path.join(BACKUPS_DIR, safeFilename));
      if (!backupPath.startsWith(path.resolve(BACKUPS_DIR))) {
        return res.status(400).json({ error: "Недопустимое имя файла или попытка обхода каталога" });
      }

      if (fs.existsSync(backupPath)) {
        await fs.promises.unlink(backupPath);
        await logAction('Удаление бэкапа', `Удален файл резервной копии: ${safeFilename}`);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Файл резервной копии не найден" });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Раздача клиентской части (SPA)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const HOST = '0.0.0.0';
  app.listen(PORT, HOST, () => {
    console.log(`Сервер запущен на http://${HOST}:${PORT}`);
  });
}

startServer();
