import { Question, Submission } from './types';

export async function checkIfApplicantNameExistsAsync(name: string): Promise<boolean> {
  // Для защиты персональных данных (ФЗ-152) публичная проверка уникальности ФИО полностью отключена.
  // Все проверки дубликатов выполняются безопасно на сервере после отправки анкеты.
  return false;
}

// Вопросы по умолчанию согласно требованиям ТЗ
export const DEFAULT_QUESTIONS: Question[] = [
  {
    id: 'source',
    text: 'Из каких источников Вы узнали о нашем колледже?',
    type: 'select',
    options: [
      'От друзей, родственников',
      'От представителей колледжа',
      'Интернет',
      'Учебная Сибирь',
      'Другое'
    ],
    isDefault: true,
    required: true,
  },
  {
    id: 'influence',
    text: 'Что повлияло на Ваш выбор?',
    type: 'select',
    options: [
      'Интерес к выбранной специальности (профессии)',
      'Мнение друзей, родственников',
      'Место положение (рядом с домом)',
      'Наличие общежития',
      'Другое'
    ],
    isDefault: true,
    required: true,
  },
  {
    id: 'activity',
    text: 'Выберите направление, в котором готовы участвовать:',
    type: 'select',
    options: [
      'Спортивное',
      'Творческое (рисование, музыка, песни и т.д.)',
      'Патриотическое',
      'Волонтерское',
      'Студенческое самоуправление'
    ],
    isDefault: true,
    required: true,
  },
  {
    id: 'residence',
    text: 'Ваше место жительства',
    type: 'select',
    options: [
      'Новосибирск, Первомайский район',
      'Новосибирск, Другие районы',
      'Новосибирская область',
      'Другие регионы Российской Федерации'
    ],
    isDefault: true,
    required: true,
  }
];

export function getStoredQuestions(): Question[] {
  const stored = localStorage.getItem('nemk_questions');
  if (stored) {
    try {
      let parsed = JSON.parse(stored) as Question[];
      
      // Проверяем наличие вопроса о месте жительства для совместимости схем данных
      const hasResidence = parsed.some((q: any) => q.id === 'residence');
      if (!hasResidence) {
        // Если вопроса нет, сбрасываем на значения по умолчанию с новым вопросом
        localStorage.setItem('nemk_questions', JSON.stringify(DEFAULT_QUESTIONS));
        return DEFAULT_QUESTIONS;
      }

      // Автоматическая капитализация всех вариантов ответов во всех сохраненных вопросах
      let hasUpdates = false;
      parsed = parsed.map(q => {
        if (q.options && q.options.length > 0) {
          const updatedOptions = q.options.map(opt => {
            if (opt && opt.length > 0) {
              const capitalized = opt.charAt(0).toUpperCase() + opt.slice(1);
              if (capitalized !== opt) {
                hasUpdates = true;
                return capitalized;
              }
            }
            return opt;
          });
          return { ...q, options: updatedOptions };
        }
        return q;
      });

      if (hasUpdates) {
        localStorage.setItem('nemk_questions', JSON.stringify(parsed));
      }

      return parsed;
    } catch (e) {
      console.error(e);
    }
  }
  // Перезаписываем старые вопросы новыми значениями DEFAULT_QUESTIONS
  localStorage.setItem('nemk_questions', JSON.stringify(DEFAULT_QUESTIONS));
  return DEFAULT_QUESTIONS;
}

export function saveStoredQuestions(questions: Question[]) {
  localStorage.setItem('nemk_questions', JSON.stringify(questions));
}

// Глобальный локальный кэш на случай сбоев сети или отсутствия подключения
let submissionsCache: Submission[] = [];
let usePhpApi = false; // Флаг для переключения на PHP API при возникновении ошибки 404 или сбоев

