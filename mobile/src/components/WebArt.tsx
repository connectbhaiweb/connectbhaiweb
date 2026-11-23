import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { ART_CSS } from '@/lib/web-art.generated';
import { tr, useLang } from '@/lib/i18n';

/* Plays the website's own artwork (SVG + CSS animation) so it looks and moves exactly like the website.
   The markup comes from lib/web-art.generated.ts (scripts/build-web-art.mjs). Visible text goes through the app's Hindi dictionary. */
const JS = `
(function(){
  var post=function(m){window.ReactNativeWebView.postMessage(m)};
  var h=function(){post('h:'+Math.ceil(document.body.getBoundingClientRect().height))};
  new ResizeObserver(h).observe(document.body); h(); setTimeout(h,300); setTimeout(h,1200);
  document.addEventListener('click',function(e){
    var t=e.target.closest('[data-act],[data-go]'); if(!t) return;
    var a=t.getAttribute('data-act'), st=document.getElementById('story');
    if(a==='story-toggle'&&st){var p=st.classList.toggle('paused'); t.textContent=p?'▶':'❚❚'; return;}
    if(a==='story-replay'&&st){st.getAnimations({subtree:true}).forEach(function(x){x.currentTime=0}); return;}
    if(t.getAttribute('data-go')) post('go:'+t.getAttribute('data-go'));
  });
})(); true;`;

const GO: Record<string, '/care' | '/speed' | '/'> = { care: '/care', speed: '/speed', home: '/' };
const translate = (html: string, lang: 'en' | 'hi') => (lang === 'en' ? html : html.replace(/>([^<>]*[A-Za-z][^<>]*)</g, (m, t: string) => `>${tr(t.trim(), lang)}<`));

export function WebArt({ html, minHeight = 60, background = 'transparent', css = '' }: { html: string; minHeight?: number; background?: string; css?: string }) {
  const { lang } = useLang();
  const [h, setH] = useState(minHeight);
  const page = useMemo(
    () => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${ART_CSS}${css}</style></head><body><div id="art">${translate(html, lang)}</div></body></html>`,
    [html, lang, css],
  );
  const onMessage = (e: WebViewMessageEvent) => {
    const m = e.nativeEvent.data;
    if (m.startsWith('h:')) setH(Math.max(minHeight, Number(m.slice(2)) || minHeight));
    else if (m.startsWith('go:') && GO[m.slice(3)]) router.navigate(GO[m.slice(3)]);
  };
  return (
    <View style={{ height: h, backgroundColor: background }}>
      <WebView
        originWhitelist={['*']} source={{ html: page }} style={{ backgroundColor: 'transparent' }} scrollEnabled={false} bounces={false}
        showsVerticalScrollIndicator={false} injectedJavaScript={JS} onMessage={onMessage} javaScriptEnabled
      />
    </View>
  );
}
