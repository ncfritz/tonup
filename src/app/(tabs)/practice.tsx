import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/ui';

export default function Practice() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('screens.practice')}
      milestone="M6"
      spec="docs/design/screens.md → Practice tab"
    />
  );
}
