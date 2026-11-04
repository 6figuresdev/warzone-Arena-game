/** Money bag marked with USDC, used for the stolen-funds objective. */
export function MoneyBagIcon({ size = 28, tag = true, className = '' }: { size?: number; tag?: boolean; className?: string }) {
  return (
    <svg width={size} height={size * (tag ? 1.18 : 1)} viewBox={tag ? '0 0 64 76' : '0 0 64 64'} className={className} aria-label="USDC money bag" role="img">
      <path d="M22 6c3 3 7 4 10 4s7-1 10-4l-3 10H25z" fill="#d6a85f" stroke="#0b1626" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M25 15h14c10 7 20 17 20 30 0 8-6 14-14 14H19C11 59 5 53 5 45c0-13 10-23 20-30z" fill="#e8bf74" stroke="#0b1626" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="24" y="13" width="16" height="5" rx="2.5" fill="#6b4a2a" stroke="#0b1626" strokeWidth="2" />
      <text x="32" y="46" textAnchor="middle" fontSize="26" fontWeight="800" fill="#1d8a4f" stroke="#0b1626" strokeWidth="0.8" fontFamily="sans-serif">$</text>
      {tag && (
        <>
          <rect x="8" y="58" width="48" height="16" rx="8" fill="#2775ca" stroke="#0b1626" strokeWidth="2" />
          <text x="32" y="70" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" fontFamily="sans-serif">USDC</text>
        </>
      )}
    </svg>
  )
}
