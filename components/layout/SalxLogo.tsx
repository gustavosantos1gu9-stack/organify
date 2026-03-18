// components/layout/SalxLogo.tsx
// Coloque este arquivo em: components/layout/SalxLogo.tsx

import React from 'react'

interface SalxLogoProps {
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
  collapsed?: boolean
}

export function SalxLogo({ showText = true, size = 'md', collapsed = false }: SalxLogoProps) {
  const iconSize = size === 'sm' ? 28 : size === 'lg' ? 48 : 36

  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* Ícone: barras de crescimento + seta */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Barra esquerda */}
        <rect x="4" y="22" width="10" height="20" rx="1.5" fill="url(#bar1)" />
        {/* Barra direita */}
        <rect x="18" y="14" width="10" height="28" rx="1.5" fill="url(#bar2)" />
        {/* Curva base da seta */}
        <path
          d="M6 38 Q20 28 34 10"
          stroke="url(#arrowGrad)"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        {/* Seta para cima */}
        <path
          d="M28 6 L38 6 L38 16"
          stroke="url(#arrowGrad)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M33 5 L39 11"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
        />

        <defs>
          <linearGradient id="bar1" x1="9" y1="22" x2="9" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#29ABE2" />
            <stop offset="100%" stopColor="#1a7cb0" />
          </linearGradient>
          <linearGradient id="bar2" x1="23" y1="14" x2="23" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#29ABE2" />
            <stop offset="100%" stopColor="#1a7cb0" />
          </linearGradient>
          <linearGradient id="arrowGrad" x1="6" y1="38" x2="38" y2="6" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#29ABE2" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
        </defs>
      </svg>

      {/* Texto */}
      {showText && !collapsed && (
        <div className="flex flex-col leading-none">
          <span
            style={{
              fontFamily: "'Inter', 'Arial Black', sans-serif",
              fontWeight: 900,
              fontSize: size === 'sm' ? '16px' : size === 'lg' ? '26px' : '20px',
              color: '#ffffff',
              letterSpacing: '0.04em',
              lineHeight: 1,
            }}
          >
            SALX
          </span>
          <span
            style={{
              fontFamily: "'Inter', 'Arial', sans-serif",
              fontWeight: 700,
              fontSize: size === 'sm' ? '8px' : size === 'lg' ? '13px' : '10px',
              color: '#29ABE2',
              letterSpacing: '0.25em',
              lineHeight: 1,
              marginTop: '2px',
            }}
          >
            CONVERT
          </span>
        </div>
      )}
    </div>
  )
}
