import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/ui';

export default function Rules() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('screens.rules')}
      milestone="M8"
      spec="docs/design/screens.md → Rules tab"
    />
  );
}
