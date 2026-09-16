import React, { useState } from 'react';
import { Question } from '../types';
import { X, Users, AlertCircle } from 'lucide-react';

interface PieChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: Question;
  breakdown: Record<string, number>;
  totalResponses: number;
}

// Цветовая палитра круговой диаграммы, вдохновленная прикрепленным изображением
const PIE_COLORS = [
  '#ff5a79', // Розово-красный (Рок)
  '#38bdf8', // Небесно-голубой (Поп)
  '#ffcc4d', // Золотисто-желтый (Хип-хоп)
  '#4bc2c5', // Бирюзовый (Классика)
  '#9f66ff', // Фиолетово-сиреневый (Джаз)
  '#ff9f43', // Оранжевый (Электронная)
  '#94a3b8', // Серый (Другое)
  '#2dd4bf', // Дополнительный бирюзовый светлый
  '#ec4899', // Дополнительный розовый насыщенный
  '#a855f7', // Дополнительный пурпурный
];

export default function PieChartModal({ isOpen, onClose, question, breakdown, totalResponses }: PieChartModalProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  // Сортируем варианты ответов по популярности для красивого вывода
  const sortedEntries = (Object.entries(breakdown) as [string, number][])
    .sort((a, b) => b[1] - a[1]);

  const totalVotes = sortedEntries.reduce((sum, [_, count]) => sum + count, 0);

  // Вычисление пути для сектора SVG
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInRadians: number) => {
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  const getSlicePath = (
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ) => {
    const start = polarToCartesian(centerX, centerY, radius, endAngle);
    const end = polarToCartesian(centerX, centerY, radius, startAngle);

    const angleDiff = endAngle - startAngle;
    const largeArcFlag = angleDiff <= Math.PI ? 0 : 1;

    return [
      'M', centerX, centerY,
      'L', start.x, start.y,
      'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
      'Z',
    ].join(' ');
  };

  const svgSize = 320;
  const center = svgSize / 2;
  const radius = 130;

  // Отрисовка секторов круга
  let currentAngle = -Math.PI / 2; // Начинаем с 12 часов (-90 градусов в радианах)

  const slices = sortedEntries.map(([optionText, count], idx) => {
    const percentage = totalVotes > 0 ? count / totalVotes : 0;
    const angleDelta = percentage * 2 * Math.PI;

    const startAngle = currentAngle;
    const endAngle = currentAngle + angleDelta;
    currentAngle = endAngle;

    if (count === 0 || percentage === 0) return null;

    // Расчет смещения для интерактивного эффекта наведения (выталкивание сектора наружу по биссектрисе)
    const midAngle = startAngle + angleDelta / 2;
    const shift = 10; // Смещение в пикселях
    const dx = Math.cos(midAngle) * shift;
    const dy = Math.sin(midAngle) * shift;

    const color = PIE_COLORS[idx % PIE_COLORS.length];

    return {
      optionText,
      count,
      percentage,
      color,
      startAngle,
      endAngle,
      dx,
      dy,
    };
  }).filter(Boolean);

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
      id="pie-chart-modal-overlay"
    >
      <div 
        className="relative bg-white w-full max-w-2xl rounded-[32px] shadow-2xl border border-slate-100 flex flex-col p-6 sm:p-8 animate-scaleUp text-slate-800"
        onClick={(e) => e.stopPropagation()}
        id="pie-chart-modal-card"
      >
        {/* Кнопка закрытия */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
          title="Закрыть окно"
          id="close-pie-modal-btn"
        >
          <X size={20} />
        </button>

        {/* Заголовок диаграммы */}
        <div className="text-center mb-6 pr-6">
          <h3 className="text-xl sm:text-2xl font-bold font-sans text-slate-900 tracking-tight leading-tight">
            {question.text}
          </h3>
          <p className="text-sm text-slate-500 mt-1.5 flex items-center justify-center gap-1.5 font-medium">
            <Users size={16} className="text-[#ab2d42]" />
            <span>Опрос {totalResponses} абитуриентов</span>
          </p>
        </div>

        {/* Тело модального окна - Диаграмма и Легенда */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-4">
          
          {/* Область SVG диаграммы */}
          <div className="relative w-[320px] h-[320px] flex items-center justify-center shrink-0">
            {totalVotes === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-8 bg-slate-50 border border-slate-100 rounded-full w-[260px] h-[260px]">
                <AlertCircle size={32} className="text-slate-400 mb-2" />
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">Нет ответов для построения диаграммы</p>
              </div>
            ) : (
              <svg 
                width={svgSize} 
                height={svgSize} 
                viewBox={`0 0 ${svgSize} ${svgSize}`}
                className="overflow-visible"
              >
                {slices.map((slice, idx) => {
                  if (!slice) return null;
                  
                  // Если сектор один и равен 100%
                  const isFullCircle = Math.abs(slice.percentage - 1) < 0.001;
                  const isHovered = hoveredIndex === idx;

                  return (
                    <g 
                      key={`slice-g-${idx}-${slice.optionText}`}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      {isFullCircle ? (
                        <circle
                          cx={center}
                          cy={center}
                          r={radius}
                          fill={slice.color}
                          stroke="#ffffff"
                          strokeWidth={2}
                          className="transition-transform duration-300"
                          style={{
                            transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                            transformOrigin: 'center',
                            cursor: 'pointer',
                          }}
                        />
                      ) : (
                        <path
                          d={getSlicePath(center, center, radius, slice.startAngle, slice.endAngle)}
                          fill={slice.color}
                          stroke="#ffffff"
                          strokeWidth={2}
                          style={{
                            transform: isHovered ? `translate(${slice.dx}px, ${slice.dy}px)` : 'none',
                            transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                            transformOrigin: `${center}px ${center}px`,
                            cursor: 'pointer',
                          }}
                        />
                      )}
                    </g>
                  );
                })}

                {/* Белый центральный круг для создания эффекта "Donut Chart" (если нужно, но в референсе сплошной Pie Chart) */}
                {/* Здесь мы оставляем классический сплошной Pie Chart, как в референсе от пользователя */}
              </svg>
            )}
          </div>

          {/* Легенда диаграммы */}
          <div className="flex-1 w-full space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {slices.length === 0 ? (
              <p className="text-slate-500 text-sm italic text-center py-8">Варианты отсутствуют</p>
            ) : (
              slices.map((slice, idx) => {
                if (!slice) return null;
                const isHovered = hoveredIndex === idx;
                const pctFormatted = Math.round(slice.percentage * 100);

                return (
                  <div
                    key={`legend-item-${idx}-${slice.optionText}`}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all duration-150 ${
                      isHovered
                        ? 'bg-slate-50 border-slate-300 shadow-xs translate-x-1'
                        : 'border-transparent bg-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Цветной маркер легенды */}
                      <div
                        className="w-4 h-4 rounded-md shrink-0 transition-transform duration-200"
                        style={{
                          backgroundColor: slice.color,
                          transform: isHovered ? 'scale(1.2)' : 'scale(1)',
                        }}
                      />
                      <span className="text-xs font-semibold text-slate-700 truncate" title={slice.optionText}>
                        {slice.optionText}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pl-3 shrink-0">
                      <span className="text-xs font-bold text-slate-800">{slice.count}</span>
                      <span className="text-[10px] font-extrabold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full min-w-[34px] text-center">
                        {pctFormatted}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* Футер модального окна */}
        <div className="border-t border-slate-100 pt-5 mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-all duration-150 cursor-pointer active:scale-98 shadow-sm"
          >
            Закрыть статистику
          </button>
        </div>
      </div>
    </div>
  );
}
