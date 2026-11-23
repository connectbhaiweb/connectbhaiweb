import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, T } from '@/components/ui';

/** Shown on a customer tab when nobody, or a non-customer, is logged in. */
export function CustomerGate({ loggedIn }: { loggedIn: boolean }) {
  return (
    <View style={{ padding: 16 }}>
      <Card style={{ gap: 12 }}>
        <T v="h1">{loggedIn ? 'This tab is for customers' : 'Log in to see this'}</T>
        <T v="small" style={{ fontSize: 14.5 }}>{loggedIn ? 'Your role has its own pages.' : 'See your booking, router and payments in one place.'}</T>
        {!loggedIn && <Button label="Log in" onPress={() => router.push('/login')} />}
      </Card>
    </View>
  );
}
