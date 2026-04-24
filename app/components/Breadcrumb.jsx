'use client';

export default function Breadcrumb({ items, onNavigate }) {
  return (
    <nav className="flex items-center gap-1 text-sm flex-wrap">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={item.id} className="flex items-center gap-1">
            {i > 0 && <ChevronIcon />}
            {isLast ? (
              <span className="font-medium text-gray-900">{item.name}</span>
            ) : (
              <button
                onClick={() => onNavigate(i)}
                className="text-brand-600 hover:text-brand-700 hover:underline"
              >
                {item.name}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function ChevronIcon() {
  return (
    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
