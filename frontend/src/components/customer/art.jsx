/* Small illustrations used on the customer dashboard, drawn to match the design images. */
export function RouterArt({ on }) {
  const led = on ? "#4ADE80" : "#64748B";
  return (
    <svg className="cu-router-art" viewBox="0 0 120 84" aria-hidden="true">
      <defs>
        <linearGradient id="cuRt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3A4F7A" /><stop offset="1" stopColor="#14213F" /></linearGradient>
        <linearGradient id="cuRtTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5C7AAA" /><stop offset="1" stopColor="#2E426C" /></linearGradient>
      </defs>
      <rect x="27" y="2" width="5" height="44" rx="2.5" fill="#1B2A4C" /><rect x="88" y="2" width="5" height="44" rx="2.5" fill="#1B2A4C" />
      <ellipse cx="60" cy="80" rx="48" ry="3.5" fill="#0A1B3D" opacity=".12" />
      <path d="M12 52q0-10 10-10h76q10 0 10 10v14q0 10-10 10H22q-10 0-10-10z" fill="url(#cuRt)" />
      <path d="M14 50q2-7 9-7h74q7 0 9 7z" fill="url(#cuRtTop)" opacity=".9" />
      {[38, 50, 62].map(x => <circle key={x} cx={x} cy="60" r="4.2" fill={led} />)}
      {on && [38, 50, 62].map(x => <circle key={"g" + x} cx={x} cy="60" r="7" fill={led} opacity=".22" />)}
      {[80, 86, 92].map(x => <rect key={x} x={x} y="58.5" width="3.6" height="3" rx="1" fill="#C9D6EE" />)}
    </svg>
  );
}

export function SignalBars({ level = 4, tone = "#16A34A" }) {
  return (
    <svg className="cu-bars" viewBox="0 0 22 18" aria-hidden="true">
      {[0, 1, 2, 3].map(i => <rect key={i} x={i * 5.6} y={13 - i * 4} width="4" height={5 + i * 4} rx="1" fill={i < level ? tone : "#CBD5E1"} />)}
    </svg>
  );
}

export function PayMarks() {
  return (
    <div className="cu-paymarks" aria-label="Pay with UPI, Visa, Mastercard or RuPay">
      <svg viewBox="0 0 62 20" aria-hidden="true"><text x="0" y="16" fontFamily="Arial,sans-serif" fontStyle="italic" fontWeight="800" fontSize="17" fill="#6B6F78" letterSpacing="1">UPI</text><path d="M44 3l7 7-7 7z" fill="#F47B20" /><path d="M50 3l7 7-7 7z" fill="#11A04A" /></svg>
      <i aria-hidden="true" />
      <svg viewBox="0 0 58 20" aria-hidden="true"><text x="1" y="17" fontFamily="Arial,sans-serif" fontStyle="italic" fontWeight="900" fontSize="19" fill="#1A1F71" letterSpacing=".5">VISA</text></svg>
      <svg viewBox="0 0 36 22" aria-hidden="true"><circle cx="12" cy="11" r="10" fill="#EB001B" /><circle cx="24" cy="11" r="10" fill="#F79E1B" /><path d="M18 3a10 10 0 0 1 0 16 10 10 0 0 1 0-16z" fill="#FF5F00" /></svg>
      <svg viewBox="0 0 76 20" aria-hidden="true"><text x="0" y="16" fontFamily="Arial,sans-serif" fontStyle="italic" fontWeight="900" fontSize="17" fill="#1B2C78">RuPay</text><path d="M63 3l6 7-6 7z" fill="#F47B20" /><path d="M68 3l6 7-6 7z" fill="#11A04A" /></svg>
    </div>
  );
}

export function WaGlyph(props) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>;
}
