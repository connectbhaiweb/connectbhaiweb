/* Sidebar icons that lucide doesn't have, drawn in the same 24px / stroke style as the design images. */
const base = { viewBox: "0 0 24 24", width: 24, height: 24, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

export function ChatBubbles(props) {
  return (
    <svg {...base} {...props}>
      <path d="M15.5 9.2C15.2 6.3 12.5 4 9.2 4 5.8 4 3 6.4 3 9.3c0 1.2.5 2.3 1.2 3.1L3.6 15l2.9-1.1c.6.2 1.3.4 2 .4" />
      <path d="M21 15.3c0-2.7-2.6-4.8-5.8-4.8s-5.8 2.1-5.8 4.8 2.6 4.8 5.8 4.8c.8 0 1.6-.1 2.3-.4l2.9 1.2-.7-2.8c.8-.8 1.3-1.8 1.3-2.8z" />
    </svg>
  );
}

export function WhatsAppOutline(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.6 20.4l1.2-4.1a8.6 8.6 0 1 1 3.2 3z" />
      <path d="M9.1 8.1c.3-.4.9-.4 1.1 0l.7 1.5c.1.3 0 .6-.2.8l-.5.5c.6 1.2 1.6 2.2 2.8 2.8l.5-.5c.2-.2.5-.3.8-.2l1.5.7c.4.2.4.8 0 1.1-.6.6-1.5.9-2.4.6-2.2-.7-4-2.5-4.7-4.7-.3-.9 0-1.8.4-2.6z" />
    </svg>
  );
}
