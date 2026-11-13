/* "Bhai" the mascot, as drawn in the dashboard design images (sidebar, above "Compare. Choose. Connect. Care."). */
export default function Mascot({ className }) {
  return (
    <svg className={className} viewBox="18 8 148 166" role="img" aria-label="Bhai, the Connect Bhai mascot">
      <defs>
        <radialGradient id="dshBody" cx=".38" cy=".3" r=".75"><stop offset="0" stopColor="#4A8BFF" /><stop offset=".6" stopColor="#1F62F0" /><stop offset="1" stopColor="#1349D2" /></radialGradient>
        <linearGradient id="dshLimb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2C6DF4" /><stop offset="1" stopColor="#1652E0" /></linearGradient>
        <linearGradient id="dshArc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3C7CFA" /><stop offset="1" stopColor="#2058D8" /></linearGradient>
      </defs>
      <g fill="none" stroke="url(#dshArc)" strokeLinecap="round">
        <path d="M49 27Q74 8 99 27" strokeWidth="5.5" />
        <path d="M57 35Q74 22 91 35" strokeWidth="5" />
        <path d="M64 43Q74 35 84 43" strokeWidth="4.5" />
      </g>
      <circle cx="74" cy="51" r="4" fill="#2D5BC4" />
      <path d="M34 116Q22 128 26 144" stroke="url(#dshLimb)" strokeWidth="12" strokeLinecap="round" fill="none" />
      <circle cx="26" cy="146" r="9" fill="#1A58E6" />
      <ellipse cx="58" cy="165" rx="12" ry="6.5" fill="#1557E6" />
      <ellipse cx="90" cy="165" rx="12" ry="6.5" fill="#1557E6" />
      <circle cx="74" cy="105" r="48" fill="url(#dshBody)" />
      <path d="M108 112Q127 116 142 109" stroke="url(#dshLimb)" strokeWidth="13" strokeLinecap="round" fill="none" />
      <circle cx="145" cy="108" r="9.5" fill="#1A58E6" />
      <rect x="148" y="98" width="11" height="8" rx="3.5" transform="rotate(-24 151 103)" fill="#FFB52E" />
      <rect x="157" y="95" width="5" height="6" rx="2" transform="rotate(-24 157 99)" fill="#1A58E6" />
      <ellipse cx="74" cy="111" rx="34" ry="30.5" fill="#F7F9FF" />
      <g fill="#FFB20F">
        <path d="M61 92.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z" />
        <path d="M87 92.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z" />
      </g>
      <circle cx="53" cy="116" r="5" fill="#F5B8C4" opacity=".85" />
      <circle cx="95" cy="116" r="5" fill="#F5B8C4" opacity=".85" />
      <path d="M74 117c-5-5-15-6-21-1-3 3-7 3-9 0 0 7 10 11 18 7 5-2 8-4 12-3 4-1 7 1 12 3 8 4 18 0 18-7-2 3-6 3-9 0-6-5-16-4-21 1z" fill="#14234A" />
      <path d="M66 126q8 9 16 0z" fill="#14234A" />
    </svg>
  );
}
