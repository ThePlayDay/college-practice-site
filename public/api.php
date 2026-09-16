<?php
/**
 * PHP API бэкенд для анкетирования НЭК
 * Обеспечивает синхронизацию между устройствами на стандартных хостингах cPanel.
 * Использует надежную базу данных SQLite.
 */

// Задаем заголовок JSON
header("Content-Type: application/json; charset=utf-8");

// Предотвращаем агрессивное кэширование GET-результатов мобильными устройствами и браузерами
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

// Сохраняем системные переменные окружения, если они есть
$system_encryption_secret = getenv('ENCRYPTION_SECRET') ?: '';
$system_admin_login = getenv('ADMIN_LOGIN') ?: '';
$system_admin_password_hash = getenv('ADMIN_PASSWORD_HASH') ?: '';
$system_server_secret = getenv('SERVER_SECRET') ?: '';
$system_app_url = getenv('APP_URL') ?: '';

$env_encryption_secret = '';
$env_admin_login = '';
$env_admin_password_hash = '';
$env_server_secret = '';
$env_app_url = '';

// Загрузка файла .env (простая реализация для PHP)
$envFilePath = '';
if (file_exists(__DIR__ . '/../.env')) {
    $envFilePath = __DIR__ . '/../.env';
} elseif (file_exists(__DIR__ . '/.env')) {
    $envFilePath = __DIR__ . '/.env';
}

if ($envFilePath) {
    $envLines = file($envFilePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($envLines as $line) {
        if (strpos(trim($line), '#') === 0 || strpos($line, '=') === false) continue;
        list($name, $value) = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value, " \t\n\r\0\x0B\"'");
        
        if ($name === 'ENCRYPTION_SECRET') $env_encryption_secret = $value;
        elseif ($name === 'ADMIN_LOGIN') $env_admin_login = $value;
        elseif ($name === 'ADMIN_PASSWORD_HASH') $env_admin_password_hash = $value;
        elseif ($name === 'SERVER_SECRET') $env_server_secret = $value;
        elseif ($name === 'APP_URL') $env_app_url = $value;
    }
}

// Приоритеты для текущего использования: локальный .env файл имеет приоритет над системными переменными
$secret_passphrase = $env_encryption_secret ?: $system_encryption_secret ?: '';
$admin_login = $env_admin_login ?: $system_admin_login ?: '';
$admin_password_hash = $env_admin_password_hash ?: $system_admin_password_hash ?: '';
$server_secret = $env_server_secret ?: $system_server_secret ?: '';
$app_url = $env_app_url ?: $system_app_url ?: '';

// Валидация обязательных переменных окружения (в соответствии с требованиями аудита безопасности)
$missing_vars = [];
if (!$admin_login) $missing_vars[] = 'ADMIN_LOGIN';
if (!$admin_password_hash) $missing_vars[] = 'ADMIN_PASSWORD_HASH';
if (!$server_secret) $missing_vars[] = 'SERVER_SECRET';
if (!$secret_passphrase) $missing_vars[] = 'ENCRYPTION_SECRET';

if (!empty($missing_vars)) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Critical Configuration Error: Missing environment variables: ' . implode(', ', $missing_vars) . '. Please configure .env file.'
    ]);
    exit;
}

