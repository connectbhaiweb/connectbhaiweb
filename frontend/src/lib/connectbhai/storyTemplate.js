/* Hero "how it works" animation (original <template id="tpl-story"> markup, unchanged). Rendered by StoryTemplate.jsx. */
const STORY_HTML = `<div class="story" id="story" aria-label="How Connect Bhai works: slow internet, search your PIN code, compare plans, installation, connected">
<svg class="stage" viewBox="0 0 480 360" role="img" aria-hidden="true">
  <defs>
    <linearGradient id="bhaiBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3D7BFF"/><stop offset="1" stop-color="#1243C9"/></linearGradient>
    <linearGradient id="stageBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EEF4FF"/><stop offset="1" stop-color="#DCE7FF"/></linearGradient>
    <radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFD25A" stop-opacity=".9"/><stop offset="1" stop-color="#FFD25A" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="480" height="360" rx="22" fill="url(#stageBg)"/>
  <g opacity=".5" stroke="#B9CCF5" stroke-width="1"><path d="M0 60H480M0 120H480M0 180H480M0 240H480M80 0V360M160 0V360M240 0V360M320 0V360M400 0V360"/></g>
  <rect x="0" y="318" width="480" height="42" fill="#C9D9FA"/>

  <!-- ===== Scene 1 props: phone buffering ===== -->
  <g class="sc sc1">
    <rect x="300" y="96" width="112" height="200" rx="18" fill="#0A1B3D"/>
    <rect x="308" y="110" width="96" height="164" rx="10" fill="#F4F8FF"/>
    <g class="spin" style="transform-origin:356px 178px"><path d="M356 156a22 22 0 1 1 -21 15" fill="none" stroke="#1450E6" stroke-width="7" stroke-linecap="round"/></g>
    <text x="356" y="230" text-anchor="middle" font-family="Manrope,system-ui,sans-serif" font-weight="800" font-size="13" fill="#53617F">Buffering…</text>
    <g fill="#C3D0E8"><rect x="330" y="248" width="8" height="10" rx="2" fill="#E5484D"/><rect x="342" y="243" width="8" height="15" rx="2"/><rect x="354" y="238" width="8" height="20" rx="2"/><rect x="366" y="233" width="8" height="25" rx="2"/></g>
    <g class="sweat"><path d="M268 98c6 10 9 15 9 19a9 9 0 0 1-18 0c0-4 3-9 9-19z" fill="#8DB4FF"/></g>
  </g>

  <!-- ===== Scene 2 props: PIN search ===== -->
  <g class="sc sc2">
    <rect x="222" y="132" width="240" height="64" rx="32" fill="#fff" stroke="#1450E6" stroke-width="4"/>
    <circle cx="258" cy="164" r="13" fill="none" stroke="#1450E6" stroke-width="5"/><path d="M267 173l9 9" stroke="#1450E6" stroke-width="6" stroke-linecap="round"/>
    <clipPath id="typeClip"><rect class="typer" x="286" y="140" width="150" height="48"/></clipPath>
    <text x="290" y="176" clip-path="url(#typeClip)" font-family="'IBM Plex Mono',ui-monospace,monospace" font-weight="600" font-size="30" letter-spacing="4" fill="#0A1B3D">452010</text>
    <g class="pop2"><rect x="250" y="214" width="112" height="32" rx="16" fill="#1450E6"/><text x="306" y="235" text-anchor="middle" font-family="Manrope,system-ui,sans-serif" font-weight="800" font-size="13" fill="#fff">Vijay Nagar</text>
      <rect x="370" y="214" width="80" height="32" rx="16" fill="#fff" stroke="#C3D0E8" stroke-width="2"/><text x="410" y="235" text-anchor="middle" font-family="Manrope,system-ui,sans-serif" font-weight="800" font-size="13" fill="#0A1B3D">9 plans</text></g>
  </g>

  <!-- ===== Scene 3 props: compare plans ===== -->
  <g class="sc sc3">
    <g class="card c1"><rect x="226" y="112" width="74" height="132" rx="12" fill="#fff" stroke="#C3D0E8" stroke-width="2"/><text x="263" y="152" text-anchor="middle" font-family="Sora,Manrope,sans-serif" font-weight="800" font-size="26" fill="#1450E6">50</text><text x="263" y="168" text-anchor="middle" font-family="Manrope,sans-serif" font-weight="700" font-size="11" fill="#53617F">Mbps</text><rect x="240" y="186" width="46" height="8" rx="4" fill="#DCE4F2"/><rect x="240" y="200" width="32" height="8" rx="4" fill="#DCE4F2"/><text x="263" y="232" text-anchor="middle" font-family="Sora,sans-serif" font-weight="800" font-size="14" fill="#0A1B3D">₹449</text></g>
    <g class="card c2"><rect x="306" y="98" width="80" height="148" rx="12" fill="#fff" stroke="#1450E6" stroke-width="4"/><text x="346" y="142" text-anchor="middle" font-family="Sora,Manrope,sans-serif" font-weight="800" font-size="28" fill="#1450E6">100</text><text x="346" y="158" text-anchor="middle" font-family="Manrope,sans-serif" font-weight="700" font-size="11" fill="#53617F">Mbps · OTT</text><rect x="321" y="178" width="50" height="8" rx="4" fill="#DCE4F2"/><rect x="321" y="192" width="36" height="8" rx="4" fill="#DCE4F2"/><text x="346" y="232" text-anchor="middle" font-family="Sora,sans-serif" font-weight="800" font-size="15" fill="#0A1B3D">₹699</text>
      <g class="tick"><circle cx="384" cy="100" r="16" fill="#11804A"/><path d="M376 100l6 6 11-12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g></g>
    <g class="card c3"><rect x="392" y="112" width="74" height="132" rx="12" fill="#fff" stroke="#C3D0E8" stroke-width="2"/><text x="429" y="152" text-anchor="middle" font-family="Sora,Manrope,sans-serif" font-weight="800" font-size="26" fill="#1450E6">300</text><text x="429" y="168" text-anchor="middle" font-family="Manrope,sans-serif" font-weight="700" font-size="11" fill="#53617F">Mbps · TV</text><rect x="406" y="186" width="46" height="8" rx="4" fill="#DCE4F2"/><rect x="406" y="200" width="32" height="8" rx="4" fill="#DCE4F2"/><text x="429" y="232" text-anchor="middle" font-family="Sora,sans-serif" font-weight="800" font-size="14" fill="#0A1B3D">₹1,199</text></g>
  </g>

  <!-- ===== Scene 4 + 5 props: fiber, router, Wi-Fi ===== -->
  <g class="sc sc45">
    <path class="fiber" d="M210 246 C 236 304, 268 302, 300 264" fill="none" stroke="#FFB020" stroke-width="6" stroke-linecap="round" pathLength="100"/>
    <rect x="296" y="236" width="150" height="54" rx="14" fill="#0A1B3D"/>
    <path d="M318 236v-34M424 236v-34" stroke="#0A1B3D" stroke-width="7" stroke-linecap="round"/>
    <g><circle class="led l1" cx="336" cy="263" r="6"/><circle class="led l2" cx="356" cy="263" r="6"/><circle class="led l3" cx="376" cy="263" r="6"/></g>
    <text x="420" y="268" text-anchor="middle" font-family="Manrope,sans-serif" font-weight="800" font-size="11" fill="#8DB4FF">FTTH</text>
    <g class="waves" fill="none" stroke="#1450E6" stroke-width="6" stroke-linecap="round">
      <circle class="w1" cx="371" cy="222" r="5" fill="#1450E6" stroke="none"/>
      <path class="w1" d="M359.7 210.7A16 16 0 0 1 382.3 210.7"/>
      <path class="w2" d="M349.8 200.8A30 30 0 0 1 392.2 200.8"/>
      <path class="w3" d="M339.9 190.9A44 44 0 0 1 402.1 190.9"/>
    </g>
  </g>
  <g class="sc sc5">
    <circle cx="356" cy="120" r="70" fill="url(#glow)"/>
    <rect x="262" y="92" width="190" height="56" rx="28" fill="#11804A"/>
    <path d="M286 120l9 9 16-18" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="378" y="128" text-anchor="middle" font-family="Sora,Manrope,sans-serif" font-weight="800" font-size="22" fill="#fff">Connected!</text>
    <g class="confetti"><rect x="250" y="70" width="8" height="12" rx="2" fill="#FFB020"/><rect x="300" y="56" width="8" height="12" rx="2" fill="#1450E6"/><rect x="420" y="62" width="8" height="12" rx="2" fill="#E5484D"/><rect x="460" y="84" width="8" height="12" rx="2" fill="#11804A"/><circle cx="350" cy="58" r="5" fill="#FFB020"/><circle cx="276" cy="160" r="4" fill="#E5484D"/><circle cx="452" cy="160" r="5" fill="#1450E6"/></g>
  </g>

  <!-- ===== Bhai (mascot) ===== -->
  <g class="bhai" transform="translate(26 92)">
    <ellipse cx="80" cy="228" rx="54" ry="8" fill="#0A1B3D" opacity=".14"/>
    <g class="hop">
      <ellipse cx="56" cy="214" rx="18" ry="10" fill="#0B2C7A"/><ellipse cx="104" cy="214" rx="18" ry="10" fill="#0B2C7A"/>
      <!-- Wi-Fi hair -->
      <g class="hair" fill="none" stroke-linecap="round">
        <path d="M66 34a20 20 0 0 1 28 0" stroke="#fff" stroke-width="7"/>
        <path d="M55 22a36 36 0 0 1 50 0" stroke="#8DB4FF" stroke-width="7"/>
        <path d="M44 10a52 52 0 0 1 72 0" stroke="#1450E6" stroke-width="7"/>
        <circle cx="80" cy="46" r="7" fill="#fff" stroke="none"/>
      </g>
      <!-- left arm -->
      <path d="M22 140 Q4 160 12 182" stroke="url(#bhaiBody)" stroke-width="20" stroke-linecap="round" fill="none"/>
      <circle cx="12" cy="184" r="12" fill="#1243C9"/>
      <!-- head / body -->
      <circle cx="80" cy="124" r="70" fill="url(#bhaiBody)"/>
      <ellipse cx="80" cy="132" rx="52" ry="46" fill="#F4F8FF"/>
      <circle cx="50" cy="144" r="8" fill="#FF8FA3" opacity=".5"/><circle cx="110" cy="144" r="8" fill="#FF8FA3" opacity=".5"/>
      <!-- eyes: normal (blink) -->
      <g class="eyes-normal"><g class="blink" style="transform-origin:80px 120px">
        <ellipse cx="62" cy="120" rx="7.5" ry="10.5" fill="#0A1B3D"/><ellipse cx="98" cy="120" rx="7.5" ry="10.5" fill="#0A1B3D"/>
        <circle cx="64.5" cy="116" r="2.8" fill="#fff"/><circle cx="100.5" cy="116" r="2.8" fill="#fff"/></g></g>
      <!-- eyes: star (connected) -->
      <g class="eyes-star" fill="#FFB020"><path d="M62 108l3.5 7.2 7.9 1.1-5.7 5.6 1.3 7.9-7-3.7-7 3.7 1.3-7.9-5.7-5.6 7.9-1.1z"/><path d="M98 108l3.5 7.2 7.9 1.1-5.7 5.6 1.3 7.9-7-3.7-7 3.7 1.3-7.9-5.7-5.6 7.9-1.1z"/></g>
      <!-- brows: worried (slow internet) -->
      <g class="brows-sad" stroke="#0A1B3D" stroke-width="4" stroke-linecap="round"><path d="M52 104l16 -6"/><path d="M108 104l-16 -6"/></g>
      <!-- mustache (the "Bhai") -->
      <path d="M80 146c-8-7-22-8-30 0-4 4-10 4-13 0 1 11 16 15 27 9 6-3 11-5 16-3 5-2 10 0 16 3 11 6 26 2 27-9-3 4-9 4-13 0-8-8-22-7-30 0z" fill="#0A1B3D"/>
      <!-- mouths -->
      <path class="m-happy" d="M66 160q14 16 28 0z" fill="#0A1B3D"/>
      <path class="m-sad" d="M68 166q12-10 24 0" fill="none" stroke="#0A1B3D" stroke-width="4" stroke-linecap="round"/>
      <!-- right arm (gestures across the story) -->
      <g class="arm" style="transform-origin:140px 132px">
        <g class="wave" style="transform-origin:140px 132px">
          <path d="M138 134 Q162 118 166 96" stroke="url(#bhaiBody)" stroke-width="20" stroke-linecap="round" fill="none"/>
          <circle cx="167" cy="92" r="12" fill="#1243C9"/>
          <g class="plug"><rect x="160" y="70" width="14" height="16" rx="3" fill="#FFB020"/><rect x="164" y="62" width="6" height="9" rx="2" fill="#0A1B3D"/></g>
        </g>
      </g>
    </g>
  </g>
</svg>
<div class="caps" aria-live="off">
  <p class="cap cp1">Net slow? Buffering again?</p>
  <p class="cap cp2">Bhai finds every plan at your PIN code</p>
  <p class="cap cp3">Compare speed, price &amp; OTT side by side</p>
  <p class="cap cp4">Installation tracked till it's live</p>
  <p class="cap cp5"><b>Compare. Choose. Connect.</b></p>
</div>
<div class="story-ctl">
  <button type="button" class="sbtn" data-act="story-toggle" aria-label="Pause animation">❚❚</button>
  <button type="button" class="sbtn" data-act="story-replay" aria-label="Replay">↺</button>
</div>
</div>`;
export default STORY_HTML;
