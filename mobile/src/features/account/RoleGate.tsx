/* A dashboard address: the locked screen for anyone without that role. The dashboards themselves are built in the
   next stages; until then this holds their place. */
import { View } from 'react-native';

import { ROLE_NAME, type Role } from '../../lib/api/base';
import { useSession } from '../../lib/session';
import { Screen } from '../../ui/chrome';
import { Button, Card, Eyebrow, Section, Skeleton } from '../../ui/kit';
import { goHome } from '../../ui/nav';
import { useOverlay } from '../../ui/overlay';
import { T } from '../../ui/text';
import { colors } from '../../ui/theme';
import { openAccount } from './dialogs';
import { openLogin } from './login';

export default function RoleGate({ role }: { role: Role }) {
  const overlay = useOverlay();
  const { ready, user, signOut } = useSession();
  if (!ready)
    return (
      <Screen>
        <Section style={{ gap: 12 }}>
          <Skeleton height={30} width="70%" />
          <Skeleton height={120} />
        </Section>
      </Screen>
    );
  if (!user || user.role !== role)
    return (
      <Screen>
        <View style={{ marginVertical: 40, paddingHorizontal: 16, alignItems: 'center', gap: 12 }}>
          <Eyebrow text={`${ROLE_NAME[role]} access`} center />
          <T f="display" s={24} w={700} center accessibilityRole="header">{`Log in as ${ROLE_NAME[role].toLowerCase()} to open this page`}</T>
          <T c={colors.muted} center>{`Each role sees only its own information.${user ? ` You are logged in as ${ROLE_NAME[user.role].toLowerCase()}.` : ''}`}</T>
          <Button testID="locked-login" label="Log in" style={{ alignSelf: 'center' }} onPress={() => openLogin(overlay)} />
        </View>
      </Screen>
    );
  return (
    <Screen footer={false}>
      <Section style={{ gap: 12 }}>
        <Card>
          <Eyebrow text={`${ROLE_NAME[role]} dashboard`} />
          <T testID="who" f="display" s={22} w={700} raw>{user.full_name}</T>
          <T c={colors.muted}>This dashboard is not in the app yet. It is built in a later stage.</T>
          <Button label="Go to website" onPress={() => goHome()} />
          <Button label="My account" variant="ghost" onPress={() => openAccount(overlay)} />
          <Button label="Log out" variant="ghost" onPress={() => signOut().then(() => goHome())} />
        </Card>
      </Section>
    </Screen>
  );
}
