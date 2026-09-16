import React, { useState, useEffect } from 'react';
import { Question, Submission } from '../types';
import { User, Users, Compass, CheckCircle2, ChevronRight, HelpCircle, GraduationCap, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { getCaptchaChallenge } from '../dataStore';

interface QuestionnaireProps {
  questions: Question[];
  onSubmit: (submission: {
    applicantName: string;
    referrerName: string;
    referrerType?: 'student' | 'staff' | null;
    answers: { [qId: string]: string };
  }) => Promise<any> | void;
  onOpenLifeModal: () => void;
}

export default function Questionnaire({ questions, onSubmit, onOpenLifeModal }: QuestionnaireProps) {
  const [applicantName, setApplicantName] = useState('');
  const [referrerName, setReferrerName] = useState('');
  const [referrerType, setReferrerType] = useState<'student' | 'staff' | null>(null);
  const [answers, setAnswers] = useState<{ [qId: string]: string }>({});
  const [customAnswers, setCustomAnswers] = useState<{ [qId: string]: string }>({});
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Состояния для согласия на обработку ПДн (ФЗ-152)
  const [consentChecked, setConsentChecked] = useState(false);
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);

  // Состояния для математической капчи (анти-бот)
  const [captchaId, setCaptchaId] = useState('');
  const [captchaNum1, setCaptchaNum1] = useState(2);
  const [captchaNum2, setCaptchaNum2] = useState(2);
  const [captchaInput, setCaptchaInput] = useState('');

  const generateCaptcha = async () => {
    try {
      const challenge = await getCaptchaChallenge();
      setCaptchaId(challenge.id);
      setCaptchaNum1(challenge.num1);
      setCaptchaNum2(challenge.num2);
    } catch (e) {
      console.error("Не удалось получить капчу с сервера:", e);
    }
    setCaptchaInput('');
  };

  // Очистка старых черновиков из localStorage (ФЗ-152) для исключения хранения ПДн в браузере
  useEffect(() => {
    try {
      localStorage.removeItem('nemk_form_draft');
    } catch (e) {}
    generateCaptcha();
  }, []);

  const handleSelectChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    // Сброс ошибки при выборе значения
    if (errors[questionId]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[questionId];
        return copy;
      });
    }
  };

  const handleCustomChange = (questionId: string, value: string) => {
    setCustomAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const toggleReferrerType = (type: 'student' | 'staff') => {
    setReferrerType(prev => prev === type ? null : type);
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    
    const applicantNameTrimmed = applicantName.trim();
    if (!applicantNameTrimmed) {
      newErrors.applicantName = 'Пожалуйста, введите Ваше ФИО';
    } else {
      const nameRegex = /^[a-zA-Zа-яА-ЯёЁ\s-]+$/;
      if (!nameRegex.test(applicantNameTrimmed)) {
        newErrors.applicantName = 'ФИО абитуриента должно состоять только из букв, пробелов и дефисов';
      } else if (applicantNameTrimmed.split(/\s+/).length < 2) {
        newErrors.applicantName = 'Введите, пожалуйста, фамилию и имя полностью';
      }
    }

    const refNameTrimmed = referrerName.trim();
    const refNameLower = refNameTrimmed.toLowerCase();
    const isNegative = ['нет', 'никто', 'никого', 'нет никто', 'нет никого'].includes(refNameLower);

    if (!refNameTrimmed) {
      newErrors.referrerName = 'Пожалуйста, укажите ФИО того, кто посоветовал колледж (или "Нет", если никто)';
    } else if (!isNegative) {
      const hasLetters = /[a-zA-Zа-яА-ЯёЁ]/.test(refNameTrimmed);
      if (!hasLetters) {
        newErrors.referrerName = 'ФИО должно содержать буквы (имя человека или "Нет")';
      }
    }

    questions.forEach(q => {
      if (q.required && !answers[q.id]) {
        newErrors[q.id] = 'Пожалуйста, выберите один из вариантов';
      }
      if ((answers[q.id] === 'Другое (свой вариант)' || answers[q.id] === 'другое') && !customAnswers[q.id]?.trim()) {
        newErrors[`custom_${q.id}`] = 'Пожалуйста, введите свой вариант ответа';
      }
    });

    if (!consentChecked) {
      newErrors.consent = 'Необходимо подтвердить согласие на обработку персональных данных';
    }

    const cAns = parseInt(captchaInput);
    if (!captchaInput.trim() || isNaN(cAns) || cAns !== captchaNum1 + captchaNum2) {
      newErrors.captcha = 'Пожалуйста, решите математический пример верно';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      // Формирование итоговых ответов на вопросы
      const finalAnswers: { [qId: string]: string } = {};
      questions.forEach(q => {
        if (answers[q.id] === 'Другое (свой вариант)' || answers[q.id] === 'другое') {
          finalAnswers[q.id] = `Другое: ${customAnswers[q.id].trim()}`;
        } else {
          finalAnswers[q.id] = answers[q.id];
        }
      });

      const cAns = parseInt(captchaInput);

      await onSubmit({
        applicantName: applicantName.trim(),
        referrerName: referrerName.trim(),
        referrerType,
        answers: finalAnswers,
        consent: true,
        consentVersion: "17.07.2026_site_4",
        captchaId,
        captchaAnswer: cAns
      } as any);

      // Очищаем черновик при успешной отправке
      localStorage.removeItem('nemk_form_draft');
      setFormSubmitted(true);
    } catch (err: any) {
      setSubmitError(err.message || "Произошла ошибка при отправке анкеты. Пожалуйста, попробуйте позже.");
      generateCaptcha(); // Обновляем капчу при ошибке
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setApplicantName('');
    setReferrerName('');
    setReferrerType(null);
    setAnswers({});
    setCustomAnswers({});
    setConsentChecked(false);
    setErrors({});
    setSubmitError(null);
    localStorage.removeItem('nemk_form_draft');
    generateCaptcha(); // Обновляем капчу при сбросе
    setFormSubmitted(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6" id="questionnaire-component">
      {/* Карточка анкеты */}
      <div className="bg-white border border-slate-200 rounded-[32px] shadow-lg overflow-hidden text-slate-800">
        {/* Стиль заголовка карточки, соответствующий современным порталам колледжей */}
        <div className="border-b border-slate-100 px-4 sm:px-8 py-6 sm:py-8 text-slate-800 relative bg-slate-50">
          <div className="absolute right-6 top-6 opacity-10 hidden sm:block">
            <GraduationCap size={120} className="text-[#ab2d42]" />
          </div>
          <h2 className="text-xl sm:text-2xl font-light font-sans tracking-tight text-slate-900">
            Анкета <span className="font-semibold text-[#ab2d42]">абитуриента</span> НЭК
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-1.5 max-w-md leading-relaxed">
            Добро пожаловать! Заполните, пожалуйста, эту небольшую анкету. Ваши ответы помогут нам сделать колледж еще лучше!
          </p>
        </div>

        {formSubmitted ? (
          <div className="p-6 sm:p-8 text-center" id="submission-success-view">
            <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-200">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 font-sans">Анкета успешно отправлена!</h3>
            <p className="text-slate-600 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
              Спасибо за Ваши ответы! Ваша анкета была успешно зарегистрирована в базе данных НЭК.
            </p>
            <button
              onClick={handleReset}
              className="mt-6 inline-flex items-center gap-2 bg-[#ab2d42] hover:bg-[#8c1f2f] text-white font-semibold py-2.5 px-6 rounded-xl text-xs sm:text-sm transition-all shadow-md shadow-[#ab2d42]/10 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 active:scale-98"
              id="reset-form-btn"
            >
              <span>Заполнить еще раз</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 sm:p-8 space-y-6" id="questionnaire-form">
            {/* Поле ввода ФИО абитуриента */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                <User size={16} className="text-[#ab2d42]" />
                ФИО абитуриента <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={applicantName}
                onChange={(e) => {
                  const val = e.target.value;
                  const filtered = val.replace(/[^a-zA-Zа-яА-ЯёЁ\s-]/g, '');
                  setApplicantName(filtered);
                  if (errors.applicantName) {
                    setErrors(prev => {
                      const copy = { ...prev };
                      delete copy.applicantName;
                      return copy;
                    });
                  }
                }}
                placeholder="Иванов Иван Иванович"
                className={`w-full px-4 py-2.5 bg-white border text-sm text-slate-800 placeholder-slate-400 rounded-lg transition-all focus:outline-hidden focus:ring-2 focus:ring-[#ab2d42]/20 ${errors.applicantName ? 'border-red-500 bg-red-50/50 focus:border-red-500' : 'border-slate-200 focus:border-[#ab2d42]'}`}
                id="applicant-name-input"
              />
              {errors.applicantName && (
                <p className="text-xs text-red-500 mt-1 font-medium">{errors.applicantName}</p>
              )}
            </div>

            {/* Поле ввода ФИО рекомендовавшего */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Users size={16} className="text-[#ab2d42]" />
                ФИО того кто посоветовал колледж <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={referrerName}
                onChange={(e) => {
                  const val = e.target.value;
                  const filtered = val.replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s.,()\-/\\]/g, '');
                  setReferrerName(filtered);
                  if (errors.referrerName) {
                    setErrors(prev => {
                      const copy = { ...prev };
                      delete copy.referrerName;
                      return copy;
                    });
                  }
                }}
                placeholder="Друг, родители, ФИО знакомого или 'Нет'"
                className={`w-full px-4 py-2.5 bg-white border text-sm text-slate-800 placeholder-slate-400 rounded-lg transition-all focus:outline-hidden focus:ring-2 focus:ring-[#ab2d42]/20 ${errors.referrerName ? 'border-red-500 bg-red-50/50 focus:border-red-500' : 'border-slate-200 focus:border-[#ab2d42]'}`}
                id="referrer-name-input"
              />

              {/* Кнопки быстрого выбора */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-slate-500">Кто посоветовал:</span>
                <button
                  type="button"
                  onClick={() => toggleReferrerType('student')}
                  className={`text-[11px] sm:text-xs px-2.5 py-1 rounded-full border transition-all cursor-pointer font-medium flex items-center gap-1 active:scale-95 ${
                    referrerType === 'student'
                      ? 'bg-[#ab2d42]/10 border-[#ab2d42]/40 text-[#ab2d42] font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  🎓 Студент
                </button>
                <button
                  type="button"
                  onClick={() => toggleReferrerType('staff')}
                  className={`text-[11px] sm:text-xs px-2.5 py-1 rounded-full border transition-all cursor-pointer font-medium flex items-center gap-1 active:scale-95 ${
                    referrerType === 'staff'
                      ? 'bg-[#ab2d42]/10 border-[#ab2d42]/40 text-[#ab2d42] font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  💼 Сотрудник колледжа
                </button>
              </div>

              <p className="text-[11px] text-slate-400">Если никто не советовал, напишите "Никто" или "Нет"</p>
              {errors.referrerName && (
                <p className="text-xs text-red-500 mt-1 font-medium">{errors.referrerName}</p>
              )}
            </div>

            {/* Контейнер вопросов */}
            <div className="border-t border-slate-100 pt-6 space-y-6">
              {questions.map((question, index) => (
                <div key={question.id} className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700 flex items-start gap-2">
                    <span className="w-5 h-5 bg-[#ab2d42]/10 text-[#ab2d42] text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border border-[#ab2d42]/20">
                      {index + 1}
                    </span>
                    <span className="flex-1">{question.text} {question.required && <span className="text-red-500">*</span>}</span>
                  </label>

                  {question.type === 'select' && question.options && (
                    <div className="grid grid-cols-1 gap-2.5">
                      {question.options.map((option, optIdx) => {
                        const isSelected = answers[question.id] === option;
                        return (
                          <button
                            type="button"
                            key={`${question.id}-${optIdx}-${option}`}
                            onClick={() => handleSelectChange(question.id, option)}
                            className={`w-full text-left px-4 py-3 rounded-xl border text-xs sm:text-sm transition-all flex items-center justify-between gap-2 cursor-pointer ${
                              isSelected
                                ? 'bg-[#ab2d42]/10 border-[#ab2d42]/40 text-[#ab2d42] font-medium ring-2 ring-[#ab2d42]/20'
                                : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-[#ab2d42]/5 hover:text-[#ab2d42]'
                            }`}
                            id={`option-${question.id}-${option.replace(/\s+/g, '-').toLowerCase()}`}
                          >
                            <span className="flex-1 text-left pr-1 leading-snug">{option}</span>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-[#ab2d42] bg-[#ab2d42]' : 'border-slate-300 bg-white'}`}>
                              {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Если выбран собственный вариант, показываем поле ввода */}
                  {(answers[question.id] === 'Другое (свой вариант)' || answers[question.id] === 'другое') && (
                    <div className="mt-2 animate-slideDown">
                      <input
                        type="text"
                        value={customAnswers[question.id] || ''}
                        onChange={(e) => {
                          handleCustomChange(question.id, e.target.value);
                          if (errors[`custom_${question.id}`]) {
                            setErrors(prev => {
                              const copy = { ...prev };
                              delete copy[`custom_${question.id}`];
                              return copy;
                            });
                          }
                        }}
                        placeholder="Напишите, пожалуйста, свой вариант"
                        className={`w-full px-4 py-2.5 bg-white border text-sm text-slate-800 placeholder-slate-400 rounded-lg transition-all focus:outline-hidden focus:ring-2 focus:ring-[#ab2d42]/30 ${errors[`custom_${question.id}`] ? 'border-red-500 bg-red-50/50 focus:border-red-500' : 'border-slate-200 focus:border-[#ab2d42]'}`}
                        id={`custom-input-${question.id}`}
                      />
                      {errors[`custom_${question.id}`] && (
                        <p className="text-xs text-red-500 mt-1 font-medium">{errors[`custom_${question.id}`]}</p>
                      )}
                    </div>
                  )}

                  {errors[question.id] && (
                    <p className="text-xs text-red-500 mt-1 font-medium">{errors[question.id]}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Согласие на обработку персональных данных (ФЗ-152) */}
            <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl" id="pd-consent-block">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => {
                    setConsentChecked(e.target.checked);
                    if (errors.consent) {
                      setErrors(prev => {
                        const copy = { ...prev };
                        delete copy.consent;
                        return copy;
                      });
                    }
                  }}
                  className="mt-1 h-4 w-4 text-[#ab2d42] border-slate-300 rounded focus:ring-[#ab2d42]/30 cursor-pointer"
                  id="consent-checkbox-input"
                />
                <span className="text-xs text-slate-600 leading-relaxed select-none">
                  Я даю согласие ГБПОУ НСО "НЭК" на обработку моих персональных данных (ФИО, ответы на анкету, сведения о рекомендации) в соответствии с ФЗ-152 для сбора профориентационной статистики.
                </span>
              </label>
              
              <div className="text-[11px] text-slate-500 pl-7 space-y-1">
                <button
                  type="button"
                  onClick={() => setShowPrivacyDetails(!showPrivacyDetails)}
                  className="text-[#ab2d42] hover:underline font-semibold focus:outline-hidden inline-flex items-center gap-1"
                  id="toggle-privacy-details-btn"
                >
                  {showPrivacyDetails ? 'Скрыть подробные условия' : 'Показать подробные условия (ФЗ-152)'}
                </button>
                
                {showPrivacyDetails && (
                  <div className="mt-2 p-3 bg-white border border-slate-200 rounded-lg text-slate-600 space-y-2 animate-slideDown" id="privacy-policy-text">
                    <p><strong>Цель обработки:</strong> проведение профориентационного анкетирования абитуриентов, определение каналов информирования, сбор статистики по Первомайскому району и Новосибирску.</p>
                    <p><strong>Состав данных:</strong> ФИО абитуриента, ФИО рекомендовавшего лица, его отношение к колледжу, ответы на вопросы о выборе специальности и досуговой деятельности.</p>
                    <p><strong>Срок хранения:</strong> 1 год (после чего данные гарантированно удаляются).</p>
                    <p><strong>Порядок отзыва согласия:</strong> Вы можете отозвать согласие в любой момент, направив письменное заявление в приемную комиссию колледжа по адресу: г. Новосибирск, ул. Первомайская, 202, после чего Ваши данные будут удалены из базы в течение 3 рабочих дней.</p>
                  </div>
                )}
              </div>
              {errors.consent && (
                <p className="text-xs text-red-500 pl-7 mt-1 font-medium">{errors.consent}</p>
              )}
            </div>

            {/* Математическая Капча (Анти-бот) */}
            <div className="space-y-2.5 bg-slate-50 border border-slate-200/60 p-4 sm:p-5 rounded-2xl" id="captcha-container">
              <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#ab2d42]" />
                Проверка на робота <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                <div className="bg-slate-200 text-slate-800 font-mono font-bold text-base px-4 py-2 rounded-xl select-none shadow-inner">
                  {captchaNum1} + {captchaNum2} =
                </div>
                <input
                  type="text"
                  value={captchaInput}
                  onChange={(e) => {
                    setCaptchaInput(e.target.value.replace(/\D/g, ''));
                    if (errors.captcha) {
                      setErrors(prev => {
                        const copy = { ...prev };
                        delete copy.captcha;
                        return copy;
                      });
                    }
                  }}
                  placeholder="Ответ"
                  maxLength={3}
                  className={`w-28 px-4 py-2.5 bg-white border text-sm text-slate-800 placeholder-slate-400 rounded-lg transition-all focus:outline-hidden focus:ring-2 focus:ring-[#ab2d42]/20 ${errors.captcha ? 'border-red-500 bg-red-50/50 focus:border-red-500' : 'border-slate-200 focus:border-[#ab2d42]'}`}
                  id="captcha-input-field"
                />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Пожалуйста, сложите эти два числа, чтобы подтвердить отправку анкеты.
              </p>
              {errors.captcha && (
                <p className="text-xs text-red-500 font-medium mt-1">{errors.captcha}</p>
              )}
            </div>

            {/* Сообщение об ошибке */}
            {submitError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs sm:text-sm flex items-start gap-3 animate-slideDown" id="submit-error-message">
                <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{submitError}</span>
              </div>
            )}

            {/* Кнопка отправки */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full border text-white font-semibold py-3.5 px-6 rounded-xl text-sm shadow-md transition-all duration-200 flex items-center justify-center gap-2 ${
                isSubmitting 
                  ? 'bg-slate-400 border-slate-400 cursor-not-allowed opacity-75' 
                  : 'bg-[#ab2d42] hover:bg-[#8c1f2f] border-[#ab2d42]/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-98 cursor-pointer shadow-[#ab2d42]/10'
              }`}
              id="submit-questionnaire-btn"
            >
              <span>{isSubmitting ? 'Отправка...' : 'Отправить анкету'}</span>
              {!isSubmitting && <ChevronRight size={16} />}
            </button>
          </form>
        )}
      </div>

      {/* Навигационные кнопки под анкетой (Слева: Жизнь колледжа, Справа: Отзывы) */}
      <div className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
          <button
            onClick={onOpenLifeModal}
            className="flex-grow flex items-center justify-center gap-4 px-6 py-4 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-2xl font-semibold text-sm text-slate-700 hover:scale-102 transition-all cursor-pointer active:scale-98 shadow-sm"
            id="btn-college-life"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-[#ab2d42] animate-pulse"></div>
            <span>Жизнь нашего колледжа</span>
          </button>

          <a
            href="https://2gis.ru/novosibirsk/firm/141265769341673/tab/reviews"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-grow flex items-center justify-center gap-4 px-6 py-4 bg-[#ab2d42] hover:bg-[#8c1f2f] border border-[#ab2d42]/10 hover:scale-105 rounded-2xl font-semibold text-sm text-white transition-all cursor-pointer active:scale-98 shadow-md"
            id="btn-college-reviews"
          >
            <GraduationCap size={18} className="text-white" />
            <span>Отзывы о НЭК</span>
          </a>
        </div>

        <a
          href="https://www.xn--j1adc8d.xn--p1ai/abitur/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-3 px-6 py-4 bg-slate-800 hover:bg-[#ab2d42] text-white hover:scale-102 rounded-2xl font-semibold text-sm transition-all cursor-pointer active:scale-98 shadow-md"
          id="btn-college-for-applicants"
        >
          <GraduationCap size={18} />
          <span>Для абитуриентов</span>
        </a>
      </div>
    </div>
  );
}
