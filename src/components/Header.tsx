import React, { useState } from 'react';
import { LogIn, LogOut, Phone, MapPin, Globe, Menu, X, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  isAdmin: boolean;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  onBackToMain: () => void;
}

export default function Header({ isAdmin, onLoginClick, onLogoutClick, onBackToMain }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoIndex, setLogoIndex] = useState(0);

  const logoCandidates = [
    '/logo.png',
    '/logo.jpg',
    '/logo.jpeg',
    '/logo.svg'
  ];

  const handleLogoError = () => {
    if (logoIndex < logoCandidates.length - 1) {
      setLogoIndex(prev => prev + 1);
    }
  };

  return (
    <header className="w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 shadow-xs">
      {/* Верхняя тонкая информационная панель */}
      <div className="w-full bg-slate-50 text-slate-500 text-xs py-1.5 px-4 hidden sm:block border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto flex justify-between items-center font-sans">
          <div className="flex items-center space-x-4">
            <span className="flex items-center gap-1">
              <MapPin size={12} className="text-[#ab2d42]" />
              <span className="text-slate-600">630030, г. Новосибирск, ул. Первомайская, 202</span>
            </span>
            <span className="flex items-center gap-1">
              <Phone size={12} className="text-[#ab2d42]" />
              <a href="tel:+73833372327" className="text-slate-600 hover:text-[#ab2d42] hover:underline">+7 (383) 337-23-27</a>
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="flex items-center gap-1">
              <Globe size={12} className="text-[#ab2d42]" />
              <a href="https://нэмк.рф" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-[#ab2d42] hover:underline">Официальный сайт: нэмк.рф</a>
            </span>
            <span className="flex items-center gap-1 border-l border-slate-200 pl-4">
              <svg className="w-3.5 h-3.5 text-[#0077ff]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14 2H4.86A2.86 2.86 0 0 0 2 4.86v14.28A2.86 2.86 0 0 0 4.86 22h14.28a2.86 2.86 0 0 0 2.86-2.86V4.86A2.86 2.86 0 0 0 19.14 2zm1.61 14.36c.21.43.14.77-.47.77h-1.92c-.51 0-.75-.27-.88-.57 0 0-.98-2.39-2.37-3.94-.45-.45-.65-.6-.9-.6-.12 0-.3.15-.3.57v3.74c0 .51-.15.74-.57.74H10.8c-.32 0-.63-.09-.9-.33-.3-.27-.42-.64-.13-1.01.27-.37.38-1.22.38-1.89V11.2c0-.56-.1-.8-.32-.8-.59 0-2.02 2.4-2.87 5.12-.2.58-.4.81-.92.81H4.12c-.58 0-.7-.27-.7-.57 0-.53.68-3.15 3.25-6.75C8.38 6.85 10.35 5 12.08 5c1.03 0 1.16.23 1.16.63v1.88c0 .51.11.62.47.62.26 0 .72-.13 1.78-1.15a13.3 13.3 0 0 0 2.47-3.32c.18-.32.39-.57.91-.57h1.92c.58 0 .7.28.53.84-.2.57-1.33 3.12-2.13 4.2-.42.54-.56.74-.32 1.07.24.33 1.01 1.01 1.54 1.76 1.01 1.41 1.77 3.03 2.05 3.4z"/>
              </svg>
              <a href="https://vk.com/nemtts_2019" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-[#0077ff] hover:underline font-medium">ВКонтакте НЭК</a>
            </span>
          </div>
        </div>
      </div>

      {/* Навигация в шапке сайта */}
      <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex justify-between items-center">
        {/* Логотип и название */}
        <div 
          onClick={onBackToMain}
          className="flex items-center space-x-3 cursor-pointer select-none group"
          id="header-logo-container"
        >
          {/* Красивый официальный логотип НЭК */}
          <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center group-hover:scale-105 transition-transform duration-200 bg-white rounded-lg overflow-hidden border border-slate-100 shadow-xs">
            <img 
              src={logoCandidates[logoIndex]} 
              alt="Логотип НЭК" 
              className="w-full h-full object-contain animate-fadeIn"
              referrerPolicy="no-referrer"
              onError={handleLogoError}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#ab2d42] font-black text-xl tracking-tight leading-none">НЭК</span>
              <span className="hidden xs:inline-block h-4 w-px bg-slate-200"></span>
              <span className="hidden xs:inline-block text-xs text-slate-500 font-semibold uppercase tracking-wider">ГБПОУ НСО</span>
            </div>
            <h1 className="text-[10px] sm:text-xs text-slate-600 font-medium leading-tight max-w-[200px] sm:max-w-xs mt-0.5">
              Новосибирский электромеханический колледж
            </h1>
          </div>
        </div>

        {/* Навигация для десктопа */}
        <nav className="hidden md:flex items-center space-x-6">
          <button 
            onClick={onBackToMain}
            className={`font-sans font-medium text-sm transition-colors duration-150 cursor-pointer ${!isAdmin ? 'text-[#ab2d42] border-b-2 border-[#ab2d42] pb-1' : 'text-slate-600 hover:text-[#ab2d42] pb-1'}`}
          >
            Главная
          </button>
          


          <a 
            href="https://www.xn--j1adc8d.xn--p1ai/contacts/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="font-sans font-medium text-sm text-slate-600 hover:text-[#ab2d42] transition-colors duration-150 pb-1"
          >
            Контакты
          </a>

          {isAdmin && (
            <div className="flex items-center space-x-2 bg-[#ab2d42]/10 text-[#ab2d42] px-3 py-1.5 rounded-full border border-[#ab2d42]/30 text-xs font-semibold">
              <ShieldCheck size={14} />
              <span>Панель Администратора</span>
            </div>
          )}
        </nav>

        {/* Кнопка входа/выхода */}
        <div className="hidden sm:flex items-center space-x-3">
          {isAdmin ? (
            <button
              onClick={onLogoutClick}
              className="flex items-center gap-2 bg-red-50 hover:bg-red-100/80 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 hover:shadow-xs active:scale-98 cursor-pointer"
              id="header-logout-btn"
            >
              <LogOut size={16} />
              <span>Выйти</span>
            </button>
          ) : (
            <button
              onClick={onLoginClick}
              className="flex items-center gap-2 bg-[#ab2d42] hover:bg-[#8c1f2f] border border-[#ab2d42]/20 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-98 cursor-pointer"
              id="header-login-btn"
            >
              <LogIn size={16} />
              <span>Войти</span>
            </button>
          )}
        </div>

        {/* Триггер мобильного меню */}
        <div className="flex items-center sm:hidden space-x-2">
          {isAdmin && (
            <span className="bg-[#ab2d42]/10 text-[#ab2d42] px-2 py-1 rounded-full text-[10px] font-bold border border-[#ab2d42]/20 flex items-center gap-0.5">
              <ShieldCheck size={10} />
              <span>Админ</span>
            </span>
          )}
          <a 
            href="tel:+73833372327" 
            className="p-1.5 text-slate-500 hover:text-[#ab2d42] focus:outline-none focus:ring-2 focus:ring-[#ab2d42] rounded-lg"
            title="Позвонить в приемную комиссию"
          >
            <Phone size={18} />
          </a>
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-slate-500 hover:text-[#ab2d42] focus:outline-none focus:ring-2 focus:ring-[#ab2d42] rounded-lg cursor-pointer"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Выпадающее мобильное меню */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-slate-200 bg-white shadow-lg animate-fadeIn">
          <div className="px-4 py-4 space-y-4">
            <div className="space-y-3">
              <button
                onClick={() => {
                  onBackToMain();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left font-sans font-semibold text-slate-700 hover:text-[#ab2d42] py-1 block cursor-pointer"
              >
                Главная
              </button>

              <a 
                href="https://www.xn--j1adc8d.xn--p1ai/contacts/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-full text-left font-sans font-semibold text-slate-700 hover:text-[#ab2d42] py-1 block"
              >
                Контакты
              </a>
            </div>

            {/* Адрес и контакты для мобильной версии */}
            <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-500 space-y-2">
              <div className="flex items-center gap-2">
                <MapPin size={13} className="text-[#ab2d42] flex-shrink-0" />
                <span>630030, г. Новосибирск, ул. Первомайская, 202</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={13} className="text-[#ab2d42] flex-shrink-0" />
                <a href="tel:+73833372327" className="text-slate-600 hover:text-white hover:underline font-semibold">+7 (383) 337-23-27</a>
              </div>
              <div className="flex items-center gap-2">
                <Globe size={13} className="text-[#ab2d42] flex-shrink-0" />
                <a href="https://нэмк.рф" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-[#ab2d42] hover:underline font-semibold">Официальный сайт: нэмк.рф</a>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-slate-50">
                <svg className="w-3.5 h-3.5 text-[#0077ff] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.14 2H4.86A2.86 2.86 0 0 0 2 4.86v14.28A2.86 2.86 0 0 0 4.86 22h14.28a2.86 2.86 0 0 0 2.86-2.86V4.86A2.86 2.86 0 0 0 19.14 2zm1.61 14.36c.21.43.14.77-.47.77h-1.92c-.51 0-.75-.27-.88-.57 0 0-.98-2.39-2.37-3.94-.45-.45-.65-.6-.9-.6-.12 0-.3.15-.3.57v3.74c0 .51-.15.74-.57.74H10.8c-.32 0-.63-.09-.9-.33-.3-.27-.42-.64-.13-1.01.27-.37.38-1.22.38-1.89V11.2c0-.56-.1-.8-.32-.8-.59 0-2.02 2.4-2.87 5.12-.2.58-.4.81-.92.81H4.12c-.58 0-.7-.27-.7-.57 0-.53.68-3.15 3.25-6.75C8.38 6.85 10.35 5 12.08 5c1.03 0 1.16.23 1.16.63v1.88c0 .51.11.62.47.62.26 0 .72-.13 1.78-1.15a13.3 13.3 0 0 0 2.47-3.32c.18-.32.39-.57.91-.57h1.92c.58 0 .7.28.53.84-.2.57-1.33 3.12-2.13 4.2-.42.54-.56.74-.32 1.07.24.33 1.01 1.01 1.54 1.76 1.01 1.41 1.77 3.03 2.05 3.4z"/>
                </svg>
                <a href="https://vk.com/nemtts_2019" target="_blank" rel="noopener noreferrer" className="text-[#0077ff] hover:underline font-bold">Группа ВКонтакте НЭК</a>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3">
              {isAdmin ? (
                <button
                  onClick={() => {
                    onLogoutClick();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer"
                >
                  <LogOut size={16} />
                  <span>Выйти из панели</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    onLoginClick();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-[#ab2d42] hover:bg-[#8c1f2f] border border-[#ab2d42]/20 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer"
                >
                  <LogIn size={16} />
                  <span>Войти в панель</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
