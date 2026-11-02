import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/ui';

export default function History() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('screens.history')}
      milestone="M7"
      spec="docs/design/screens.md → History tab"
    />
  );
}