async function apiCall<T>(
  nodePath: string, 
  phpAction: string, 
  method: 'GET' | 'POST' | 'DELETE', 
  body?: any
): Promise<T> {
  // Предотвращаем кэширование GET-запросов браузером или промежуточным ПО
  const buster = `_t=${Date.now()}`;
  const nodeUrl = method === 'GET'
    ? (nodePath.includes('?') ? `${nodePath}&${buster}` : `${nodePath}?${buster}`)
    : nodePath;

  let phpUrl = phpAction ? `/api.php${phpAction}` : '/api.php';
  if (method === 'GET') {
    phpUrl = phpUrl.includes('?') ? `${phpUrl}&${buster}` : `${phpUrl}?${buster}`;
  }

  if (usePhpApi) {
    return callPhp<T>(phpUrl, method, body);
  }

  try {
    const headers: Record<string, string> = {};
    if (body) {
      headers['Content-Type'] = 'application/json';
    }
    const token = sessionStorage.getItem('nemk_admin_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(nodeUrl, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (response.status === 404) {
      usePhpApi = true;
      return callPhp<T>(phpUrl, method, body);
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errorMsg = errData.error || `Ошибка Node API: ${response.statusText}`;
      const semanticError = new Error(errorMsg);
      (semanticError as any).isSemantic = true;
      (semanticError as any).status = response.status;
      if (response.status === 401) {
        sessionStorage.removeItem('nemk_admin_token');
      }
      throw semanticError;
    }

    return await response.json();
  } catch (err: any) {
    if (err.isSemantic || (err.message && err.message.includes("лимит"))) {
      throw err;
    }
    console.warn("Сбой Node API, попытка обращения к PHP API:", err);
    try {
      const res = await callPhp<T>(phpUrl, method, body);
      usePhpApi = true;
      return res;
    } catch (phpErr: any) {
      if (phpErr && phpErr.status === 401) {
        sessionStorage.removeItem('nemk_admin_token');
        throw phpErr;
      }
      console.error("Сбои в обоих API (Node и PHP):", phpErr);
      throw phpErr;
    }
  }
}

async function callPhp<T>(url: string, method: 'GET' | 'POST' | 'DELETE', body?: any): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  const token = sessionStorage.getItem('nemk_admin_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const buster = `_t=${Date.now()}`;
  let finalUrl = url;
  let finalMethod = method;
  let finalBody = body;

  if (method === 'DELETE') {
    finalMethod = 'POST';
    // Гарантируем, что URL действия удаления содержит правильные параметры запроса и кэш-бастер
    if (url.includes('action=')) {
      finalUrl = url.includes('?') ? `${url}&${buster}` : `${url}?${buster}`;
    } else {
      finalUrl = `/api.php?action=delete&${buster}`;
    }
    finalBody = body;
  } else if (method === 'GET') {
    finalUrl = url.includes('?') ? `${url}&${buster}` : `${url}?${buster}`;
  }

  const response = await fetch(finalUrl, {
    method: finalMethod,
    headers,
    body: finalBody ? JSON.stringify(finalBody) : undefined
  });

  if (!response.ok) {
    const errText = await response.text();
    let errMsg = `Ошибка PHP API: ${response.statusText}`;
    try {
      const parsed = JSON.parse(errText);
      if (parsed.error) {
        errMsg = parsed.error;
      }
    } catch (e) {}
    const phpError = new Error(errMsg);
    (phpError as any).status = response.status;
    if (response.status === 401) {
      sessionStorage.removeItem('nemk_admin_token');
    }
    throw phpError;
  }

  return await response.json();
}

