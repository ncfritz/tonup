import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/ui';

export default function Play() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      overline={t('wordmark')}
      title={t('screens.play')}
      milestone="M4"
      spec="docs/design/screens.md → Play (home)"
    />
  );
}
