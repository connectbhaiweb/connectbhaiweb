export default function manifest() {
  return {
    name: "Connect Bhai",
    short_name: "Connect Bhai",
    description: "Compare broadband plans by PIN code in Indore, request a connection and get Connect Bhai Care.",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F7FD",
    theme_color: "#1450E6",
    icons: [{ src: "/icon.png", sizes: "280x280", type: "image/png" }],
  };
}
