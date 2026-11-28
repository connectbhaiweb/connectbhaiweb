import { Screen } from '../ui/chrome';
import { Button, Row, Section } from '../ui/kit';
import { goHome, goTo } from '../ui/nav';
import { T } from '../ui/text';
import { colors } from '../ui/theme';

export default function NotFound() {
  return (
    <Screen>
      <Section style={{ gap: 12, paddingTop: 64 }}>
        <T f="display" s={28} w={700} accessibilityRole="header">Page not found</T>
        <T c={colors.muted}>The page you opened does not exist or has moved.</T>
        <Row>
          <Button label="Go to the home page" onPress={() => goHome()} />
          <Button label="Run a speed test" variant="ghost" onPress={() => goTo('/speed')} />
        </Row>
      </Section>
    </Screen>
  );
}
