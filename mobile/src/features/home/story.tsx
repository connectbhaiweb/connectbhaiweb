/* The home page story animation: the website's own drawing and styles in a small WebView (allowed for this one thing). */
import { useMemo } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

import { STORY_CSS, STORY_HTML } from '../../content/generated/story';
import { useLanguage } from '../../i18n/LanguageProvider';
import { colors } from '../../ui/theme';

const page = (body: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>${STORY_CSS}
html,body{margin:0;height:100%;overflow:hidden;background:#EEF4FF;font-family:system-ui,sans-serif;-webkit-user-select:none}
*{box-sizing:border-box}
.story{width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:0}
.story .stage{width:100%;height:100%}
</style></head><body>${body}
<script>
const story = document.getElementById('story');
document.querySelectorAll('.sbtn').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.act === 'story-toggle') { const p = story.classList.toggle('paused'); b.textContent = p ? '▶' : '❚❚'; }
  else story.getAnimations({ subtree: true }).forEach((a) => { a.currentTime = 0; });
}));
</script></body></html>`;

export function Story() {
  const { t, lang } = useLanguage();
  // translate the words in the drawing exactly like the website does: one text node at a time
  const html = useMemo(() => page(lang === 'hi' ? STORY_HTML.replace(/>([^<>]+)</g, (_, text: string) => '>' + t(text) + '<') : STORY_HTML), [t, lang]);
  return (
    <View style={{ height: 153, borderRadius: 22, overflow: 'hidden', backgroundColor: '#EEF4FF' }}>
      <WebView
        originWhitelist={['about:*']}
        source={{ html }}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(r) => r.url === 'about:blank' || r.url.startsWith('data:')}
        style={{ backgroundColor: colors.blueSoft }}
        androidLayerType="hardware"
      />
    </View>
  );
}
