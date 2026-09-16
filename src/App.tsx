import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Questionnaire from './components/Questionnaire';
import CollegeLifeModal from './components/CollegeLifeModal';
import AdminPanel from './components/AdminPanel';
import { Question, Submission } from './types';
import { 
  getStoredQuestions, 
  getStoredSubmissions,
  getStoredSubmissionsAsync, 
  saveSubmissionAsync, 
  deleteSubmissionAsync, 
  clearAllSubmissionsAsync,
  loginAdminAsync,
  logoutAdmin
} from './dataStore';
import { Shield, Key, Eye, HelpCircle, Check, AlertTriangle, Sparkles, Loader2 } from 'lucide-react';

export default function App() {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isLifeModalOpen, setIsLifeModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  
  // Состояние данных
  const [questions, setQuestions] = useState<Question[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>(() => {
    try {
      return getStoredSubmissions();
    } catch {
      return [];
    }
  });
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(true);

  // Состояние авторизации (логин/пароль)
  const [loginInput, setLoginInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Загрузка начальных данных
  useEffect(() => {
    setQuestions(getStoredQuestions());
    
    // Проверка сохраненной сессии администратора при монтировании
    const token = sessionStorage.getItem('nemk_admin_token');
    if (token) {
      setIsAdminMode(true);
    }
  }, []);

  // Синхронизация анкет с сервером ТОЛЬКО для администратора
  useEffect(() => {
    if (!isAdminMode) {
      setSubmissions([]);
      setIsLoadingSubmissions(true);
      return;
    }

    const syncSubmissions = () => {
      getStoredSubmissionsAsync()
        .then(subs => {
          setSubmissions(subs);
          setIsLoadingSubmissions(false);
        })
        .catch(err => {
          console.error("Не удалось синхронизировать анкеты:", err);
          setIsLoadingSubmissions(false);
          // Автоматический разлогин при ошибках авторизации (токен просрочен/неверен)
          if (err && err.message && (
            err.message.includes("токен") || 
            err.message.includes("авторизац") || 
            err.message.includes("401") ||
            err.message.includes("отсутствует заголовок")
          )) {
            handleLogout();
          }
        });
    };

    // Первоначальный запрос данных
    syncSubmissions();

    // Опрос сервера каждые 4 секунды для поддержания актуальности данных
    const intervalId = setInterval(syncSubmissions, 4000);

    return () => clearInterval(intervalId);
  }, [isAdminMode]);

  // Обработка отправки заполненной анкеты абитуриента
  const handleFormSubmit = async (data: any) => {
    const saved = await saveSubmissionAsync(data);
    // Обновление локального состояния
    setSubmissions(prev => [saved, ...prev]);
  };

  // Удаление анкеты из панели администратора
  const handleDeleteSubmission = async (id: string) => {
    await deleteSubmissionAsync(id);
    setSubmissions(prev => prev.filter(s => s.id !== id));
  };

  // Полное удаление всех анкет
  const handleClearAll = async () => {
    await clearAllSubmissionsAsync();
    setSubmissions([]);
  };

  // Обновление списка вопросов анкеты
  const handleUpdateQuestions = (updated: Question[]) => {
    setQuestions(updated);
  };

  // Процедура авторизации администратора
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await loginAdminAsync(loginInput.trim(), passwordInput);
      setIsAdminMode(true);
      setIsLoginModalOpen(false);
      setLoginInput('');
      setPasswordInput('');
      setLoginError('');
    } catch (err: any) {
      setLoginError(err.message || 'Неверный логин или пароль. Попробуйте еще раз.');
    }
  };

  // Процедура выхода из панели администратора
  const handleLogout = () => {
    logoutAdmin();
    setIsAdminMode(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col relative overflow-hidden font-sans" id="app-root">
      {/* Декоративные градиентные фоны */}
      <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-[#ab2d42]/5 blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-[#ab2d42]/5 blur-[100px] rounded-full pointer-events-none z-0" />

      {/* Компонент шапки сайта */}
      <Header 
        isAdmin={isAdminMode} 
        onLoginClick={() => setIsLoginModalOpen(true)}
        onLogoutClick={handleLogout}
        onBackToMain={() => setIsAdminMode(false)}
      />

      {/* Основной контейнер */}
      <main className="flex-1 flex flex-col pb-12 z-10">
        
        {/* Баннер с информацией о колледже */}
        {!isAdminMode && (
          <div className="w-full max-w-4xl mx-auto mt-8 px-4 relative overflow-hidden text-center sm:text-left z-10">
            <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-[24px] flex flex-col md:flex-row items-center justify-between gap-6 relative shadow-md">
              <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#ab2d42_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none rounded-[24px]" />
              
              <div className="space-y-3 relative z-10">
                <div className="inline-flex items-center gap-1.5 bg-[#ab2d42]/10 border border-[#ab2d42]/20 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase text-[#ab2d42]">
                  <Sparkles size={12} />
                  <span>Приемная кампания</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-light font-sans leading-tight tracking-tight text-slate-900">
                  Стань востребованным <span className="font-semibold text-[#ab2d42]">специалистом или квалифицированным рабочим</span> в НЭК!
                </h2>
                <p className="text-slate-600 text-xs sm:text-sm max-w-xl leading-relaxed">
                  Один из авторитетных колледжей Новосибирской области. Мы готовим высококлассных специалистов и квалифицированные рабочие кадры в области IT, электромеханики, электроники и автоматизации с 1943 года.
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center gap-3 max-w-xs text-left relative z-10">
                <div className="p-3 bg-[#ab2d42]/10 text-[#ab2d42] rounded-lg flex-shrink-0 border border-[#ab2d42]/20">
                  <Shield size={24} />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#ab2d42]">Государственный диплом</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Лицензия и аккредитация РФ. Гарантия качественного образования.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Динамическая маршрутизация экранов (Анкета гостя или Панель администратора) */}
        {isAdminMode ? (
          <div className="animate-fadeIn mt-6">
            <AdminPanel 
              questions={questions}
              submissions={submissions}
              onDeleteSubmission={handleDeleteSubmission}
              onClearAll={handleClearAll}
              onUpdateQuestions={handleUpdateQuestions}
              onBackToMain={() => setIsAdminMode(false)}
              isLoading={isLoadingSubmissions}
            />
          </div>
        ) : (
          <div className="animate-fadeIn py-6">
            <Questionnaire 
              questions={questions}
              onSubmit={handleFormSubmit}
              onOpenLifeModal={() => setIsLifeModalOpen(true)}
            />
          </div>
        )}
      </main>

      {/* Модальное окно студенческой жизни колледжа с эффектом размытия */}
      {isLifeModalOpen && (
        <CollegeLifeModal onClose={() => setIsLifeModalOpen(false)} />
      )}

      {/* Модальное окно входа в панель администратора */}
      {isLoginModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
          id="login-modal-container"
        >
          <div 
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp text-slate-800"
            id="login-modal"
          >
            {/* Шапка модального окна */}
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-6 text-center relative">
              <div className="w-12 h-12 bg-[#ab2d42]/10 rounded-full flex items-center justify-center mx-auto mb-2 border border-[#ab2d42]/20">
                <Shield size={24} className="text-[#ab2d42]" />
              </div>
              <h3 className="text-lg font-bold font-sans text-slate-900">Вход для администрации</h3>
              <p className="text-xs text-slate-500 mt-1">Доступ к статистике абитуриентов и управлению анкетой</p>
            </div>

            {/* Тело модального окна / Форма */}
            <form onSubmit={handleLoginSubmit} className="p-6 space-y-4" autoComplete="off">
              {/* Скрытые поля для предотвращения автозаполнения браузером */}
              <input style={{ display: 'none' }} type="text" name="fake_username_prevent_autofill" />
              <input style={{ display: 'none' }} type="password" name="fake_password_prevent_autofill" />

              {/* Поле ввода логина */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Логин</label>
                <input
                  type="text"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  placeholder="Введите логин"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#ab2d42]/20 focus:border-[#ab2d42] text-slate-800 placeholder-slate-400 focus:outline-hidden transition-all"
                  id="adm-log-field"
                  name="adm-log-field"
                  autoComplete="off"
                  required
                />
              </div>

              {/* Поле ввода пароля */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase block">Пароль</label>
                <div className="relative">
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Введите пароль"
                    className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#ab2d42]/20 focus:border-[#ab2d42] text-slate-800 placeholder-slate-400 focus:outline-hidden transition-all"
                    id="adm-pwd-field"
                    name="adm-pwd-field"
                    autoComplete="new-password"
                    required
                  />
                  <Key className="absolute right-3 top-3.5 text-slate-400" size={16} />
                </div>
              </div>

              {loginError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs font-semibold flex items-start gap-2 border border-red-200 animate-slideDown">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Кнопки */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsLoginModalOpen(false);
                    setLoginError('');
                    setLoginInput('');
                    setPasswordInput('');
                  }}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-semibold transition-all cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-[#ab2d42] hover:bg-[#8c1f2f] text-white rounded-lg text-sm font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
                  id="confirm-login-btn"
                >
                  Войти
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Подвал сайта */}
      <footer className="w-full bg-white border-t border-slate-200 py-6 px-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-500 font-sans">
          <span>© {new Date().getFullYear()} ГБПОУ НСО "Новосибирский электромеханический колледж"</span>
          <div className="flex space-x-4">
            <a href="https://нэмк.рф" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-[#ab2d42] transition-colors">Официальный сайт: нэмк.рф</a>
            <span>•</span>
            <a href="https://2gis.ru/novosibirsk/firm/141265769341673/tab/reviews" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-[#ab2d42] transition-colors">Отзывы 2ГИС</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
