import React, { useState, useMemo, useEffect } from 'react';
import { Question, Submission } from '../types';
import { 
  Calendar, Search, Trash2, CalendarDays, BarChart3, ListFilter, 
  ChevronDown, RefreshCw, Plus, Save, AlertCircle, ArrowLeft, Download, FileSpreadsheet,
  Loader2, ShieldAlert, Database, History, HelpCircle, Edit3, Image as ImageIcon, Upload, Clock, Check, X
} from 'lucide-react';
import { 
  saveStoredQuestions,
  saveStoredQuestionsAsync,
  getActionLogsAsync, 
  getBackupsAsync, 
  createBackupAsync, 
  restoreBackupAsync, 
  deleteBackupAsync,
  getDbStatusAsync,
  getBackupSettingsAsync,
  updateBackupSettingsAsync
} from '../dataStore';
import PieChartModal from './PieChartModal';

interface AdminPanelProps {
  questions: Question[];
  submissions: Submission[];
  onDeleteSubmission: (id: string) => void;
  onClearAll?: () => void;
  onUpdateQuestions: (updatedQuestions: Question[]) => void;
  onBackToMain: () => void;
  isLoading?: boolean;
}

export default function AdminPanel({ 
  questions, 
  submissions, 
  onDeleteSubmission, 
  onUpdateQuestions,
  onBackToMain,
  isLoading = false
}: AdminPanelProps) {
  // Активная вкладка панели управления
  const [activeTab, setActiveTab] = useState<'analytics' | 'questions' | 'logs' | 'backups'>('analytics');

  // Состояния для логов действий (аудита)
  const [actionLogs, setActionLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Состояния для резервного копирования
  const [backups, setBackups] = useState<any[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [backupError, setBackupError] = useState('');
  const [backupSuccess, setBackupSuccess] = useState('');

  // Состояния авто-бэкапа
  const [backupPeriod, setBackupPeriod] = useState<string>('7d');
  const [backupPeriodLabel, setBackupPeriodLabel] = useState<string>('неделя (по умолчанию)');
  const [lastBackupTime, setLastBackupTime] = useState<number | null>(null);
  const [nextBackupTime, setNextBackupTime] = useState<number | null>(null);
  const [isUpdatingBackupSettings, setIsUpdatingBackupSettings] = useState(false);

  // Состояния для редактирования вопроса
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editQuestionText, setEditQuestionText] = useState('');
  const [editQuestionType, setEditQuestionType] = useState<'select' | 'text'>('select');
  const [editQuestionOptions, setEditQuestionOptions] = useState<string[]>(['', '']);
  const [editQuestionImage, setEditQuestionImage] = useState<string>('');
  const [editQuestionError, setEditQuestionError] = useState('');

  // Состояние фильтрации по датам
  const [filterType, setFilterType] = useState<'day' | 'range' | 'all'>('all');
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().split('T')[0]);
  const [rangeStart, setRangeStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [rangeEnd, setRangeEnd] = useState(new Date().toISOString().split('T')[0]);
  
  // Состояние поискового запроса
  const [searchQuery, setSearchQuery] = useState('');
  
  // Состояние формы создания вопроса
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<'select' | 'text'>('select');
  const [newQuestionOptions, setNewQuestionOptions] = useState<string[]>(['', '']);
  const [newQuestionImage, setNewQuestionImage] = useState<string>('');
  const [questionError, setQuestionError] = useState('');

  // Выбранный вопрос для отображения круговой диаграммы
  const [selectedPieQuestion, setSelectedPieQuestion] = useState<Question | null>(null);

  // Состояние подключенной БД
  const [dbStatus, setDbStatus] = useState<{
    type: string;
    firebaseConnected: boolean;
    projectId: string | null;
    databaseId: string;
  } | null>(null);

  useEffect(() => {
    getDbStatusAsync().then(status => setDbStatus(status)).catch(() => {});
  }, []);

  // Загрузка логов и бэкапов при переключении вкладок
  const loadLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const logs = await getActionLogsAsync();
      setActionLogs(logs);
    } catch (err: any) {
      console.error("Ошибка при получении логов:", err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const loadBackups = async () => {
    setIsLoadingBackups(true);
    try {
      const bList = await getBackupsAsync();
      setBackups(bList);
    } catch (err: any) {
      console.error("Ошибка при получении резервных копий:", err);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const loadBackupSettings = async () => {
    try {
      const s = await getBackupSettingsAsync();
      if (s && s.period) {
        setBackupPeriod(s.period);
        setBackupPeriodLabel(s.periodLabel || 'неделя (по умолчанию)');
        setLastBackupTime(s.lastBackupTime);
        setNextBackupTime(s.nextBackupTime);
      }
    } catch (err) {
      console.error("Ошибка при получении настроек авто-бэкапа:", err);
    }
  };

  const handleUpdateBackupPeriod = async (newPeriod: string) => {
    setIsUpdatingBackupSettings(true);
    setBackupError('');
    setBackupSuccess('');
    try {
      const res = await updateBackupSettingsAsync(newPeriod);
      setBackupPeriod(res.period);
      setBackupPeriodLabel(res.periodLabel);
      setLastBackupTime(res.lastBackupTime);
      setNextBackupTime(res.nextBackupTime);
      setBackupSuccess(`Период авто-бэкапа успешно обновлен: ${res.periodLabel}`);
      loadBackups();
    } catch (err: any) {
      setBackupError('Не удалось изменить период авто-бэкапа: ' + err.message);
    } finally {
      setIsUpdatingBackupSettings(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs();
    } else if (activeTab === 'backups') {
      loadBackups();
      loadBackupSettings();
    }
  }, [activeTab]);

  const handleCreateBackup = async () => {
    setBackupError('');
    setBackupSuccess('');
    try {
      await createBackupAsync();
      setBackupSuccess('Резервная копия успешно создана!');
      loadBackups();
    } catch (err: any) {
      setBackupError('Не удалось создать резервную копию: ' + err.message);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    setBackupError('');
    setBackupSuccess('');
    if (!window.confirm(`Вы уверены, что хотите восстановить базу данных из файла ${filename}? Текущие анкеты будут заменены.`)) {
      return;
    }
    try {
      await restoreBackupAsync(filename);
      setBackupSuccess('База данных успешно восстановлена!');
      // Перезагружаем страницу/данные
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setBackupError('Не удалось восстановить базу данных: ' + err.message);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    setBackupError('');
    setBackupSuccess('');
    if (!window.confirm(`Вы уверены, что хотите безвозвратно удалить копию ${filename}?`)) {
      return;
    }
    try {
      await deleteBackupAsync(filename);
      setBackupSuccess('Резервная копия удалена.');
      loadBackups();
    } catch (err: any) {
      setBackupError('Не удалось удалить копию: ' + err.message);
    }
  };

  // Наборы быстрых фильтров по датам
  const setPresetLast7Days = () => {
    setFilterType('range');
    const start = new Date();
    start.setDate(start.getDate() - 7);
    setRangeStart(start.toISOString().split('T')[0]);
    setRangeEnd(new Date().toISOString().split('T')[0]);
  };

  const setPresetLast30Days = () => {
    setFilterType('range');
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setRangeStart(start.toISOString().split('T')[0]);
    setRangeEnd(new Date().toISOString().split('T')[0]);
  };

  const setPresetToday = () => {
    setFilterType('day');
    setSelectedDay(new Date().toISOString().split('T')[0]);
  };

  // 1. Фильтрация отправленных анкет по выбранным датам
  const dateFilteredSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      const subDate = new Date(sub.submittedAt);
      const subDateString = sub.submittedAt.split('T')[0];

      if (filterType === 'day') {
        return subDateString === selectedDay;
      } else if (filterType === 'range') {
        return subDateString >= rangeStart && subDateString <= rangeEnd;
      }
      return true; // 'all'
    });
  }, [submissions, filterType, selectedDay, rangeStart, rangeEnd]);

  // 2. Дополнительная фильтрация по поисковому запросу (ФИО абитуриента, рекомендатель или любой ответ)
  const finalFilteredSubmissions = useMemo(() => {
    if (!searchQuery.trim()) return dateFilteredSubmissions;
    const query = searchQuery.toLowerCase().trim();
    return dateFilteredSubmissions.filter(sub => {
      const nameMatch = sub.applicantName.toLowerCase().includes(query);
      const refMatch = sub.referrerName.toLowerCase().includes(query);
      
      // Проверка совпадения поискового запроса с любым из ответов
      const answersMatch = Object.values(sub.answers).some(ans => 
        typeof ans === 'string' && ans.toLowerCase().includes(query)
      );
      
      return nameMatch || refMatch || answersMatch;
    });
  }, [dateFilteredSubmissions, searchQuery]);

  // 3. Расчет статистики для отфильтрованных анкет
  const stats = useMemo(() => {
    const totalCount = dateFilteredSubmissions.length;
    
    // Динамический подсчет ответов по каждой анкете по ID вопроса
    // Структура: Record<ID_вопроса, Record<текст_ответа, количество>>
    const questionBreakdowns: Record<string, Record<string, number>> = {};

    // Инициализация пустых счетчиков для всех вариантов вопросов
    questions.forEach(q => {
      questionBreakdowns[q.id] = {};
      if (q.options) {
        q.options.forEach(opt => {
          questionBreakdowns[q.id][opt] = 0;
        });
      }
    });

    // Ежедневный тренд
    const dailyTrend: { [date: string]: number } = {};

    dateFilteredSubmissions.forEach(sub => {
      // Обработка ответов на каждый вопрос
      questions.forEach(q => {
        const ans = sub.answers[q.id];
        if (ans !== undefined && ans !== null && ans !== '') {
          const ansStr = String(ans).trim();
          
          // Пытаемся найти совпадение ответа с одним из предопределенных вариантов (точное или частичное)
          let matchedOption: string | null = null;
          
          if (q.options && q.options.length > 0) {
            const lowercaseAns = ansStr.toLowerCase();
            
            // Проверка вариантов
            for (const opt of q.options) {
              const lowercaseOpt = opt.toLowerCase();
              if (lowercaseAns === lowercaseOpt || 
                  lowercaseAns.startsWith(lowercaseOpt) || 
                  lowercaseOpt.startsWith(lowercaseAns) ||
                  (lowercaseAns.includes('друг') && lowercaseOpt.includes('друг')) ||
                  (lowercaseAns.includes('родственник') && lowercaseOpt.includes('родственник')) ||
                  (lowercaseAns.includes('представител') && lowercaseOpt.includes('представител')) ||
                  (lowercaseAns.includes('интернет') && lowercaseOpt.includes('интернет')) ||
                  (lowercaseAns.includes('сибирь') && lowercaseOpt.includes('сибирь')) ||
                  (lowercaseAns.includes('интерес') && lowercaseOpt.includes('интерес')) ||
                  (lowercaseAns.includes('место') && lowercaseOpt.includes('место')) ||
                  (lowercaseAns.includes('дом') && lowercaseOpt.includes('дом')) ||
                  (lowercaseAns.includes('общежит') && lowercaseOpt.includes('общежит')) ||
                  (lowercaseAns.includes('спорт') && lowercaseOpt.includes('спорт')) ||
                  (lowercaseAns.includes('творчес') && lowercaseOpt.includes('творчес')) ||
                  (lowercaseAns.includes('патриот') && lowercaseOpt.includes('патриот')) ||
                  (lowercaseAns.includes('волонтер') && lowercaseOpt.includes('волонтер')) ||
                  (lowercaseAns.includes('самоуправ') && lowercaseOpt.includes('самоуправ'))
              ) {
                matchedOption = opt;
                break;
              }
            }
          }

          if (matchedOption) {
            questionBreakdowns[q.id][matchedOption]++;
          } else {
            // Если это динамический вариант или пользователь ввел свой собственный произвольный ответ
            const otherOpt = q.options?.find(opt => opt.toLowerCase().includes('другое') || opt.toLowerCase() === 'другое');
            if (otherOpt) {
              questionBreakdowns[q.id][otherOpt]++;
            } else {
              // Добавляем динамический вариант ответа в статистику распределения
              if (!questionBreakdowns[q.id][ansStr]) {
                questionBreakdowns[q.id][ansStr] = 0;
              }
              questionBreakdowns[q.id][ansStr]++;
            }
          }
        }
      });

      // Ежедневный тренд активности (по дням)
      const dateStr = sub.submittedAt.split('T')[0];
      const parts = dateStr.split('-');
      const formattedDate = `${parts[2]}.${parts[1]}`;
      dailyTrend[formattedDate] = (dailyTrend[formattedDate] || 0) + 1;
    });

    return {
      totalCount,
      questionBreakdowns,
      dailyTrend
    };
  }, [dateFilteredSubmissions, questions]);

  // Управление добавлением вариантов ответа в форме
  const handleOptionChange = (idx: number, val: string) => {
    const updated = [...newQuestionOptions];
    updated[idx] = val;
    setNewQuestionOptions(updated);
  };

  const addOptionField = () => {
    setNewQuestionOptions([...newQuestionOptions, '']);
  };

  const removeOptionField = (idx: number) => {
    if (newQuestionOptions.length <= 2) return;
    setNewQuestionOptions(newQuestionOptions.filter((_, i) => i !== idx));
  };

  // Вспомогательный метод для загрузки и сжатия фотографии (до 1200px)
  const processImageUpload = (file: File, onSuccess: (dataUrl: string) => void, onError: (err: string) => void) => {
    if (!file.type.startsWith('image/')) {
      onError('Пожалуйста, выберите файл изображения (JPG, PNG, WebP)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round(height * (MAX_WIDTH / width));
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round(width * (MAX_HEIGHT / height));
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          onSuccess(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        onSuccess(dataUrl);
      };
      img.onerror = () => onSuccess(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => onError('Не удалось прочитать выбранный файл');
    reader.readAsDataURL(file);
  };

  // Отправка и сохранение нового произвольного вопроса
  const handleAddQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim()) {
      setQuestionError('Пожалуйста, введите текст вопроса');
      return;
    }

    const cleanedOptions = newQuestionOptions
      .map(o => o.trim())
      .filter(o => o !== '');

    if (newQuestionType === 'select' && cleanedOptions.length < 2) {
      setQuestionError('Для выбора введите минимум 2 заполненных варианта ответа');
      return;
    }

    const newQuestionId = 'q-' + Date.now();
    const newQuestion: Question = {
      id: newQuestionId,
      text: newQuestionText.trim(),
      type: newQuestionType,
      options: newQuestionType === 'select' ? cleanedOptions : undefined,
      imageUrl: newQuestionImage.trim() || undefined,
      isDefault: false,
      required: true
    };

    const updatedQuestions = [...questions, newQuestion];
    onUpdateQuestions(updatedQuestions);
    saveStoredQuestions(updatedQuestions);
    saveStoredQuestionsAsync(updatedQuestions).catch(e => console.error("Ошибка сохранения вопросов на сервере:", e));

    // Сброс полей формы
    setNewQuestionText('');
    setNewQuestionType('select');
    setNewQuestionOptions(['', '']);
    setNewQuestionImage('');
    setQuestionError('');
    setShowAddQuestion(false);
  };

  // Удаление вопроса
  const handleDeleteQuestion = (qId: string) => {
    const updated = questions.filter(q => q.id !== qId);
    onUpdateQuestions(updated);
    saveStoredQuestions(updated);
    saveStoredQuestionsAsync(updated).catch(e => console.error("Ошибка сохранения вопросов на сервере:", e));
  };

  // Редактирование вопроса
  const startEditingQuestion = (q: Question) => {
    setEditingQuestion(q);
    setEditQuestionText(q.text);
    setEditQuestionType(q.type);
    setEditQuestionOptions(q.options && q.options.length > 0 ? [...q.options] : ['', '']);
    setEditQuestionImage(q.imageUrl || '');
    setEditQuestionError('');
  };

  const handleEditOptionChange = (idx: number, val: string) => {
    const updated = [...editQuestionOptions];
    updated[idx] = val;
    setEditQuestionOptions(updated);
  };

  const addEditOptionField = () => {
    setEditQuestionOptions([...editQuestionOptions, '']);
  };

  const removeEditOptionField = (idx: number) => {
    if (editQuestionOptions.length <= 2) return;
    setEditQuestionOptions(editQuestionOptions.filter((_, i) => i !== idx));
  };

  const handleSaveEditedQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;
    if (!editQuestionText.trim()) {
      setEditQuestionError('Пожалуйста, введите текст вопроса');
      return;
    }

    const cleanedOptions = editQuestionOptions
      .map(o => o.trim())
      .filter(o => o !== '');

    if (editQuestionType === 'select' && cleanedOptions.length < 2) {
      setEditQuestionError('Для выбора укажите не менее 2 вариантов ответа');
      return;
    }

    const updated: Question = {
      ...editingQuestion,
      text: editQuestionText.trim(),
      type: editQuestionType,
      options: editQuestionType === 'select' ? cleanedOptions : undefined,
      imageUrl: editQuestionImage.trim() || undefined
    };

    const updatedQuestions = questions.map(q => q.id === editingQuestion.id ? updated : q);
    onUpdateQuestions(updatedQuestions);
    saveStoredQuestions(updatedQuestions);
    saveStoredQuestionsAsync(updatedQuestions).catch(e => console.error("Ошибка сохранения вопросов на сервере:", e));

    setEditingQuestion(null);
    setEditQuestionError('');
  };

  // Экспорт отправленных анкет в красиво оформленную HTML-таблицу, совместимую с Excel (.xls)
  // с автоматической подгонкой ширины столбцов по максимальной длине текста
  const handleExportXLS = () => {
    // Рассчитываем динамическую ширину столбцов (в пикселях)
    // Примерно: количество символов * 8px + 40px для отступов
    const col1Width = Math.max(250, ...finalFilteredSubmissions.map(s => (s.applicantName || '').length * 8 + 40));
    const col2Width = Math.max(250, ...finalFilteredSubmissions.map(s => (s.referrerName || '').length * 8 + 40));
    const col3Width = 180; // "Тип рекомендателя" содержит короткие значения ("Студент", "Сотрудник"), 180px более чем достаточно
    const col4Width = 180; // "Дата и время" содержит короткие значения, 180px достаточно

    const rowsHtml = finalFilteredSubmissions.map(sub => {
      let typeText = 'Не указано';
      if (sub.referrerType === 'student') {
        typeText = 'Студент';
      } else if (sub.referrerType === 'staff') {
        typeText = 'Сотрудник';
      } else if (sub.referrerType) {
        typeText = sub.referrerType;
      }

      const formattedDate = new Date(sub.submittedAt).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Экранирование специальных символов HTML
      const escapeHTML = (text: string) => {
        if (!text) return '';
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      };

      return `
        <tr>
          <td>${escapeHTML(sub.applicantName)}</td>
          <td>${escapeHTML(sub.referrerName)}</td>
          <td>${escapeHTML(typeText)}</td>
          <td>${escapeHTML(formattedDate)}</td>
        </tr>
      `;
    }).join('\n');

    const htmlTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
      <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
      <!--[if gte mso 9]>
      <xml>
       <x:ExcelWorkbook>
        <x:ExcelWorksheets>
         <x:ExcelWorksheet>
          <x:Name>Абитуриенты</x:Name>
          <x:WorksheetOptions>
           <x:DisplayGridlines/>
          </x:WorksheetOptions>
         </x:ExcelWorksheet>
        </x:ExcelWorksheets>
       </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        table { border-collapse: collapse; }
        td, th { border: 0.5pt solid #cccccc; padding: 6px 12px; font-family: Segoe UI, Arial, sans-serif; font-size: 10pt; vertical-align: middle; }
        th { background-color: #f1f5f9; font-weight: bold; font-size: 11pt; color: #1e293b; border-bottom: 2px solid #cbd5e1; text-align: left; }
        tr:nth-child(even) { background-color: #f8fafc; }
      </style>
      </head>
      <body>
      <table>
        <colgroup>
          <col width="${col1Width}" style="width: ${col1Width}px;" />
          <col width="${col2Width}" style="width: ${col2Width}px;" />
          <col width="${col3Width}" style="width: ${col3Width}px;" />
          <col width="${col4Width}" style="width: ${col4Width}px;" />
        </colgroup>
        <thead>
          <tr>
            <th>ФИО абитуриента</th>
            <th>Кто порекомендовал (ФИО)</th>
            <th>Тип рекомендателя (Роль)</th>
            <th>Дата и время подачи анкеты</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      </body>
      </html>
    `;

    const blob = new Blob([htmlTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", url);
    downloadAnchor.setAttribute("download", `nek_abiturient_export_${new Date().toISOString().split('T')[0]}.xls`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 font-sans space-y-6" id="admin-panel-component">
      {/* Навигационная панель администратора */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200 p-5 rounded-[20px] shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBackToMain}
            className="p-2 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
            id="admin-back-btn"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-lg sm:text-xl font-light text-slate-900 flex flex-wrap items-center gap-2">
              <span>Панель управления <span className="font-semibold text-[#ab2d42]">администратора</span></span>
              <span className="text-xs bg-[#ab2d42]/10 text-[#ab2d42] border border-[#ab2d42]/20 px-2.5 py-0.5 rounded-full font-semibold">ADM</span>
              {isLoading && (
                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200/50 px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1.5 animate-pulse">
                  <Loader2 className="animate-spin text-amber-500" size={10} />
                  <span>Синхронизация с БД...</span>
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500">Мониторинг, статистика анкет и управление вопросами</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={handleExportXLS}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-[#ab2d42]/5 border border-[#ab2d42]/10 hover:bg-[#ab2d42]/10 text-slate-700 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer active:scale-98"
            title="Экспорт списка абитуриентов в Excel с автоподбором ширины столбцов"
          >
            <FileSpreadsheet size={14} className="text-[#ab2d42]" />
            <span>Выгрузить анкеты (Excel)</span>
          </button>
        </div>
      </div>

      {/* Переключатель вкладок панели администратора */}
      <div className="flex flex-wrap border-b border-slate-200 gap-1 mb-6" id="admin-panel-tabs">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'analytics'
              ? 'border-[#ab2d42] text-[#ab2d42] bg-[#ab2d42]/5'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
          id="tab-analytics"
        >
          <BarChart3 size={15} />
          <span>Аналитика и Анкеты</span>
        </button>
        <button
          onClick={() => setActiveTab('questions')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'questions'
              ? 'border-[#ab2d42] text-[#ab2d42] bg-[#ab2d42]/5'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
          id="tab-questions"
        >
          <HelpCircle size={15} />
          <span>Конструктор вопросов</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'logs'
              ? 'border-[#ab2d42] text-[#ab2d42] bg-[#ab2d42]/5'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
          id="tab-logs"
        >
          <History size={15} />
          <span>Журнал действий</span>
        </button>
        <button
          onClick={() => setActiveTab('backups')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'backups'
              ? 'border-[#ab2d42] text-[#ab2d42] bg-[#ab2d42]/5'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
          id="tab-backups"
        >
          <Database size={15} />
          <span>Резервные копии</span>
        </button>
      </div>

      {activeTab === 'analytics' && (
        <>
          {/* Секция фильтров по датам */}
          <div className="bg-white border border-slate-200 p-5 rounded-[20px] space-y-4 shadow-xs">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <Calendar size={14} className="text-[#ab2d42]" />
          Фильтрация данных и период отчетов
        </h3>
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          {/* Кнопки предустановленных периодов и выбор */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                filterType === 'all' 
                  ? 'bg-[#ab2d42]/10 text-[#ab2d42] border-[#ab2d42]/40' 
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
              id="filter-all-time"
            >
              Все время
            </button>
            <button
              onClick={setPresetToday}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                filterType === 'day' 
                  ? 'bg-[#ab2d42]/10 text-[#ab2d42] border-[#ab2d42]/40' 
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
              id="filter-preset-today"
            >
              Сегодня
            </button>
            <button
              onClick={setPresetLast7Days}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                filterType === 'range' && (rangeStart === new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0])
                  ? 'bg-[#ab2d42]/10 text-[#ab2d42] border-[#ab2d42]/40' 
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
              id="filter-preset-7days"
            >
              7 дней
            </button>
            <button
              onClick={setPresetLast30Days}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                filterType === 'range' && (rangeStart === new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0])
                  ? 'bg-[#ab2d42]/10 text-[#ab2d42] border-[#ab2d42]/40' 
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
              id="filter-preset-30days"
            >
              30 дней
            </button>
          </div>

          {/* Поля ввода дат в зависимости от выбора */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {filterType === 'day' && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-slate-600 font-medium">Конкретный день:</span>
                <input
                  type="date"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-[#ab2d42] focus:border-[#ab2d42] focus:outline-hidden w-full sm:w-auto"
                  id="date-filter-day"
                />
              </div>
            )}

            {filterType === 'range' && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-slate-600 font-medium">Промежуток времени:</span>
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <input
                    type="date"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-[#ab2d42] focus:border-[#ab2d42] focus:outline-hidden w-full"
                    id="date-filter-range-start"
                  />
                  <span className="text-xs text-slate-400">—</span>
                  <input
                    type="date"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-[#ab2d42] focus:border-[#ab2d42] focus:outline-hidden w-full"
                    id="date-filter-range-end"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Сетка виджетов со статистикой по вопросам */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        
        {/* Карточка общей статистики */}
        <div className="bg-white border border-slate-200 p-5 rounded-[20px] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Всего анкет за период</span>
              <span className="p-2 bg-[#ab2d42]/10 text-[#ab2d42] border border-[#ab2d42]/20 rounded-lg animate-pulse">
                <CalendarDays size={18} />
              </span>
            </div>
            <div className="mt-4">
              <span className="text-4xl font-extrabold text-slate-900 tracking-tight">{stats.totalCount}</span>
              <span className="text-xs text-slate-500 font-semibold block mt-1">зарегистрированных ответов</span>
            </div>
          </div>
        </div>

        {/* Динамические виджеты статистики для всех вопросов */}
        {questions.map((q, qIndex) => {
          const breakdown = stats.questionBreakdowns[q.id] || {};
          // Sort items so popular ones are at the top
          const entries = (Object.entries(breakdown) as [string, number][]).sort((a, b) => b[1] - a[1]);
          const colors = [
            'bg-green-500', 'bg-blue-500', 'bg-amber-500', 'bg-purple-500', 
            'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500'
          ];
          const colorClass = colors[qIndex % colors.length];
          const iconColors = [
            'bg-green-50 text-green-600 border-green-200',
            'bg-blue-50 text-blue-600 border-blue-200',
            'bg-amber-50 text-amber-600 border-amber-200',
            'bg-purple-50 text-purple-600 border-purple-200',
            'bg-rose-50 text-rose-600 border-rose-200'
          ];
          const iconColorClass = iconColors[qIndex % iconColors.length];

          return (
            <div 
              key={q.id ? `widget-q-${q.id}-${qIndex}` : `widget-q-${qIndex}`} 
              onClick={() => setSelectedPieQuestion(q)}
              className="bg-white border border-slate-200 p-5 rounded-[20px] shadow-xs flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-[#ab2d42]/30 hover:scale-[1.01] transition-all duration-200 group relative"
              title="Нажмите, чтобы открыть круговую диаграмму статистики"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider line-clamp-2 group-hover:text-[#ab2d42] transition-colors" title={q.text}>
                    {qIndex + 1}. {q.text}
                  </span>
                  <span className={`p-2 rounded-lg border shrink-0 ${iconColorClass} group-hover:bg-[#ab2d42]/10 group-hover:text-[#ab2d42] group-hover:border-[#ab2d42]/20 transition-all`}>
                    <BarChart3 size={18} />
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
                  {entries.length === 0 ? (
                    <p className="text-xs text-slate-500 italic text-center py-6">Нет ответов</p>
                  ) : (
                    entries.map(([optionText, count], optIdx) => {
                      const percentage = stats.totalCount > 0 ? Math.round((count / stats.totalCount) * 100) : 0;
                      return (
                        <div key={`${q.id}-opt-${optIdx}-${optionText}`} className="space-y-1">
                          <div className="flex justify-between text-xs gap-2">
                            <span className="font-semibold text-slate-700 truncate" title={optionText}>{optionText}</span>
                            <span className="text-slate-500 font-bold shrink-0">{count} ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`${colorClass} h-full rounded-full transition-all duration-500`} 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-between items-center text-[10px] font-bold text-[#ab2d42] opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Показать круговую диаграмму</span>
                <span>&rarr;</span>
              </div>
            </div>
          );
        })}

      </div>

      {/* Раздел со списком анкет (полная ширина) */}
      <div className="bg-white border border-slate-200 rounded-[20px] overflow-hidden flex flex-col shadow-xs mt-6">
          {/* Заголовок раздела */}
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-50">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Таблица анкет абитуриентов</h3>
              <p className="text-xs text-slate-500">Найдено: {finalFilteredSubmissions.length} анкет</p>
            </div>

            {/* Поле ввода поискового запроса */}
            <div className="relative">
              <input
                type="text"
                placeholder="Поиск по ФИО, референту, ответам..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-[#ab2d42] focus:border-[#ab2d42] focus:outline-hidden"
                id="search-input"
              />
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            </div>
          </div>

          {/* Контейнер с таблицей */}
          <div className="overflow-y-auto max-h-[500px]">
            {isLoading && submissions.length === 0 ? (
              <div className="p-16 text-center text-slate-500 space-y-3 flex flex-col items-center justify-center animate-pulse">
                <Loader2 className="animate-spin text-[#ab2d42]" size={36} />
                <p className="text-sm font-medium">Загрузка анкет из базы данных...</p>
              </div>
            ) : finalFilteredSubmissions.length === 0 ? (
              <div className="p-10 text-center text-slate-500 space-y-2">
                <AlertCircle className="mx-auto text-slate-400" size={32} />
                <p className="text-sm">Анкеты не найдены за выбранный период или по поисковому запросу</p>
              </div>
            ) : (
              <>
                {/* Вид для ПК: Таблица */}
                <table className="hidden md:table w-full text-left border-collapse" id="submissions-table">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase font-bold">
                      <th className="p-4">Абитуриент / Референт</th>
                      <th className="p-4">Откуда узнал (Вопрос 1)</th>
                      <th className="p-4">Другие ответы</th>
                      <th className="p-4">Дата / Время</th>
                      <th className="p-4 text-center">Действие</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                    {finalFilteredSubmissions.map((sub, sIdx) => {
                      const submissionDate = new Date(sub.submittedAt);
                      const formattedDateTime = `${submissionDate.toLocaleDateString('ru-RU')} ${submissionDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;

                      return (
                        <tr key={sub.id ? `sub-row-${sub.id}-${sIdx}` : `sub-row-${sIdx}`} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-slate-800">{sub.applicantName}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5 flex items-center flex-wrap gap-1">
                              <span className="font-semibold text-slate-400">Посоветовал:</span> <span className="text-slate-600">{sub.referrerName}</span>
                              {sub.referrerType === 'student' && (
                                <span className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 text-[9px] px-1.5 py-0.5 rounded-full font-medium border border-blue-100 ml-1">🎓 Студент</span>
                              )}
                              {sub.referrerType === 'staff' && (
                                <span className="inline-flex items-center gap-0.5 bg-purple-50 text-purple-700 text-[9px] px-1.5 py-0.5 rounded-full font-medium border border-purple-100 ml-1">💼 Сотрудник</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 font-medium text-slate-700">
                            {sub.answers['source'] || <span className="text-slate-400 italic">Нет ответа</span>}
                          </td>
                          <td className="p-4 space-y-1 max-w-xs">
                            {/* Отображение других ответов на динамические вопросы */}
                            {Object.entries(sub.answers)
                              .filter(([qId]) => qId !== 'source')
                              .map(([qId, ans], ansIdx) => {
                                const qObj = questions.find(q => q.id === qId);
                                const qText = qObj ? qObj.text : qId;
                                return (
                                  <div key={`sub-ans-${sub.id || sIdx}-${qId}-${ansIdx}`} className="text-[10px]">
                                    <span className="font-semibold text-slate-400 truncate block max-w-xs">{qText}:</span>
                                    <span className="text-slate-600 font-medium block pl-1 border-l border-slate-200 mt-0.5">{ans}</span>
                                  </div>
                                );
                              })}
                          </td>
                          <td className="p-4 text-slate-500 font-mono">
                            {formattedDateTime}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => {
                                if(window.confirm('Вы действительно хотите удалить эту анкету?')) {
                                  onDeleteSubmission(sub.id);
                                }
                              }}
                              className="p-1.5 hover:bg-red-50 text-red-600 hover:text-red-700 rounded-lg transition-colors cursor-pointer"
                              title="Удалить запись"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Вид для мобильных устройств: Список карточек */}
                <div className="md:hidden divide-y divide-slate-100" id="submissions-mobile-cards">
                  {finalFilteredSubmissions.map((sub, sIdx) => {
                    const submissionDate = new Date(sub.submittedAt);
                    const formattedDateTime = `${submissionDate.toLocaleDateString('ru-RU')} ${submissionDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;

                    return (
                      <div key={sub.id ? `sub-card-${sub.id}-${sIdx}` : `sub-card-${sIdx}`} className="p-4 space-y-3 hover:bg-slate-50/50 transition-colors">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <div className="font-bold text-slate-800 text-sm">{sub.applicantName}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5 flex items-center flex-wrap gap-1">
                              <span className="font-semibold text-slate-400">Посоветовал:</span> <span className="text-slate-600">{sub.referrerName}</span>
                              {sub.referrerType === 'student' && (
                                <span className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 text-[9px] px-1.5 py-0.5 rounded-full font-medium border border-blue-100 ml-1">🎓 Студент</span>
                              )}
                              {sub.referrerType === 'staff' && (
                                <span className="inline-flex items-center gap-0.5 bg-purple-50 text-purple-700 text-[9px] px-1.5 py-0.5 rounded-full font-medium border border-purple-100 ml-1">💼 Сотрудник</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if(window.confirm('Вы действительно хотите удалить эту анкету?')) {
                                  onDeleteSubmission(sub.id);
                                }
                            }}
                            className="p-1.5 hover:bg-red-50 text-red-600 hover:text-red-700 rounded-lg transition-colors cursor-pointer"
                            title="Удалить запись"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg space-y-2 border border-slate-100 text-[11px]">
                          <div>
                            <span className="font-semibold text-slate-400">Откуда узнал:</span>
                            <span className="text-slate-700 block mt-0.5 font-medium">{sub.answers['source'] || 'Нет ответа'}</span>
                          </div>
                          {Object.entries(sub.answers)
                            .filter(([qId]) => qId !== 'source')
                            .map(([qId, ans], ansIdx) => {
                              const qObj = questions.find(q => q.id === qId);
                              const qText = qObj ? qObj.text : qId;
                              return (
                                <div key={`sub-card-ans-${sub.id || sIdx}-${qId}-${ansIdx}`} className="border-t border-slate-100 pt-1.5 mt-1.5">
                                  <span className="font-semibold text-slate-400 block">{qText}:</span>
                                  <span className="text-slate-700 block mt-0.5 font-medium">{ans}</span>
                                </div>
                              );
                            })}
                        </div>

                        <div className="text-[10px] text-slate-400 font-mono text-right">
                          {formattedDateTime}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </>
    )}

      {activeTab === 'questions' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Советы и правила */}
          <div className="bg-amber-50/60 border border-amber-200/50 p-6 rounded-[20px] space-y-4 text-slate-700 h-fit">
            <div className="flex items-start gap-3">
              <ShieldAlert className="text-amber-600 shrink-0 mt-1" size={20} />
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Правила изменения структуры анкеты</h4>
                <p className="text-xs leading-relaxed mt-1 text-slate-600">
                  Изменение вопросов в реальном времени сохраняется непосредственно на сервере и синхронизируется на всех устройствах.
                </p>
                <ul className="list-disc pl-4 mt-3 text-xs space-y-2 text-slate-600 leading-relaxed">
                  <li>Удаление вопросов не сотрет ответы из уже поданных анкет, но скроет их из таблицы.</li>
                  <li>При выборе «Выбор из вариантов» обязательно укажите хотя бы два варианта ответов.</li>
                  <li>Новые вопросы отображаются у абитуриентов сразу же при следующем открытии сайта.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Конструктор вопросов */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-[20px] p-6 flex flex-col space-y-4 shadow-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Список вопросов анкеты</h3>
                <p className="text-[10px] text-slate-500">Добавление, удаление и настройка полей для абитуриентов</p>
              </div>
              
              {!showAddQuestion && (
                <button
                  onClick={() => setShowAddQuestion(true)}
                  className="p-1.5 bg-[#ab2d42]/10 hover:bg-[#ab2d42]/15 text-[#ab2d42] border border-[#ab2d42]/20 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                  id="add-question-trigger-btn"
                >
                  <Plus size={14} />
                  <span>Добавить вопрос</span>
                </button>
              )}
            </div>

            {/* Форма добавления */}
            {showAddQuestion && (
              <form onSubmit={handleAddQuestionSubmit} className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200 animate-fadeIn">
                <h4 className="text-xs font-bold text-[#ab2d42] uppercase">Новый вопрос анкеты</h4>
                
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 block">Текст вопроса:</label>
                  <input
                    type="text"
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    placeholder="Например: В каком году Вы оканчиваете школу?"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-[#ab2d42] focus:border-[#ab2d42] focus:outline-hidden"
                    id="new-question-text"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 block">Тип ответа:</label>
                  <select
                    value={newQuestionType}
                    onChange={(e) => setNewQuestionType(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-[#ab2d42] focus:border-[#ab2d42] focus:outline-hidden"
                    id="new-question-type"
                  >
                    <option value="select">Выбор из вариантов (Один из многих)</option>
                    <option value="text">Текстовый ответ (Свободный ввод)</option>
                  </select>
                </div>

                {newQuestionType === 'select' && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-bold text-slate-600">Варианты ответов:</label>
                      <button
                        type="button"
                        onClick={addOptionField}
                        className="text-[10px] text-[#ab2d42] font-bold hover:underline cursor-pointer"
                      >
                        + Добавить вариант
                      </button>
                    </div>
                    
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {newQuestionOptions.map((opt, idx) => (
                        <div key={`new-opt-${idx}`} className="flex gap-1 items-center">
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => handleOptionChange(idx, e.target.value)}
                            placeholder={`Вариант ${idx + 1}`}
                            className="w-full px-2.5 py-1 bg-white border border-slate-200 text-slate-800 rounded-lg text-xs"
                            id={`new-question-option-${idx}`}
                          />
                          {newQuestionOptions.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeOptionField(idx)}
                              className="text-red-500 hover:text-red-600 font-bold text-sm px-1"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Фотография к вопросу (1 фото на вопрос) */}
                <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
                  <label className="text-[11px] font-bold text-slate-600 block">
                    Фотография к вопросу (1 фото):
                  </label>
                  
                  {newQuestionImage ? (
                    <div className="relative rounded-xl border border-slate-200 bg-white p-2 flex items-center gap-3">
                      <img
                        src={newQuestionImage}
                        alt="Предпросмотр фото к вопросу"
                        className="w-16 h-16 object-cover rounded-lg border border-slate-100 bg-slate-50"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-bold text-slate-800 block truncate">Фотография прикреплена</span>
                        <span className="text-[10px] text-slate-400 block">Будет показана абитуриентам при заполнении</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewQuestionImage('')}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-1 font-semibold"
                        title="Удалить фотографию"
                      >
                        <Trash2 size={13} />
                        <span>Удалить</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <label className="px-3 py-1.5 bg-white border border-slate-200 hover:border-[#ab2d42] hover:bg-[#ab2d42]/5 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors">
                        <Upload size={13} className="text-[#ab2d42]" />
                        <span>Прикрепить фото</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              processImageUpload(file, (dataUrl) => setNewQuestionImage(dataUrl), (err) => setQuestionError(err));
                            }
                          }}
                        />
                      </label>
                      <span className="text-[10px] text-slate-400">PNG, JPG, WebP (для одного вопроса одна фотография)</span>
                    </div>
                  )}
                </div>

                {questionError && (
                  <p className="text-[10px] text-red-500 font-medium">{questionError}</p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddQuestion(false);
                      setNewQuestionImage('');
                      setQuestionError('');
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#ab2d42] hover:bg-[#8c1f2f] flex items-center gap-1 cursor-pointer shadow-md shadow-[#ab2d42]/15"
                    id="save-new-question-btn"
                  >
                    <Save size={12} />
                    <span>Сохранить вопрос</span>
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-3 pt-2">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Текущий список вопросов:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                {questions.map((q, idx) => (
                  <div key={q.id ? `manage-q-${q.id}-${idx}` : `manage-q-${idx}`} className="p-4 border border-slate-200 rounded-xl bg-slate-50 relative group flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pr-20 mb-1">
                        <span className="text-[9px] font-bold text-slate-400 block">Вопрос {idx + 1} • {q.type === 'select' ? 'Варианты' : 'Текст'}</span>
                        {q.imageUrl && (
                          <span className="text-[9px] font-bold bg-rose-50 text-[#ab2d42] border border-[#ab2d42]/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <ImageIcon size={10} />
                            <span>1 фото</span>
                          </span>
                        )}
                      </div>

                      {q.imageUrl && (
                        <div className="my-2 rounded-lg overflow-hidden border border-slate-200 bg-white">
                          <img
                            src={q.imageUrl}
                            alt={q.text}
                            className="w-full h-28 object-contain bg-slate-900/5 mx-auto"
                            loading="lazy"
                          />
                        </div>
                      )}

                      <span className="text-xs font-bold text-slate-800 leading-normal block pr-8">{q.text}</span>
                      
                      {q.options && (
                        <div className="mt-2 space-y-1">
                          <span className="text-[9px] text-slate-400 font-bold">Варианты:</span>
                          <div className="flex flex-wrap gap-1">
                            {q.options.map((o, oIdx) => (
                              <span key={`q-${q.id || idx}-opt-${oIdx}-${o}`} className="text-[9px] bg-slate-200/60 text-slate-600 px-1.5 py-0.5 rounded-md font-medium border border-slate-300/30">{o}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="absolute right-2 top-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEditingQuestion(q)}
                        className="p-1.5 text-slate-500 hover:text-[#ab2d42] hover:bg-white rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                        title="Редактировать вопрос и фото"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Удалить вопрос"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white border border-slate-200 rounded-[20px] p-6 space-y-4 shadow-xs animate-fadeIn">
          <div className="flex justify-between items-center pb-3 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Журнал действий (Аудит)</h3>
              <p className="text-xs text-slate-500">Системные логи авторизаций администратора, удалений анкет, изменения вопросов</p>
            </div>
            <button
              onClick={loadLogs}
              disabled={isLoadingLogs}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-slate-600"
            >
              <RefreshCw size={16} className={isLoadingLogs ? 'animate-spin' : ''} />
            </button>
          </div>
          
          {isLoadingLogs ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <Loader2 className="animate-spin text-[#ab2d42]" size={32} />
              <p className="text-xs text-slate-500">Загрузка журнала аудита...</p>
            </div>
          ) : actionLogs.length === 0 ? (
            <p className="text-xs text-slate-500 italic text-center py-20">Записи действий отсутствуют</p>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 min-w-[600px]">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-[20%]">Время события</th>
                    <th className="p-3 w-[30%]">Действие</th>
                    <th className="p-3 w-[50%]">Детали / Описание</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {actionLogs.map((log, i) => (
                    <tr key={log.id ? `log-${log.id}-${i}` : `log-${i}-${log.timestamp || ''}`} className="hover:bg-slate-50/50">
                      <td className="p-3 text-slate-400 text-[11px]">
                        {new Date(log.timestamp).toLocaleString('ru-RU')}
                      </td>
                      <td className="p-3 text-[#ab2d42] font-semibold">{log.action}</td>
                      <td className="p-3 text-slate-700">{log.details || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'backups' && (
        <div className="bg-white border border-slate-200 rounded-[20px] p-6 space-y-6 shadow-xs animate-fadeIn">
          <div className="flex justify-between items-center pb-3 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Резервное копирование и базы данных</h3>
              <p className="text-xs text-slate-500">Управление сохранностью данных абитуриентов, синхронизация с облаком и локальные копии</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateBackup}
                disabled={isLoadingBackups}
                className="px-4 py-2 bg-[#ab2d42] hover:bg-[#8c1f2f] text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-[#ab2d42]/10 cursor-pointer flex items-center gap-1.5"
              >
                <Database size={14} />
                <span>Создать бэкап</span>
              </button>
            </div>
          </div>

          {/* Блок настройки автоматического резервного копирования */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#ab2d42]/10 text-[#ab2d42] border border-[#ab2d42]/20 rounded-xl">
                  <Clock size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-800 text-sm">Автоматическое резервное копирование</h4>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                      Активно
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Периодическое сохранение полной копии базы данных анкет и настроек
                  </p>
                </div>
              </div>

              {isUpdatingBackupSettings && (
                <div className="flex items-center gap-1.5 text-xs text-[#ab2d42] font-semibold animate-pulse">
                  <Loader2 className="animate-spin" size={14} />
                  <span>Сохранение расписания...</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Период авто-бэкапа:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { id: '1d', label: '1 день', desc: 'Каждые 24 часа' },
                  { id: '3d', label: '3 дня', desc: 'Раз в 3 дня' },
                  { id: '7d', label: 'Неделя', desc: 'По умолчанию' },
                  { id: '30d', label: 'Месяц', desc: 'Каждые 30 дней' }
                ].map((item) => {
                  const isSelected = backupPeriod === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={isUpdatingBackupSettings}
                      onClick={() => handleUpdateBackupPeriod(item.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                        isSelected
                          ? 'bg-white border-[#ab2d42] shadow-sm ring-2 ring-[#ab2d42]/15 text-slate-900'
                          : 'bg-white/80 border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isSelected ? 'text-[#ab2d42]' : 'text-slate-800'}`}>
                          {item.label}
                        </span>
                        {isSelected && <Check size={14} className="text-[#ab2d42]" />}
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {item.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 gap-2">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-700">Текущий график:</span>
                <span className="bg-slate-200/70 px-2 py-0.5 rounded-md font-medium text-slate-800">
                  {backupPeriodLabel}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-[11px]">
                {lastBackupTime && (
                  <span>Последний бэкап: <strong className="text-slate-700">{new Date(lastBackupTime).toLocaleString('ru-RU')}</strong></span>
                )}
                {nextBackupTime && (
                  <span>Следующий бэкап: <strong className="text-slate-700">{new Date(nextBackupTime).toLocaleString('ru-RU')}</strong></span>
                )}
              </div>
            </div>
          </div>

          {backupError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-semibold flex items-start gap-2 animate-slideDown">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{backupError}</span>
            </div>
          )}

          {backupSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs font-semibold flex items-start gap-2 animate-slideDown">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{backupSuccess}</span>
            </div>
          )}

          {isLoadingBackups ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <Loader2 className="animate-spin text-[#ab2d42]" size={32} />
              <p className="text-xs text-slate-500">Загрузка списка точек восстановления...</p>
            </div>
          ) : backups.length === 0 ? (
            <div className="border border-dashed border-slate-200 p-12 rounded-2xl text-center space-y-2">
              <Database size={36} className="text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">Точки восстановления отсутствуют</p>
              <p className="text-[11px] text-slate-400">Нажмите «Создать бэкап» в правом верхнем углу, чтобы сохранить текущее состояние базы данных.</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 min-w-[700px]">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-[25%]">Дата и время создания</th>
                    <th className="p-3 w-[45%]">Название файла резервной копии</th>
                    <th className="p-3 w-[15%]">Размер</th>
                    <th className="p-3 w-[15%] text-center">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {backups.map((bk, bkIdx) => (
                    <tr key={bk.filename ? `bk-${bk.filename}-${bkIdx}` : `bk-${bkIdx}`} className="hover:bg-slate-50/50">
                      <td className="p-3 text-slate-700 font-semibold">
                        {new Date(bk.createdAt).toLocaleString('ru-RU')}
                      </td>
                      <td className="p-3 text-slate-500 text-[11px]">{bk.filename}</td>
                      <td className="p-3 text-slate-500">{bk.sizeFormatted || bk.size}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleRestoreBackup(bk.filename)}
                            className="px-2.5 py-1 bg-[#ab2d42]/10 hover:bg-[#ab2d42]/20 text-[#ab2d42] border border-[#ab2d42]/10 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                          >
                            Восстановить
                          </button>
                          <button
                            onClick={() => handleDeleteBackup(bk.filename)}
                            className="p-1.5 hover:bg-red-50 text-red-600 hover:text-red-700 rounded-lg transition-colors cursor-pointer"
                            title="Удалить копию"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Модальное окно редактирования вопроса и прикрепления фото */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp text-slate-800 max-h-[90vh] flex flex-col">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#ab2d42]/10 text-[#ab2d42] rounded-lg">
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Редактирование вопроса анкеты</h3>
                  <p className="text-[11px] text-slate-500">Изменение текста, вариантов и прикрепление фотографии</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingQuestion(null);
                  setEditQuestionError('');
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditedQuestion} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Текст вопроса:
                </label>
                <input
                  type="text"
                  value={editQuestionText}
                  onChange={(e) => setEditQuestionText(e.target.value)}
                  placeholder="Введите текст вопроса"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-[#ab2d42] focus:border-[#ab2d42] focus:outline-hidden"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Тип ответа:
                </label>
                <select
                  value={editQuestionType}
                  onChange={(e) => setEditQuestionType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-[#ab2d42] focus:border-[#ab2d42] focus:outline-hidden"
                >
                  <option value="select">Выбор из вариантов (Один из многих)</option>
                  <option value="text">Текстовый ответ (Свободный ввод)</option>
                </select>
              </div>

              {editQuestionType === 'select' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-slate-700">Варианты ответов:</label>
                    <button
                      type="button"
                      onClick={addEditOptionField}
                      className="text-[10px] text-[#ab2d42] font-bold hover:underline cursor-pointer"
                    >
                      + Добавить вариант
                    </button>
                  </div>
                  
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {editQuestionOptions.map((opt, idx) => (
                      <div key={`edit-opt-${idx}`} className="flex gap-1 items-center">
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => handleEditOptionChange(idx, e.target.value)}
                          placeholder={`Вариант ${idx + 1}`}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 rounded-lg text-xs focus:bg-white focus:outline-hidden"
                        />
                        {editQuestionOptions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeEditOptionField(idx)}
                            className="text-red-500 hover:text-red-600 font-bold text-sm px-1.5"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Фотография к вопросу (1 фото на вопрос) */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Фотография к вопросу (1 фото):
                </label>

                {editQuestionImage ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
                    <div className="rounded-lg overflow-hidden border border-slate-200 bg-white max-h-48 flex items-center justify-center">
                      <img
                        src={editQuestionImage}
                        alt="Фото к вопросу"
                        className="w-full h-auto max-h-48 object-contain"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <label className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1">
                        <Upload size={12} className="text-[#ab2d42]" />
                        <span>Заменить фото</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              processImageUpload(file, (dataUrl) => setEditQuestionImage(dataUrl), (err) => setEditQuestionError(err));
                            }
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setEditQuestionImage('')}
                        className="px-2.5 py-1 text-red-600 hover:bg-red-50 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Trash2 size={12} />
                        <span>Удалить фото</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center gap-2 text-center">
                    <ImageIcon size={28} className="text-slate-300" />
                    <div>
                      <p className="text-[11px] font-medium text-slate-600">Фотография еще не прикреплена</p>
                      <p className="text-[10px] text-slate-400">Для одного вопроса можно прикрепить 1 фотографию</p>
                    </div>
                    <label className="px-3 py-1.5 bg-[#ab2d42] hover:bg-[#8c1f2f] text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-sm transition-all">
                      <Upload size={13} />
                      <span>Выбрать изображение</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            processImageUpload(file, (dataUrl) => setEditQuestionImage(dataUrl), (err) => setEditQuestionError(err));
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>

              {editQuestionError && (
                <div className="p-2.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold flex items-start gap-1.5 border border-red-200">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{editQuestionError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditingQuestion(null);
                    setEditQuestionError('');
                  }}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#ab2d42] hover:bg-[#8c1f2f] text-white rounded-lg text-xs font-bold shadow-md shadow-[#ab2d42]/15 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Save size={13} />
                  <span>Сохранить изменения</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedPieQuestion && (
        <PieChartModal
          isOpen={selectedPieQuestion !== null}
          onClose={() => setSelectedPieQuestion(null)}
          question={selectedPieQuestion}
          breakdown={stats.questionBreakdowns[selectedPieQuestion.id] || {}}
          totalResponses={stats.totalCount}
        />
      )}
    </div>
  );
}
