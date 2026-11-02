import { useTranslation } from 'react-i18next';

import { DevMenu } from '@/dev/DevMenu';
import { PlaceholderScreen } from '@/ui';

export default function Settings() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('screens.settings')}
      milestone="M9"
      spec="docs/design/screens.md → Settings › Appearance"
    >
      {__DEV__ ? <DevMenu /> : null}
    </PlaceholderScreen>
  );
}
