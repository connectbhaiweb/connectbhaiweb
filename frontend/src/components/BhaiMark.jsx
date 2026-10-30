/* Connect Bhai mascot logo. `gradId` must be unique per instance on the page (two are rendered: header + footer). */
export default function BhaiMark({ gradId }) {
  return (
    <svg className="bhai-mark" width="38" height="40" viewBox="0 -3 64 67" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3D7BFF" />
          <stop offset="1" stopColor="#1243C9" />
        </linearGradient>
      </defs>
      <g fill="none" strokeLinecap="round" strokeWidth="3.6">
        <path d="M25.5 11.5a9.5 9.5 0 0 1 13 0" stroke="#8DB4FF" />
        <path d="M20 6a17 17 0 0 1 24 0" stroke="#1450E6" />
      </g>
      <circle cx="32" cy="16.5" r="3.2" fill="#1450E6" />
      <circle cx="32" cy="40" r="22" fill={`url(#${gradId})`} />
      <ellipse cx="32" cy="42.5" rx="16.5" ry="14.5" fill="#F4F8FF" />
      <g className="lm-eyes">
        <ellipse cx="26.3" cy="38" rx="2.6" ry="3.5" fill="#0A1B3D" />
        <ellipse className="lm-eyeR" cx="37.7" cy="38" rx="2.6" ry="3.5" fill="#0A1B3D" />
      </g>
      <path d="M32 46.6c-2.6-2.3-7-2.6-9.6 0-1.3 1.3-3.2 1.3-4.2 0 .3 3.5 5.1 4.8 8.6 2.9 1.9-1 3.5-1.6 5.2-1 1.7-.6 3.3 0 5.2 1 3.5 1.9 8.3.6 8.6-2.9-1 1.3-2.9 1.3-4.2 0-2.6-2.6-7-2.3-9.6 0z" fill="#0A1B3D" />
      <path d="M27.6 51.4q4.4 4.6 8.8 0z" fill="#0A1B3D" />
    </svg>
  );
}
