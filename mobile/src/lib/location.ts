/* The phone's position, asked for only when someone taps a location button. */
import * as Location from 'expo-location';

import { AppError } from './api/base';

const DENIED = 'Allow location access, or type your PIN code.';

export async function currentPosition(): Promise<{ lat: number; lng: number }> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new AppError(DENIED);
  let clock: ReturnType<typeof setTimeout> | undefined;
  try {
    const slow = new Promise<null>((resolve) => {
      clock = setTimeout(() => resolve(null), 10000);
    });
    const now = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), slow]);
    const position = now || (await Location.getLastKnownPositionAsync({ maxAge: 60000 }));
    if (!position) throw new AppError(DENIED);
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(DENIED);
  } finally {
    clearTimeout(clock);
  }
}
