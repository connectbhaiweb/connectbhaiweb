import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { Text } from '@/components/text';
import { STORY_CAPTIONS, STORY_SCENES } from '@/lib/story';

/* The website's hero "video": a 15 s loop of 5 scenes (slow net, PIN search, compare, installation, Connected!),
   each shown for 3 s with a caption, plus pause and replay. */
const SCENE_MS = 3000;

export function Story() {
  const [fades] = useState(() => STORY_SCENES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0)));
  const [hop] = useState(() => new Animated.Value(0));
  const [scene, setScene] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(hop, { toValue: -6, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(hop, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [hop]);

  useEffect(() => {
    fades.forEach((v, i) => Animated.timing(v, { toValue: i === scene ? 1 : 0, duration: 450, useNativeDriver: true }).start());
  }, [scene, fades]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setScene(s => (s + 1) % STORY_SCENES.length), SCENE_MS);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <View style={{ borderRadius: 22, overflow: 'hidden', backgroundColor: '#EEF4FF' }}>
      <Animated.View style={{ transform: [{ translateY: hop }], height: undefined, aspectRatio: 480 / 360 }}>
        {STORY_SCENES.map((xml, i) => (
          <Animated.View key={i} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: fades[i] }} pointerEvents="none">
            <SvgXml xml={xml} width="100%" height="100%" />
          </Animated.View>
        ))}
      </Animated.View>
      <View style={{ position: 'absolute', left: 14, right: 14, top: 12 }} pointerEvents="none">
        <View style={{ alignSelf: 'flex-start', backgroundColor: '#0A1B3D', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, maxWidth: '92%' }}>
          <Text style={{ color: scene === 4 ? '#8DB4FF' : '#fff', fontFamily: 'display', fontWeight: '700', fontSize: 13.5 }}>{STORY_CAPTIONS[scene]}</Text>
        </View>
      </View>
      <View style={{ position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', gap: 6 }}>
        <Pressable onPress={() => setPaused(p => !p)} accessibilityRole="button" accessibilityLabel={paused ? 'Play animation' : 'Pause animation'}
          style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(10,27,61,0.85)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={paused ? 'play' : 'pause'} size={16} color="#fff" />
        </Pressable>
        <Pressable onPress={() => { setScene(0); setPaused(false); }} accessibilityRole="button" accessibilityLabel="Replay"
          style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(10,27,61,0.85)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="refresh" size={16} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}