// Защита CORS: Источники по белому списку из .env (параметр APP_URL)
if (isset($_SERVER['HTTP_ORIGIN'])) {
    $origin = $_SERVER['HTTP_ORIGIN'];
    $clean_app_url = rtrim($app_url, '/');
    $clean_origin = rtrim($origin, '/');
    
    $origin_host = @parse_url($origin, PHP_URL_HOST);
    $current_host_parts = isset($_SERVER['HTTP_HOST']) ? explode(':', $_SERVER['HTTP_HOST']) : [''];
    $current_host = $current_host_parts[0];
    
    // Разрешаем localhost для разработки и отладки
    $is_localhost = (strpos($clean_origin, 'http://localhost') === 0 || strpos($clean_origin, 'http://127.0.0.1') === 0);
    
    // Разрешаем запросы с того же самого хоста (домена), на котором работает API
    $is_same_host = ($origin_host && $current_host && strtolower($origin_host) === strtolower($current_host));
    
    // Разрешаем временные домены AI Studio / Cloud Run (только если APP_URL не настроен на кастомный домен в продакшене)
    $is_ai_studio = ($origin_host && (strpos(strtolower($origin_host), '.run.app') !== false || strpos(strtolower($origin_host), '.aistudio.google') !== false));
    $is_custom_domain = ($app_url && strpos($app_url, '.run.app') === false && strpos($app_url, '.aistudio.google') === false);
    if ($is_custom_domain && $is_ai_studio && strcasecmp($clean_origin, $clean_app_url) !== 0) {
        $is_ai_studio = false;
    }
    
    if ($clean_origin === $clean_app_url || $is_localhost || $is_same_host || $is_ai_studio) {
        header("Access-Control-Allow-Origin: " . $origin);
        header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
        header("Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE");
        header("Access-Control-Allow-Credentials: true");
    } else {
        http_response_code(403);
        echo json_encode(["error" => "CORS Policy: Origin not allowed."]);
        exit;
    }
} else {
    if ($app_url) {
        header("Access-Control-Allow-Origin: " . rtrim($app_url, '/'));
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Защитные заголовки Content-Security-Policy в продакшене
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("X-XSS-Protection: 1; mode=block");
header("Referrer-Policy: strict-origin-when-cross-origin");

// Настройка директории данных
$data_dir = __DIR__ . '/../data';
if (file_exists(__DIR__ . '/data') || !is_writable(dirname($data_dir)) || (!file_exists($data_dir) && !@mkdir($data_dir, 0755, true))) {
    $data_dir = __DIR__ . '/data';
}
if (!file_exists($data_dir)) {
    @mkdir($data_dir, 0755, true);
}

$backups_dir = $data_dir . '/backups';
if (!file_exists($backups_dir)) {
    @mkdir($backups_dir, 0755, true);
}

// Инициализация SQLite базы данных через PDO
$db_file = $data_dir . '/database.sqlite';
$db = null;
try {
    $db = new PDO("sqlite:" . $db_file);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $db->exec("PRAGMA foreign_keys = ON;");
    $db->exec("PRAGMA journal_mode = WAL;");
    
    // Создаем таблицы, если они отсутствуют
    $db->exec("
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
    ");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_submissions_applicantName ON submissions(applicantName);");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_submissions_submittedAt ON submissions(submittedAt);");

    $db->exec("
        CREATE TABLE IF NOT EXISTS questions (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            type TEXT NOT NULL,
            options TEXT,
            isDefault INTEGER NOT NULL,
            required INTEGER NOT NULL
        );
    ");

    $db->exec("
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            action TEXT NOT NULL,
            details TEXT NOT NULL
        );
    ");

    $db->exec("
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            expiresAt INTEGER NOT NULL
        );
    ");

    $db->exec("
        CREATE TABLE IF NOT EXISTS captchas (
            id TEXT PRIMARY KEY,
            num1 INTEGER NOT NULL,
            num2 INTEGER NOT NULL,
            answer INTEGER NOT NULL,
            expiresAt INTEGER NOT NULL
        );
    ");

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed: " . $e->getMessage()]);
    exit;
}

// Получение заголовка авторизации
function getAuthorizationHeader() {
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (isset($headers['Authorization'])) {
            return $headers['Authorization'];
        }
        if (isset($headers['authorization'])) {
            return $headers['authorization'];
        }
    }
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        return $_SERVER['HTTP_AUTHORIZATION'];
    }
    if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    return null;
}

// Система ведения журналов аудита в SQLite
function logActionPHP($db, $action, $details) {
    try {
        $stmt = $db->prepare("INSERT INTO logs (timestamp, action, details) VALUES (?, ?, ?)");
        $stmt->execute([
            date('Y-m-d\TH:i:sP'),
            $action,
            $details
        ]);
    } catch (Exception $e) {}
}

// Проверка прав администратора на основе динамических сессий в SQLite
function requireAdminPHP($db) {
    $authHeader = getAuthorizationHeader();
    if (!$authHeader) {
        http_response_code(401);
        echo json_encode(['error' => 'Неавторизованный запрос: отсутствует заголовок авторизации']);
        exit;
    }
    $token = strpos($authHeader, 'Bearer ') === 0 ? substr($authHeader, 7) : $authHeader;
    
    $now = time() * 1000;
    
    // Очищаем просроченные сессии
    try {
        $db->prepare("DELETE FROM sessions WHERE expiresAt < ?")->execute([$now]);
    } catch (Exception $e) {}

    // Ищем активную сессию
    $stmt = $db->prepare("SELECT username, expiresAt FROM sessions WHERE token = ?");
    $stmt->execute([$token]);
    $session = $stmt->fetch();
    
    if (!$session) {
        http_response_code(401);
        echo json_encode(['error' => 'Неверный токен авторизации или сессия истекла']);
        exit;
    }
    
    // Продлеваем сессию на 2 часа
    $newExpires = (time() + 2 * 60 * 60) * 1000;
    $db->prepare("UPDATE sessions SET expiresAt = ? WHERE token = ?")->execute([$newExpires, $token]);
}

// Ограничение частоты запросов (Rate Limiting) на файлах для cPanel
function checkRateLimitPHP($data_dir, $ip, $max, $window) {
    $limit_dir = $data_dir . '/limits';
    if (!file_exists($limit_dir)) {
        @mkdir($limit_dir, 0755, true);
    }
    $ip_file = $limit_dir . '/' . md5($ip) . '.json';
    $now = time();
    if (file_exists($ip_file)) {
        $data = json_decode(@file_get_contents($ip_file), true);
        if (is_array($data) && $now < $data['resetTime']) {
            $data['count']++;
            @file_put_contents($ip_file, json_encode($data));
            if ($data['count'] > $max) {
                http_response_code(429);
                echo json_encode(['error' => 'Слишком много запросов. Пожалуйста, попробуйте позже.']);
                exit;
            }
            return;
        }
    }
    $data = ['count' => 1, 'resetTime' => $now + $window];
    @file_put_contents($ip_file, json_encode($data));
}

// Выполнение политики хранения данных (Retention Policy)
function runRetentionPolicyPHP($db, $backups_dir) {
    try {
        $oneYearAgoTime = time() - (365 * 24 * 60 * 60);
        $thresholdIso = date('Y-m-d\TH:i:sP', $oneYearAgoTime);
        $nowMs = time() * 1000;

        // Находим количество старых записей
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM submissions WHERE submittedAt < ?");
        $stmt->execute([$thresholdIso]);
        $row = $stmt->fetch();
        $deletedCount = $row ? (int)$row['count'] : 0;

        if ($deletedCount > 0) {
            // Удаляем анкеты старше 1 года
            $db->prepare("DELETE FROM submissions WHERE submittedAt < ?")->execute([$thresholdIso]);
            // Очищаем связанные логи аудита старше 1 года
            $db->prepare("DELETE FROM logs WHERE timestamp < ?")->execute([$thresholdIso]);

            // Удаляем устаревшие резервные копии базы данных
            if (file_exists($backups_dir)) {
                $files = scandir($backups_dir);
                foreach ($files as $f) {
                    if ($f === '.' || $f === '..') continue;
                    $filePath = $backups_dir . '/' . $f;
                    if (filemtime($filePath) < $oneYearAgoTime) {
                        @unlink($filePath);
                        logActionPHP($db, 'Удаление старого бэкапа', "Автоматическое удаление устаревшей резервной копии: " . $f);
                    }
                }
            }

            logActionPHP($db, 'Retention Policy', "Запуск очистки данных. Автоматически удалено устаревших анкет: " . $deletedCount);
        }

        // Чистим просроченные сессии и капчи
        $db->prepare("DELETE FROM sessions WHERE expiresAt < ?")->execute([$nowMs]);
        $db->prepare("DELETE FROM captchas WHERE expiresAt < ?")->execute([$nowMs]);

    } catch (Exception $e) {
        logActionPHP($db, 'Retention Error', "Ошибка выполнения очистки: " . $e->getMessage());
    }
}

$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';
$ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';

try {
    // Автоматический запуск retention на каждом 100-м запросе (рандомизированный сбор мусора в PHP)
    if (rand(1, 100) === 50) {
        runRetentionPolicyPHP($db, $backups_dir);
    }

    // Вопросы по умолчанию
    $default_questions = [
        [
            'id' => 'source',
            'text' => 'Из каких источников Вы узнали о нашем колледже?',
            'type' => 'select',
            'options' => ['От друзей, родственников', 'От представителей колледжа', 'Интернет', 'Учебная Сибирь', 'Другое'],
            'isDefault' => true,
            'required' => true,
        ],
        [
            'id' => 'influence',
            'text' => 'Что повлияло на Ваш выбор?',
            'type' => 'select',
            'options' => ['Интерес к выбранной специальности (профессии)', 'Мнение друзей, родственников', 'Место положение (рядом с домом)', 'Наличие общежития', 'Другое'],
            'isDefault' => true,
            'required' => true,
        ],
        [
            'id' => 'activity',
            'text' => 'Выберите направление, в котором готовы участвовать:',
            'type' => 'select',
            'options' => ['Спортивное', 'Творческое (рисование, музыка, песни и т.д.)', 'Патриотическое', 'Волонтерское', 'Студенческое самоуправление'],
            'isDefault' => true,
            'required' => true,
        ],
        [
            'id' => 'residence',
            'text' => 'Ваше место жительства',
            'type' => 'select',
            'options' => ['Новосибирск, Первомайский район', 'Новосибирск, Другие районы', 'Новосибирская область', 'Другие регионы Российской Федерации'],
            'isDefault' => true,
            'required' => true,
        ]
    ];

    // Наполнение начальными вопросами в SQLite, если таблица пуста
    $qCount = $db->query("SELECT COUNT(*) as count FROM questions")->fetch();
    if ($qCount && (int)$qCount['count'] === 0) {
        $stmt = $db->prepare("INSERT INTO questions (id, text, type, options, isDefault, required) VALUES (?, ?, ?, ?, ?, ?)");
        foreach ($default_questions as $q) {
            $stmt->execute([
                $q['id'],
                $q['text'],
                $q['type'],
                json_encode($q['options'], JSON_UNESCAPED_UNICODE),
                $q['isDefault'] ? 1 : 0,
                $q['required'] ? 1 : 0
            ]);
        }
    }

    if ($method === 'POST') {
        $rawInput = file_get_contents('php://input');
        $input = json_decode($rawInput, true) ?: [];

        // 1. ПОЛУЧЕНИЕ КАПЧИ (Доступно всем)
        if ($action === 'captcha' || (isset($input['action']) && $input['action'] === 'captcha')) {
            checkRateLimitPHP($data_dir, $ip, 30, 60);
            $id = bin2hex(random_bytes(16));
            $num1 = rand(2, 10);
            $num2 = rand(2, 10);
            $answer = $num1 + $num2;
            $expiresAt = (time() + 10 * 60) * 1000; // TTL 10 минут

            $stmt = $db->prepare("INSERT INTO captchas (id, num1, num2, answer, expiresAt) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$id, $num1, $num2, $answer, $expiresAt]);

            echo json_encode(['id' => $id, 'num1' => $num1, 'num2' => $num2]);
            exit;
        }

        // 2. ВХОД АДМИНИСТРАТОРА (RATE LIMIT 5 в минуту)
        if ($action === 'login' || (isset($input['action']) && $input['action'] === 'login')) {
            checkRateLimitPHP($data_dir, $ip, 5, 60);
            $login_input = isset($input['login']) ? trim($input['login']) : '';
            $password_input = isset($input['password']) ? trim($input['password']) : '';
            
            if (!$login_input || !$password_input) {
                http_response_code(400);
                echo json_encode(['error' => 'Поля логин и пароль обязательны']);
                exit;
            }

            $isLoginValid = false;
            if ($login_input === $admin_login) {
                if (strpos($admin_password_hash, '$2y$') === 0 || strpos($admin_password_hash, '$2a$') === 0 || strpos($admin_password_hash, '$2b$') === 0) {
                    $isLoginValid = password_verify($password_input, $admin_password_hash);
                } else {
                    $hashedInput = hash_hmac('sha512', $password_input, 'nemk_salt_2026');
                    $isLoginValid = hash_equals($admin_password_hash, $hashedInput) || ($password_input === $admin_password_hash);
                }
            }
            
            if ($isLoginValid) {
                logActionPHP($db, 'Логин', 'Успешная авторизация администратора');
                
                // Генерируем случайный токен сессии
                $token = bin2hex(random_bytes(32));
                $expiresAt = (time() + 2 * 60 * 60) * 1000;
                
                $stmt = $db->prepare("INSERT INTO sessions (token, username, expiresAt) VALUES (?, ?, ?)");
                $stmt->execute([$token, $login_input, $expiresAt]);
                
                echo json_encode(['token' => $token]);
            } else {
                logActionPHP($db, 'Сбой логина', "Попытка входа под логином \"{$login_input}\" с неверным паролем");
                http_response_code(401);
                echo json_encode(['error' => 'Неверный логин или пароль']);
            }
            exit;
        }

        // 3. ВЫХОД АДМИНИСТРАТОРА
        if ($action === 'logout' || (isset($input['action']) && $input['action'] === 'logout')) {
            $authHeader = getAuthorizationHeader();
            if ($authHeader) {
                $token = strpos($authHeader, 'Bearer ') === 0 ? substr($authHeader, 7) : $authHeader;
                $db->prepare("DELETE FROM sessions WHERE token = ?")->execute([$token]);
            }
            logActionPHP($db, 'Выход', 'Администратор вышел из системы');
            echo json_encode(['success' => true]);
            exit;
        }

        // 4. ОЧИСТКА БАЗЫ ДАННЫХ
        if ($action === 'clear' || (isset($input['action']) && $input['action'] === 'clear')) {
            requireAdminPHP($db);
            $db->exec("DELETE FROM submissions");
            logActionPHP($db, 'Очистка БД', 'Успешно произведена полная очистка базы данных анкет');
            echo json_encode(['success' => true]);
            exit;
        }

        // 5. MANUAL RETENTION
        if ($action === 'retention' || (isset($input['action']) && $input['action'] === 'retention')) {
            requireAdminPHP($db);
            runRetentionPolicyPHP($db, $backups_dir);
            echo json_encode(['success' => true, 'message' => 'Политика очистки успешно выполнена вручную.']);
            exit;
        }

        // 6. BACKUP - Создание бэкапа (Копирование файла SQLite базы данных)
        if ($action === 'backup' || (isset($input['action']) && $input['action'] === 'backup')) {
            requireAdminPHP($db);
            if (!file_exists($db_file)) {
                http_response_code(400);
                echo json_encode(['error' => 'База данных отсутствует для резервного копирования']);
                exit;
            }
            $dateStr = date('Y-m-d_H-i-s');
            $backupFilename = "backup_{$dateStr}.db";
            $backupPath = $backups_dir . '/' . $backupFilename;
            
            if (!@copy($db_file, $backupPath)) {
                http_response_code(500);
                echo json_encode(['error' => 'Не удалось скопировать файл базы данных. Проверьте права на data/backups/']);
                exit;
            }
            
            logActionPHP($db, 'Резервное копирование', "Создана резервная копия БД анкет: {$backupFilename}");
            echo json_encode(['success' => true, 'filename' => $backupFilename]);
            exit;
        }

        // 7. RESTORE - Восстановление бэкапа
        if ($action === 'restore' || (isset($input['action']) && $input['action'] === 'restore')) {
            requireAdminPHP($db);
            $filename = isset($input['filename']) ? basename($input['filename']) : '';
            if (!$filename && isset($_GET['filename'])) {
                $filename = basename($_GET['filename']);
            }
            
            if (!$filename) {
                http_response_code(400);
                echo json_encode(['error' => 'Параметр filename обязателен']);
                exit;
            }

            $safe_filename = basename($filename);
            $backupPath = realpath($backups_dir . '/' . $safe_filename);
            $real_backups_dir = realpath($backups_dir);

            if ($backupPath === false || strpos($backupPath, $real_backups_dir) !== 0) {
                http_response_code(400);
                echo json_encode(['error' => 'Недопустимое имя файла или попытка обхода каталога']);
                exit;
            }

            if (!file_exists($backupPath)) {
                http_response_code(404);
                echo json_encode(['error' => 'Файл резервной копии не найден']);
                exit;
            }

            // Закрываем PDO соединение перед заменой файла базы данных
            $db = null;

            if (file_exists($db_file)) {
                $safetyFilename = "backup_before_restore_" . time() . ".db";
                @copy($db_file, $backups_dir . '/' . $safetyFilename);
            }
            
            if (!@copy($backupPath, $db_file)) {
                http_response_code(500);
                echo json_encode(['error' => 'Не удалось восстановить базу данных.']);
                exit;
            }

            // Заново открываем PDO соединение
            $db = new PDO("sqlite:" . $db_file);
            $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

            logActionPHP($db, 'Восстановление БД', "База данных анкет восстановлена из резервной копии: {$safe_filename}");
            echo json_encode(['success' => true]);
            exit;
        }

        // 8. QUESTIONS - Сохранение вопросов
        if ($action === 'questions' || (isset($input['action']) && $input['action'] === 'questions')) {
            requireAdminPHP($db);
            $questions = isset($input['questions']) ? $input['questions'] : $input;
            if (!is_array($questions)) {
                http_response_code(400);
                echo json_encode(['error' => 'Неверный формат структуры вопросов']);
                exit;
            }
            
            $db->beginTransaction();
            try {
                $db->exec("DELETE FROM questions");
                $stmt = $db->prepare("INSERT INTO questions (id, text, type, options, isDefault, required) VALUES (?, ?, ?, ?, ?, ?)");
                foreach ($questions as $q) {
                    $stmt->execute([
                        $q['id'],
                        $q['text'],
                        $q['type'],
                        json_encode($q['options'], JSON_UNESCAPED_UNICODE),
                        $q['isDefault'] ? 1 : 0,
                        $q['required'] ? 1 : 0
                    ]);
                }
                $db->commit();
            } catch (Exception $e) {
                $db->rollBack();
                http_response_code(500);
                echo json_encode(['error' => 'Не удалось сохранить вопросы: ' . $e->getMessage()]);
                exit;
            }

            logActionPHP($db, 'Изменение вопросов', 'Обновлена структура полей и вопросов анкеты абитуриента');
            echo json_encode(['success' => true]);
            exit;
        }

        // 9. DELETE BACKUP
        if ($action === 'delete-backup' || (isset($input['action']) && $input['action'] === 'delete-backup')) {
            requireAdminPHP($db);
            $filename = isset($_GET['filename']) ? basename($_GET['filename']) : '';
            if (!$filename && isset($input['filename'])) {
                $filename = basename($input['filename']);
            }
            
            if (!$filename) {
                http_response_code(400);
                echo json_encode(['error' => 'Параметр filename обязателен']);
                exit;
            }

            $safe_filename = basename($filename);
            $backupPath = realpath($backups_dir . '/' . $safe_filename);
            $real_backups_dir = realpath($backups_dir);

            if ($backupPath === false || strpos($backupPath, $real_backups_dir) !== 0) {
                http_response_code(400);
                echo json_encode(['error' => 'Недопустимое имя файла или попытка обхода каталога']);
                exit;
            }

            if (file_exists($backupPath)) {
                @unlink($backupPath);
                logActionPHP($db, 'Удаление бэкапа', "Удален файл резервной копии: {$safe_filename}");
                echo json_encode(['success' => true]);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Файл резервной копии не найден']);
            }
            exit;
        }

        // 10. DELETE SUBMISSION (для туннелирования POST)
        if ($action === 'delete' || (isset($input['action']) && $input['action'] === 'delete')) {
            requireAdminPHP($db);
            $id = isset($_GET['id']) ? $_GET['id'] : '';
            if (!$id && isset($input['id'])) {
                $id = $input['id'];
            }
            if ($id) {
                $stmt = $db->prepare("SELECT applicantName FROM submissions WHERE id = ?");
                $stmt->execute([$id]);
                $target = $stmt->fetch();
                if ($target) {
                    $db->prepare("DELETE FROM submissions WHERE id = ?")->execute([$id]);
                    logActionPHP($db, 'Удаление анкеты', "Удалена анкета абитуриента \"{$target['applicantName']}\"");
                    echo json_encode(['success' => true]);
                } else {
                    http_response_code(404);
                    echo json_encode(['error' => 'Анкета не найдена']);
                }
            } else {
                http_response_code(400);
                echo json_encode(['error' => 'Отсутствует ID для удаления']);
            }
            exit;
        }

        // 11. СОЗДАНИЕ АНКЕТЫ (Публичный экшн по умолчанию для POST)
        checkRateLimitPHP($data_dir, $ip, 10, 60);

        // Проверка согласия на ПДн
        $consent = isset($input['consent']) ? $input['consent'] : false;
        if ($consent !== true && $consent !== 'true') {
            http_response_code(400);
            echo json_encode(['error' => 'Согласие на обработку персональных данных обязательно для подачи анкеты.']);
            exit;
        }

        // Серверная проверка Challenge математической капчи
        $captchaId = isset($input['captchaId']) ? $input['captchaId'] : '';
        $captchaAnswer = isset($input['captchaAnswer']) ? (int)$input['captchaAnswer'] : 0;
        
        if (!$captchaId) {
            http_response_code(400);
            echo json_encode(['error' => 'Запрос отклонен: отсутствует challenge капчи.']);
            exit;
        }

        // Вытаскиваем капчу из базы
        $stmt = $db->prepare("SELECT answer, expiresAt FROM captchas WHERE id = ?");
        $stmt->execute([$captchaId]);
        $challenge = $stmt->fetch();

        if (!$challenge) {
            http_response_code(400);
            echo json_encode(['error' => 'Запрос отклонен: неверный или недействительный challenge капчи.']);
            exit;
        }

        // Удаляем капчу для одноразовости
        $db->prepare("DELETE FROM captchas WHERE id = ?")->execute([$captchaId]);

        if ($challenge['expiresAt'] < (time() * 1000)) {
            http_response_code(400);
            echo json_encode(['error' => 'Срок действия капчи истек. Пожалуйста, попробуйте снова.']);
            exit;
        }

        if ($captchaAnswer !== (int)$challenge['answer']) {
            http_response_code(400);
            echo json_encode(['error' => 'Неверный ответ на математическую проверку от роботов.']);
            exit;
        }

        $applicantName = isset($input['applicantName']) ? trim($input['applicantName']) : '';
        $referrerName = isset($input['referrerName']) ? trim($input['referrerName']) : '';

        if (!$applicantName || !$referrerName) {
            http_response_code(400);
            echo json_encode(['error' => 'Обязательные поля ФИО абитуриента и ФИО рекомендателя отсутствуют']);
            exit;
        }

        // Дополнительная валидация ФИО (минимум 2 слова, только кириллица и пробелы/дефисы)
        $cleanName = $applicantName;
        $nameParts = preg_split('/\s+/', $cleanName);
        $cyrillicRegex = '/^[А-Яа-яЁё\s\-]+$/u';
        if (count($nameParts) < 2 || !preg_match($cyrillicRegex, $cleanName)) {
            http_response_code(400);
            echo json_encode(['error' => 'Неверный формат ФИО. ФИО должно содержать фамилию и имя на русском языке.']);
            exit;
        }

        // Лимит 5000 абитуриентов
        $countRow = $db->query("SELECT COUNT(*) as count FROM submissions")->fetch();
        if ($countRow && (int)$countRow['count'] >= 5000) {
            http_response_code(400);
            echo json_encode(['error' => 'Достигнут лимит в 5000 абитуриентов. Прием новых анкет временно приостановлен.']);
            exit;
        }

        // Проверка на дубликат без утечки оракула ФИО
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM submissions WHERE LOWER(TRIM(applicantName)) = LOWER(TRIM(?))");
        $stmt->execute([$cleanName]);
        $dupRow = $stmt->fetch();
        $isDuplicate = $dupRow && (int)$dupRow['count'] > 0 ? 1 : 0;

        $submissionId = 'sub-' . round(microtime(true) * 1000) . '-' . bin2hex(random_bytes(4));
        $submittedAt = date('Y-m-d\TH:i:sP');
        $consentVersion = isset($input['consentVersion']) ? $input['consentVersion'] : '17.07.2026_site_4';
        $consentPurpose = "Проведение профориентационного анкетирования абитуриентов, определение каналов информирования, сбор статистики";
        $consentDataScope = "ФИО абитуриента, ФИО рекомендовавшего лица, его отношение к колледжу, ответы на вопросы";

        $stmt = $db->prepare("
            INSERT INTO submissions (
                id, applicantName, referrerName, referrerType, answers, submittedAt,
                consentGiven, consentAt, consentVersion, consentPurpose, consentDataScope, isDuplicate
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $submissionId,
            $cleanName,
            trim($referrerName),
            isset($input['referrerType']) ? $input['referrerType'] : null,
            json_encode(isset($input['answers']) ? $input['answers'] : (object)[], JSON_UNESCAPED_UNICODE),
            $submittedAt,
            1,
            $submittedAt,
            $consentVersion,
            $consentPurpose,
            $consentDataScope,
            $isDuplicate
        ]);

        echo json_encode([
            'id' => $submissionId,
            'applicantName' => $cleanName,
            'referrerName' => trim($referrerName),
            'referrerType' => isset($input['referrerType']) ? $input['referrerType'] : null,
            'answers' => isset($input['answers']) ? $input['answers'] : (object)[],
            'submittedAt' => $submittedAt,
            'consentGiven' => true,
            'consentAt' => $submittedAt,
            'consentVersion' => $consentVersion,
            'consentPurpose' => $consentPurpose,
            'consentDataScope' => $consentDataScope,
            'isDuplicate' => (bool)$isDuplicate
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($method === 'DELETE') {
        // DELETE BACKUP
        if (strpos($_SERVER['REQUEST_URI'], 'backups/') !== false) {
            requireAdminPHP($db);
            $filename = '';
            if (preg_match('/backups\/(.+)$/', $_SERVER['REQUEST_URI'], $m)) {
                $filename = basename($m[1]);
            }
            
            if (!$filename) {
                http_response_code(400);
                echo json_encode(['error' => 'Параметр filename обязателен']);
                exit;
            }

            $safe_filename = basename($filename);
            $backupPath = realpath($backups_dir . '/' . $safe_filename);
            $real_backups_dir = realpath($backups_dir);

            if ($backupPath === false || strpos($backupPath, $real_backups_dir) !== 0) {
                http_response_code(400);
                echo json_encode(['error' => 'Недопустимое имя файла или попытка обхода каталога']);
                exit;
            }

            if (file_exists($backupPath)) {
                @unlink($backupPath);
                logActionPHP($db, 'Удаление бэкапа', "Удален файл резервной копии: {$safe_filename}");
                echo json_encode(['success' => true]);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Файл резервной копии не найден']);
            }
            exit;
        }

        // DELETE SUBMISSION
        requireAdminPHP($db);
        $id = '';
        if (preg_match('/submissions\/(.+)$/', $_SERVER['REQUEST_URI'], $m)) {
            $id = $m[1];
        }
        if ($id) {
            $stmt = $db->prepare("SELECT applicantName FROM submissions WHERE id = ?");
            $stmt->execute([$id]);
            $target = $stmt->fetch();
            if ($target) {
                $db->prepare("DELETE FROM submissions WHERE id = ?")->execute([$id]);
                logActionPHP($db, 'Удаление анкеты', "Удалена анкета абитуриента \"{$target['applicantName']}\"");
                echo json_encode(['success' => true]);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Анкета не найдена']);
            }
        } else {
            http_response_code(400);
            echo json_encode(['error' => 'Отсутствует ID для удаления']);
        }
        exit;
    }

    if ($method === 'GET') {
        // GET QUESTIONS (Публичный)
        if ($action === 'questions') {
            $rows = $db->query("SELECT * FROM questions")->fetchAll();
            $questions = [];
            foreach ($rows as $r) {
                $questions[] = [
                    'id' => $r['id'],
                    'text' => $r['text'],
                    'type' => $r['type'],
                    'options' => json_decode($r['options'], true) ?: [],
                    'isDefault' => (bool)$r['isDefault'],
                    'required' => (bool)$r['required']
                ];
            }
            echo json_encode($questions, JSON_UNESCAPED_UNICODE);
            exit;
        }

        // Все остальные GET требуют авторизации
        requireAdminPHP($db);

        // GET LOGS
        if ($action === 'logs') {
            $rows = $db->query("SELECT timestamp, action, details FROM logs ORDER BY id DESC LIMIT 1000")->fetchAll();
            echo json_encode($rows, JSON_UNESCAPED_UNICODE);
            exit;
        }

        // GET BACKUPS
        if ($action === 'backups') {
            $files = scandir($backups_dir);
            $backups = [];
            foreach ($files as $f) {
                if (strpos($f, 'backup_') === 0 && strpos($f, '.db') !== false) {
                     $filePath = $backups_dir . '/' . $f;
                     $size = filesize($filePath);
                     $backups[] = [
                         'filename' => $f,
                         'createdAt' => date('c', filemtime($filePath)),
                         'size' => $size,
                         'sizeFormatted' => round($size / 1024, 1) . ' KB'
                     ];
                }
            }
            usort($backups, function($a, $b) {
                return strtotime($b['createdAt']) - strtotime($a['createdAt']);
            });
            echo json_encode($backups, JSON_UNESCAPED_UNICODE);
            exit;
        }

        // GET SUBMISSIONS (по умолчанию)
        $rows = $db->query("SELECT * FROM submissions ORDER BY submittedAt DESC")->fetchAll();
        $submissions = [];
        foreach ($rows as $r) {
            $submissions[] = [
                'id' => $r['id'],
                'applicantName' => $r['applicantName'],
                'referrerName' => $r['referrerName'],
                'referrerType' => $r['referrerType'],
                'answers' => json_decode($r['answers'], true) ?: (object)[],
                'submittedAt' => $r['submittedAt'],
                'consentGiven' => (bool)$r['consentGiven'],
                'consentAt' => $r['consentAt'],
                'consentVersion' => $r['consentVersion'],
                'consentPurpose' => $r['consentPurpose'],
                'consentDataScope' => $r['consentDataScope'],
                'isDuplicate' => (bool)$r['isDuplicate']
            ];
        }
        echo json_encode($submissions, JSON_UNESCAPED_UNICODE);
        exit;
    }

    http_response_code(405);
    echo json_encode(['error' => 'Метод не поддерживается']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