// Загрузка анкет из API сервера без сохранения в localStorage для защиты персональных данных (ФЗ-152)
export async function getStoredSubmissionsAsync(): Promise<Submission[]> {
  try {
    const docsList = await apiCall<Submission[]>('/api/submissions', '', 'GET');
    
    // Сортируем по убыванию даты отправки submittedAt для абсолютной уверенности в правильности порядка
    docsList.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    submissionsCache = docsList;
    return docsList;
  } catch (error: any) {
    const isAuthError = (error && error.status === 401) || (
      error && error.message && (
        error.message.includes("токен") || 
        error.message.includes("авторизац") || 
        error.message.includes("401") ||
        error.message.includes("отсутствует заголовок") ||
        error.message.includes("сессия")
      )
    );

    if (isAuthError) {
      sessionStorage.removeItem('nemk_admin_token');
      submissionsCache = [];
      throw error;
    }

    console.error("Ошибка при получении анкет с сервера через API:", error);
    return submissionsCache; // Возвращаем только то, что в памяти
  }
}

// Проверка активности и валидности сессионного токена администратора
export async function verifySessionAsync(): Promise<boolean> {
  const token = sessionStorage.getItem('nemk_admin_token');
  if (!token) return false;
  try {
    const res = await apiCall<{ ok: boolean }>('/api/check-session', '?action=check-session', 'GET');
    return !!(res && res.ok);
  } catch (e) {
    sessionStorage.removeItem('nemk_admin_token');
    submissionsCache = [];
    return false;
  }
}

// Загрузка списка вопросов с сервера для синхронизации на разных устройствах
export async function getStoredQuestionsAsync(): Promise<Question[]> {
  try {
    return await apiCall<Question[]>('/api/questions', '?action=questions', 'GET');
  } catch (error) {
    console.error("Ошибка при получении вопросов с сервера:", error);
    return DEFAULT_QUESTIONS;
  }
}

// Сохранение списка вопросов на сервере
export async function saveStoredQuestionsAsync(questions: Question[]): Promise<void> {
  try {
    await apiCall<any>('/api/questions', '?action=questions', 'POST', questions);
  } catch (error) {
    console.error("Ошибка при сохранении вопросов на сервере:", error);
    throw error;
  }
}

// Запрос математической капчи с сервера (Challenge-Response)
export async function getCaptchaChallenge(): Promise<{ id: string; num1: number; num2: number }> {
  try {
    return await apiCall<{ id: string; num1: number; num2: number }>('/api/captcha', '?action=captcha', 'GET');
  } catch (error) {
    console.error("Ошибка при получении капчи с сервера:", error);
    // На всякий случай возвращаем локальный fallback, но сервер все равно потребует валидный challenge
    return { id: 'fallback-' + Date.now(), num1: 2, num2: 2 };
  }
}

// Сохранение анкеты абитуриента в базу данных (без ограничений емкости)
export async function saveSubmissionAsync(submission: {
  applicantName: string;
  referrerName: string;
  referrerType?: 'student' | 'staff' | null;
  answers: { [qId: string]: string };
  consent: boolean;
  consentVersion: string;
  captchaId: string;
  captchaAnswer: number;
}): Promise<Submission> {
  try {
    const saved = await apiCall<Submission>('/api/submissions', '', 'POST', submission);

    // Обновляем локальный кэш в памяти
    submissionsCache.unshift(saved);

    return saved;
  } catch (error: any) {
    console.error("Ошибка сохранения анкеты на сервере через API:", error);
    throw error;
  }
}

// Удаление анкеты абитуриента через API сервера
export async function deleteSubmissionAsync(id: string): Promise<void> {
  try {
    await apiCall<any>(`/api/submissions/${id}`, '?action=delete', 'DELETE', { id });
    submissionsCache = submissionsCache.filter(s => s.id !== id);
  } catch (error) {
    console.error("Ошибка при удалении анкеты через API:", error);
    throw error;
  }
}

// Полная очистка всех анкет через API сервера
export async function clearAllSubmissionsAsync(): Promise<void> {
  try {
    await apiCall<any>('/api/submissions/clear', '?action=clear', 'POST');
    submissionsCache = [];
  } catch (error) {
    console.error("Ошибка при очистке анкет через API:", error);
    throw error;
  }
}

