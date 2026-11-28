/* Privacy, terms, refund, shipping and account deletion: the website's text. The app adds a button to delete the
   account on the deletion page. */
import { View } from 'react-native';

import { LEGAL } from '../../content/generated/legal';
import { useSession } from '../../lib/session';
import { openDeleteAccount } from '../account/dialogs';
import { openLogin } from '../account/login';
import { Screen } from '../../ui/chrome';
import { Button, Card, Section } from '../../ui/kit';
import { useOverlay } from '../../ui/overlay';
import { T } from '../../ui/text';
import { colors } from '../../ui/theme';

function DeleteInApp() {
  const overlay = useOverlay();
  const { user } = useSession();
  if (user?.role === 'admin') return null;
  return (
    <Card style={{ marginTop: 12 }}>
      <T f="display" s={18} w={700}>Delete your account in the app</T>
      <T s={14} c={colors.muted}>{user ? 'Confirm your mobile number and the account is deleted at once.' : 'Log in with your mobile number, then delete the account here.'}</T>
      <Button testID="legal-delete" label={user ? 'Delete my account' : 'Log in'} variant={user ? 'danger' : 'primary'} onPress={() => (user ? openDeleteAccount(overlay) : openLogin(overlay))} />
    </Card>
  );
}

export default function LegalScreen({ page }: { page: keyof typeof LEGAL }) {
  const doc = LEGAL[page];
  return (
    <Screen>
      <Section style={{ gap: 12 }}>
        <View style={{ gap: 4, paddingTop: 4 }}>
          <T f="display" s={24} w={700} accessibilityRole="header">{doc.title}</T>
          <T s={14} c={colors.muted}>{doc.updated}</T>
        </View>
        {doc.blocks.map((b, i) =>
          b.h ? (
            <T key={i} f="display" s={18} w={700} style={{ marginTop: 10 }} accessibilityRole="header">{b.h}</T>
          ) : b.list ? (
            <View key={i} style={{ gap: 6 }}>
              {b.list.map((item) => (
                <View key={item} style={{ flexDirection: 'row', gap: 10, paddingLeft: 6 }}>
                  <T raw>•</T>
                  <T style={{ flex: 1 }}>{item}</T>
                </View>
              ))}
            </View>
          ) : (
            <T key={i}>{b.p}</T>
          ),
        )}
        {page === 'delete-account' ? <DeleteInApp /> : null}
      </Section>
    </Screen>
  );
}
