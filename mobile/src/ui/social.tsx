import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export const FacebookIcon = ({ size = 44 }: { size?: number }) => (
  <Svg viewBox="0 0 48 48" width={size} height={size}>
    <Circle cx="24" cy="24" r="24" fill="#3B5998" />
    <Path fill="#fff" d="M26.5 38V25.7h4.1l.6-4.8h-4.7v-3c0-1.4.4-2.3 2.4-2.3h2.5V11.3c-.4-.1-1.9-.2-3.6-.2-3.6 0-6.1 2.2-6.1 6.3v3.5h-4.1v4.8h4.1V38h4.8z" />
  </Svg>
);
export const InstagramIcon = ({ size = 44 }: { size?: number }) => (
  <Svg viewBox="0 0 48 48" width={size} height={size}>
    <Defs>
      <LinearGradient id="ig" x1="0" y1="1" x2="1" y2="0">
        <Stop offset="0" stopColor="#FEDA75" />
        <Stop offset="0.3" stopColor="#FA7E1E" />
        <Stop offset="0.55" stopColor="#D62976" />
        <Stop offset="0.8" stopColor="#962FBF" />
        <Stop offset="1" stopColor="#4F5BD5" />
      </LinearGradient>
    </Defs>
    <Circle cx="24" cy="24" r="24" fill="url(#ig)" />
    <Rect x="12.5" y="12.5" width="23" height="23" rx="6.5" fill="none" stroke="#fff" strokeWidth="2.6" />
    <Circle cx="24" cy="24" r="5.6" fill="none" stroke="#fff" strokeWidth="2.6" />
    <Circle cx="31" cy="17" r="1.6" fill="#fff" />
  </Svg>
);