// Вспомогательные методы для журнала логов и резервного копирования
export async function getActionLogsAsync(): Promise<any[]> {
  return await apiCall<any[]>('/api/logs', '?action=logs', 'GET');
}

export async function getBackupsAsync(): Promise<any[]> {
  return await apiCall<any[]>('/api/submissions/backups', '?action=backups', 'GET');
}

export async function getBackupSettingsAsync(): Promise<{
  period: string;
  periodLabel: string;
  lastBackupTime: number | null;
  nextBackupTime: number | null;
}> {
  return await apiCall<any>('/api/submissions/backup-settings', '', 'GET');
}

export async function updateBackupSettingsAsync(period: string): Promise<{
  success: boolean;
  period: string;
  periodLabel: string;
  lastBackupTime: number | null;
  nextBackupTime: number | null;
}> {
  return await apiCall<any>('/api/submissions/backup-settings', '', 'POST', { period });
}

export async function createBackupAsync(): Promise<void> {
  await apiCall<any>('/api/submissions/backup', '?action=backup', 'POST');
}

export async function restoreBackupAsync(filename: string): Promise<void> {
  await apiCall<any>('/api/submissions/restore', '?action=restore', 'POST', { filename });
}

export async function deleteBackupAsync(filename: string): Promise<void> {
  await apiCall<any>(`/api/submissions/backups/${filename}`, `?action=delete-backup&filename=${filename}`, 'DELETE', { filename });
}

export async function getDbStatusAsync(): Promise<{
  type: string;
  firebaseConnected: boolean;
  projectId: string | null;
  databaseId: string;
}> {
  try {
    return await apiCall<any>('/api/db-status', '', 'GET');
  } catch (e) {
    return {
      type: 'unknown',
      firebaseConnected: false,
      projectId: null,
      databaseId: '(default)'
    };
  }
}

// Синхронные версии функций для обратной совместимости (теперь работают только с кэшем в памяти)
export function getStoredSubmissions(): Submission[] {
  return submissionsCache;
}

export function saveSubmission(submission: any): Submission {
  const dummySaved: Submission = {
    id: 'sub-sync-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11),
    applicantName: submission.applicantName,
    referrerName: submission.referrerName,
    referrerType: submission.referrerType || null,
    answers: submission.answers,
    submittedAt: new Date().toISOString(),
    consentGiven: true,
    consentAt: new Date().toISOString(),
    consentVersion: submission.consentVersion || '17.07.2026_site_4',
    consentPurpose: 'Проведение профориентационного анкетирования',
    consentDataScope: 'ФИО абитуриента, ФИО рекомендовавшего лица, его отношение к колледжу, ответы на вопросы'
  };
  submissionsCache.unshift(dummySaved);
  saveSubmissionAsync(submission).catch(err => console.error("Фоновое сохранение через API не удалось:", err));
  return dummySaved;
}

export function deleteSubmission(id: string) {
  deleteSubmissionAsync(id).catch(err => console.error("Фоновое удаление через API не удалось:", err));
}

export function clearAllSubmissions() {
  clearAllSubmissionsAsync().catch(err => console.error("Фоновая очистка через API не удалась:", err));
}

// Выполняет логин на сервере и сохраняет токен в сессию
export async function loginAdminAsync(login: string, password: string): Promise<string> {
  const result = await apiCall<{ token: string }>('/api/login', '?action=login', 'POST', { login, password });
  if (result && result.token) {
    sessionStorage.setItem('nemk_admin_token', result.token);
    return result.token;
  }
  throw new Error("Неверный логин или пароль");
}

// Завершает сессию администратора и очищает локальный кэш в памяти
export async function logoutAdmin() {
  const token = sessionStorage.getItem('nemk_admin_token');
  if (token) {
    try {
      await apiCall<any>('/api/logout', '?action=logout', 'POST');
    } catch (e) {
      console.warn("Ошибка при серверном выходе:", e);
    }
  }
  sessionStorage.removeItem('nemk_admin_token');
  submissionsCache = [];
}
