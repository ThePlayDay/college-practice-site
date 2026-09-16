import React, { useState } from 'react';
import { X, Award, Flame, Users2, ShieldCheck, Dumbbell, Map, BookOpen, Clock, Globe2 } from 'lucide-react';
import { motion } from 'motion/react';

interface CollegeLifeModalProps {
  onClose: () => void;
}

export default function CollegeLifeModal({ onClose }: CollegeLifeModalProps) {
  const [activeTab, setActiveTab] = useState<'about' | 'specialties' | 'life' | 'gallery'>('about');
  const [selectedGalleryItem, setSelectedGalleryItem] = useState<any | null>(null);

  // Список специальностей
  const specialties = [
    {
      code: '13.02.07',
      name: 'Электроснабжение (по отраслям)',
      desc: 'Подготовка специалистов по монтажу, обслуживанию и проектированию систем электроснабжения промышленных предприятий и гражданских объектов.',
      link: 'https://www.xn--j1adc8d.xn--p1ai/abitur/specialties/13-02-07-elektrosnabzhenie-po-otraslyam-/',
    },
    {
      code: '13.02.13',
      name: 'Эксплуатация и обслуживание электрического и электромеханического оборудования (по отраслям)',
      desc: 'Подготовка техников по обеспечению надежной работы, диагностике, ремонту и сервисному обслуживанию электроустановок и сложного промышленного оборудования.',
      link: 'https://www.xn--j1adc8d.xn--p1ai/abitur/specialties/13-02-11-tekhnicheskaya-ekspluatatsiya-i-obsluzhivanie-elektricheskogo-i-elektromekhanicheskogo-obor/',
    },
    {
      code: '09.02.11',
      name: 'Разработка и управление программным обеспечением',
      desc: 'Подготовка современных разработчиков ПО, веб-разработчиков и специалистов по базам данных, владеющих востребованными языками программирования и методологиями разработки.',
      link: 'https://www.xn--j1adc8d.xn--p1ai/abitur/specialties/razrabotka-i-upravlenie-programmnym-obespecheniem/',
    },
    {
      code: '23.02.04',
      name: 'Техническая эксплуатация подъемно-транспортных, строительных, дорожных машин и оборудования (по отраслям)',
      desc: 'Обучение техников по организации технического обслуживания, ремонта и безопасной эксплуатации подъемных механизмов и строительно-дорожной техники.',
      link: 'https://www.xn--j1adc8d.xn--p1ai/abitur/specialties/23-02-04-tekhnicheskaya-ekspluatatsiya-podemno-transportnykh-stroitelnykh-dorozhnykh-mashin-i-oborud/',
    },
    {
      code: '23.02.05',
      name: 'Эксплуатация транспортного электрооборудования и автоматики (по видам транспорта, за исключением водного)',
      desc: 'Подготовка специалистов по обслуживанию бортового электрооборудования, автоматизированных систем и управляющей электроники на наземном транспорте.',
      link: 'https://www.xn--j1adc8d.xn--p1ai/abitur/specialties/23-02-05-ekspluatatsiya-transportnogo-elektrooborudovaniya-i-avtomatiki-po-vidu-transporta-za-isklyu/',
    },
    {
      code: '23.02.07',
      name: 'Техническое обслуживание и ремонт автотранспортных средств',
      desc: 'Обучение квалифицированных техников по диагностике неисправностей, регулировке, сервисному обслуживанию и ремонту узлов и систем современных автомобилей.',
      link: 'https://www.xn--j1adc8d.xn--p1ai/abitur/specialties/23-02-07-tekhnicheskoe-obsluzhivanie-i-remont-dvigateley-sistem-i-agregatov-avtomobiley/',
    },
    {
      code: '13.01.10',
      name: 'Электромонтер по ремонту и обслуживанию электрооборудования (по отраслям)',
      desc: 'Подготовка рабочих по монтажу кабельных систем, ремонту электрооборудования и сборке распределительных устройств на предприятиях.',
      badge: 'Программа подготовки рабочих',
      link: 'https://www.xn--j1adc8d.xn--p1ai/abitur/specialties/13-01-10-elektromontyer-po-remontu-i-obsluzhivaniyu-elektrooborudovaniya-po-otraslyam-/',
    }
  ];

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
      id="college-life-modal-container"
    >
      <div 
        className="relative bg-white w-full max-w-4xl rounded-[24px] shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] animate-scaleUp text-slate-800"
        id="college-life-modal"
      >
        {/* Кнопка закрытия */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all z-10 cursor-pointer"
          id="close-modal-btn"
        >
          <X size={20} />
        </button>

        {/* Шапка модального окна */}
        <div className="bg-slate-50 border-b border-slate-200 text-slate-800 p-4 sm:p-6 rounded-t-[24px]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#ab2d42]/10 text-[#ab2d42] rounded-full flex items-center justify-center border border-[#ab2d42]/20">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="text-xl font-light font-sans text-slate-900">Жизнь нашего <span className="font-semibold text-[#ab2d42]">колледжа</span></h3>
              <p className="text-xs text-slate-500 mt-0.5">ГБПОУ НСО "Новосибирский электромеханический колледж"</p>
            </div>
          </div>

          {/* Навигация по вкладкам */}
          <div className="flex space-x-2 mt-6 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'about', label: 'О колледже' },
              { id: 'specialties', label: 'Направления' },
              { id: 'life', label: 'Студенческая жизнь' },
              { id: 'gallery', label: 'Фотогалерея' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex-shrink-0 cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#ab2d42] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#ab2d42] hover:bg-slate-100'
                }`}
                id={`tab-${tab.id}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Тело модального окна - прокручиваемый контент */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 text-slate-600 leading-relaxed font-sans text-sm">
          
          {/* Вкладка 1: О колледже */}
          {activeTab === 'about' && (
            <div className="space-y-6 animate-fadeIn" id="tab-about-content">
              <div>
                <h4 className="text-lg font-bold text-[#ab2d42] mb-2">Богатая история и верность традициям</h4>
                <p>
                  Новосибирский электромеханический колледж основан <strong>1 декабря 1943 года</strong>. За восемьдесят лет успешной образовательной деятельности колледж подготовил тысячи высококлассных специалистов, работающих на крупнейших предприятиях Сибири и всей России.
                </p>
                <p className="mt-3">
                  Сегодня наш колледж — это современное многопрофильное учебное заведение с мощной материально-технической базой, передовыми лабораториями и учебными мастерскими, соответствующими лучшим профессиональным стандартам.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="bg-[#ab2d42]/5 p-4 rounded-xl border border-[#ab2d42]/10 flex items-start gap-3">
                  <div className="p-2 bg-[#ab2d42]/10 text-[#ab2d42] rounded-lg">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs sm:text-sm">Опыт обучения</h5>
                    <p className="text-xs text-slate-500 mt-1">Более 80 лет качественной подготовки кадров.</p>
                  </div>
                </div>

                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200/50 flex items-start gap-3">
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                    <Award size={18} />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs sm:text-sm">Трудоустройство</h5>
                    <p className="text-xs text-slate-500 mt-1">92% выпускников успешно находят работу по специальности.</p>
                  </div>
                </div>

                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200/50 flex items-start gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                    <Globe2 size={18} />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs sm:text-sm">Инновации</h5>
                    <p className="text-xs text-slate-500 mt-1">Современные IT-лаборатории, ЧПУ станки и мастерские.</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-md font-bold text-slate-900 mb-2">Наши ключевые преимущества</h4>
                <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600">
                  <li>Бюджетные места по всем ключевым специальностям.</li>
                  <li>Выплата академической и социальной стипендий.</li>
                  <li>Отсрочка от призыва в Вооруженные Силы РФ.</li>
                  <li>Содействие в трудоустройстве и прохождении практики на базе ведущих заводов-партнеров.</li>
                  <li>Развитая инфраструктура: спортивные залы, библиотека, столовая, компьютерные классы.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Вкладка 2: Направления */}
          {activeTab === 'specialties' && (
            <div className="space-y-4 animate-fadeIn" id="tab-specialties-content">
              <p className="text-slate-600 text-xs sm:text-sm mb-4">
                Колледж ведет подготовку квалифицированных специалистов среднего звена по очной и заочной формам обучения. Мы гордимся востребованностью наших направлений подготовки:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {specialties.map(spec => (
                  <a 
                    key={spec.code} 
                    href={spec.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 border border-slate-200 rounded-xl hover:border-[#ab2d42] hover:bg-[#ab2d42]/5 transition-all bg-slate-50/50 flex flex-col justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-bold font-mono text-[#ab2d42] bg-[#ab2d42]/10 border border-[#ab2d42]/20 px-2.5 py-0.5 rounded-full">{spec.code}</span>
                        <span className="text-[9px] sm:text-[10px] text-slate-400 font-semibold uppercase">{spec.badge || 'СПО'}</span>
                      </div>
                      <h5 className="font-bold text-slate-800 text-xs sm:text-sm leading-tight mb-2 group-hover:text-[#ab2d42] transition-colors">{spec.name}</h5>
                      <p className="text-xs text-slate-500 leading-relaxed mb-4">{spec.desc}</p>
                    </div>
                    <div className="text-[10px] text-[#ab2d42] font-semibold flex items-center gap-1 mt-auto self-end opacity-0 group-hover:opacity-100 transition-opacity">
                      Подробнее на сайте &rarr;
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Вкладка 3: Студенческая жизнь */}
          {activeTab === 'life' && (
            <div className="space-y-6 animate-fadeIn" id="tab-life-content">
              <p>
                Внеурочная деятельность в НЭК — это яркая, динамичная и увлекательная среда, где каждый студент может раскрыть свой творческий, спортивный и интеллектуальный потенциал.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 border border-orange-200 flex items-center justify-center flex-shrink-0">
                    <Users2 size={18} />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800 text-sm">Студенческий совет</h5>
                    <p className="text-xs text-slate-500 mt-1">Орган самоуправления, организующий праздники, конкурсы, КВН, тематические дискотеки и молодежные форумы.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 border border-red-200 flex items-center justify-center flex-shrink-0">
                    <Dumbbell size={18} />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800 text-sm">Спортивные секции</h5>
                    <p className="text-xs text-slate-500 mt-1">Волейбол, баскетбол, футбол, настольный теннис. Студенты НЭК регулярно занимают призовые места в городских спартакиадах.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                    <Flame size={18} />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800 text-sm">Волонтерский корпус</h5>
                    <p className="text-xs text-slate-500 mt-1">Активное участие в социальных акциях, благоустройстве города, помощи ветеранам и защите окружающей среды.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#ab2d42]/10 text-[#ab2d42] border border-[#ab2d42]/20 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800 text-sm">Патриотический клуб</h5>
                    <p className="text-xs text-slate-500 mt-1">Участие в военно-патриотических играх, уроках мужества, несении Почетного караула у Монумента Славы.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Вкладка 4: Фотогалерея с резервными вариантами */}
          {activeTab === 'gallery' && (
            <GalleryTabContent 
              onItemClick={(item) => setSelectedGalleryItem(item)} 
            />
          )}

        </div>

        {/* Подвал модального окна */}
        <div className="border-t border-slate-200 p-4 bg-slate-50 rounded-b-[24px] flex flex-col sm:flex-row justify-between items-center gap-3">
          <span className="text-xs text-slate-600 font-medium text-center sm:text-left">Адрес приемной комиссии: 630030, г. Новосибирск, ул. Первомайская, 202</span>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-[#ab2d42] hover:bg-[#8c1f2f] border border-[#ab2d42]/20 text-white font-semibold rounded-lg text-sm transition-all duration-150 cursor-pointer active:scale-98 shadow-md"
            id="modal-close-footer-btn"
          >
            Закрыть
          </button>
        </div>
      </div>

      {/* Модальное окно деталей с эффектом размытия */}
      {selectedGalleryItem && (
        <GalleryDetailModal 
          item={selectedGalleryItem} 
          onClose={() => setSelectedGalleryItem(null)} 
        />
      )}
    </div>
  );
}

// ==================== GALLERY HELPER COMPONENTS & DATA ====================

interface GalleryItem {
  id: number;
  title: string;
  shortDesc: string;
  longDesc: string;
  date: string;
  icon: React.ComponentType<any>;
  imagePrefix: string;
}

const galleryItems: GalleryItem[] = [
  {
    id: 1,
    title: 'Учебные аудитории и мастерские',
    shortDesc: 'Современные оборудованные классы для практических занятий.',
    longDesc: 'Наш колледж располагает современными аудиториями и мастерскими, укомплектованными передовым учебным и промышленным оборудованием. Студенты проходят обучение в условиях, максимально приближенных к реальному производству. В мастерских установлены современные лабораторные стенды по электромонтажу, промышленной автоматике и микропроцессорной технике. Колледж тесно сотрудничает с ведущими предприятиями региона, такими как Новосибирский электровозоремонтный завод (НЭРЗ) и Западно-Сибирская железная дорога (филиал ОАО «РЖД»), обеспечивая студентов отличной базой для практик и трудоустройства.',
    date: 'Ежедневно',
    icon: BookOpen,
    imagePrefix: 'gallery1'
  },
  {
    id: 2,
    title: 'Студенческий совет и КВН',
    shortDesc: 'Эпицентр творческой и общественной активности студентов НЭК.',
    longDesc: 'Студенческое самоуправление — важная часть жизни НЭК. Студсовет организует праздничные концерты, интеллектуальные игры, благотворительные акции и дискотеки. Творческая активность кипит также в волонтерских движениях и патриотических отрядах колледжа. Студенты и активисты КВН регулярно представляют колледж на городских и областных молодежных фестивалях, таких как «Студенческая весна», занимая призовые места и развивая лидерские качества.',
    date: 'В течение года',
    icon: Users2,
    imagePrefix: 'gallery2'
  },
  {
    id: 3,
    title: 'Спортивный комплекс НЭК',
    shortDesc: 'Секции, соревнования и здоровый образ жизни.',
    longDesc: 'Здоровье и спорт — залог успеха! Колледж располагает просторным спортивным залом, тренажерным залом и открытыми спортивными площадками. У нас действуют секции по волейболу, баскетболу, мини-футболу, легкой атлетике и настольному теннису. Сборные команды НЭК регулярно становятся победителями и призерами Спартакиады среди профессиональных образовательных учреждений (ССУЗов) г. Новосибирска и Новосибирской области.',
    date: 'Регулярно',
    icon: Dumbbell,
    imagePrefix: 'gallery3'
  },
  {
    id: 4,
    title: 'Конкурс "Профессионалы"',
    shortDesc: 'Региональные и всероссийские чемпионаты профессионального мастерства.',
    longDesc: 'Наши студенты ежегодно демонстрируют высочайший уровень подготовки на Региональном чемпионате по профессиональному мастерству «Профессионалы» (ранее WorldSkills) Новосибирской области. НЭК традиционно выступает площадкой проведения и забирает призовые места в ключевых компетенциях, таких как «Электромонтаж», «Промышленная автоматика», «Электроника» и «Охрана труда». Это подтверждает высокое качество образования и открырует ребятам двери к ведущим работодателям.',
    date: 'Ежегодно',
    icon: Award,
    imagePrefix: 'gallery4'
  },
  {
    id: 5,
    title: 'Торжественная линейка 1 сентября',
    shortDesc: 'Посвящение в студенты и празднование Дня знаний.',
    longDesc: 'Каждое 1 сентября колледж гостеприимно открывает свои двери для первокурсников. На торжественной линейке, посвященной Дню знаний, звучат напутственные слова от администрации колледжа, почетных гостей и представителей ключевых партнеров-работодателей (включая руководство ОАО «РЖД» и НЭРЗ). Символический ключ знаний передается новому поколению студентов, знаменуя начало пути к востребованной технической профессии.',
    date: '1 сентября',
    icon: Flame,
    imagePrefix: 'gallery5'
  },
  {
    id: 6,
    title: 'Наш учебный полигон',
    shortDesc: 'Практическая отработка навыков на крупногабаритном оборудовании.',
    longDesc: 'Гордость колледжа — собственный учебный полигон НЭК. Это уникальная площадка, где студенты электротехнических и электромеханических специальностей на практике отрабатывают монтаж и обслуживание воздушных и кабельных линий электропередачи, ремонт распределительных устройств, трансформаторных подстанций и тяжелого промышленного оборудования под руководством опытных мастеров производственного обучения.',
    date: 'В период практик',
    icon: Map,
    imagePrefix: 'gallery6'
  }
];

function GalleryTabContent({ onItemClick }: { onItemClick: (item: GalleryItem) => void }) {
  return (
    <div className="space-y-4 animate-fadeIn" id="tab-gallery-content">
      <p className="text-slate-500 text-xs sm:text-sm">
        Здесь представлены яркие моменты из жизни колледжа. Нажмите на любое событие, чтобы открыть подробное описание и фотографии.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
        {galleryItems.map((item) => (
          <div key={item.id}>
            <GalleryCard item={item} onClick={() => onItemClick(item)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function GalleryCard({ item, onClick }: { item: GalleryItem; onClick: () => void }) {
  const [imgIndex, setImgIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  const candidates = [
    `/gallery/${item.imagePrefix}.jpg`,
    `/gallery/${item.imagePrefix}.png`,
    `/gallery/${item.imagePrefix}.jpeg`,
    `/gallery/${item.imagePrefix}.svg`
  ];

  const handleImgError = () => {
    if (imgIndex < candidates.length - 1) {
      setImgIndex(prev => prev + 1);
    } else {
      setFailed(true);
    }
  };

  const IconComponent = item.icon;

  if (failed) {
    return (
      <div 
        onClick={onClick}
        className="bg-slate-50/80 rounded-xl border-2 border-dashed border-slate-300 p-5 flex flex-col items-center justify-center text-center h-48 group hover:border-[#ab2d42]/40 hover:bg-[#ab2d42]/5 transition-all duration-200 cursor-pointer shadow-xs active:scale-98"
      >
        <div className="w-10 h-10 rounded-full bg-white group-hover:bg-[#ab2d42]/10 text-slate-400 group-hover:text-[#ab2d42] flex items-center justify-center mb-3 transition-colors shadow-xs">
          <IconComponent size={20} />
        </div>
        <span className="text-xs font-bold text-slate-700 group-hover:text-[#ab2d42] transition-colors line-clamp-2">{item.title}</span>
        <span className="text-[10px] text-slate-400 mt-2">Загрузите {item.imagePrefix}.jpg</span>
        <span className="text-[10px] text-[#ab2d42] font-medium mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Подробнее &rarr;</span>
      </div>
    );
  }

  return (
    <div 
      onClick={onClick}
      className="relative rounded-xl overflow-hidden h-48 group cursor-pointer border border-slate-150 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300 active:scale-98 bg-slate-100"
    >
      <img 
        src={candidates[imgIndex]} 
        alt={item.title} 
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        onError={handleImgError}
        referrerPolicy="no-referrer"
      />
      {/* Темный градиентный оверлей */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10 group-hover:from-black/90 transition-all duration-300 flex flex-col justify-end p-4">
        <div className="flex items-center gap-1 text-[#ff8ba7] mb-1 font-mono text-[9px] uppercase tracking-wider font-semibold">
          <IconComponent size={10} className="flex-shrink-0" />
          <span>{item.date}</span>
        </div>
        <h5 className="font-bold text-white text-xs sm:text-sm leading-snug drop-shadow-xs line-clamp-2">{item.title}</h5>
        <p className="text-[11px] text-slate-200/90 line-clamp-1 mt-0.5 group-hover:text-white transition-colors">{item.shortDesc}</p>
        <span className="text-[10px] text-[#ff8ba7] font-semibold mt-1 flex items-center gap-1 transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          Подробнее &rarr;
        </span>
      </div>
    </div>
  );
}

function GalleryDetailModal({ item, onClose }: { item: GalleryItem; onClose: () => void }) {
  const [imgIndex, setImgIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  const candidates = [
    `/gallery/${item.imagePrefix}.jpg`,
    `/gallery/${item.imagePrefix}.png`,
    `/gallery/${item.imagePrefix}.jpeg`,
    `/gallery/${item.imagePrefix}.svg`
  ];

  const handleImgError = () => {
    if (imgIndex < candidates.length - 1) {
      setImgIndex(prev => prev + 1);
    } else {
      setFailed(true);
    }
  };

  const IconComponent = item.icon;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/75 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      <div className="relative bg-white w-full max-w-2xl rounded-[24px] shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] animate-scaleUp text-slate-800 overflow-hidden">
        
        {/* Кнопка закрытия внутри шапки/изображения */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-all z-20 cursor-pointer border border-white/10"
        >
          <X size={18} />
        </button>

        {/* Баннер модального окна */}
        <div className="relative h-56 sm:h-64 bg-slate-900 flex-shrink-0">
          {!failed ? (
            <img 
              src={candidates[imgIndex]} 
              alt={item.title} 
              className="w-full h-full object-cover"
              onError={handleImgError}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-tr from-[#7d1c2b] via-[#ab2d42] to-[#c73c52] flex flex-col items-center justify-center text-white p-6 relative">
              <div className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4">
                <IconComponent size={240} />
              </div>
              <div className="w-16 h-16 bg-white/10 border border-white/20 rounded-full flex items-center justify-center mb-3">
                <IconComponent size={32} />
              </div>
            </div>
          )}
          {/* Легкий градиент на нижней части шапки */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-6">
            <div className="flex items-center gap-1.5 text-[#ff8ba7] mb-1.5 font-mono text-xs uppercase tracking-wider font-bold">
              <IconComponent size={14} className="flex-shrink-0" />
              <span>{item.date}</span>
            </div>
            <h4 className="text-xl sm:text-2xl font-bold text-white leading-tight drop-shadow-md">{item.title}</h4>
          </div>
        </div>

        {/* Область контента */}
        <div className="p-6 overflow-y-auto flex-1 font-sans space-y-4 text-slate-600 leading-relaxed text-sm">
          <p className="text-slate-900 font-semibold text-base">
            {item.shortDesc}
          </p>
          <p className="whitespace-pre-line text-slate-600">
            {item.longDesc}
          </p>
        </div>

        {/* Подвал с кнопкой действия */}
        <div className="border-t border-slate-100 p-4 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg text-xs sm:text-sm transition-all cursor-pointer active:scale-98 shadow-sm"
          >
            Вернуться в галерею
          </button>
        </div>
      </div>
    </div>
  );
}
