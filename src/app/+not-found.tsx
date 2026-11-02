import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, Screen, Text } from '@/ui';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <Screen edges={['top', 'bottom']}>
      <Text variant="heading" accessibilityRole="header">
        {t('notFound.title')}
      </Text>
      <Link href="/" asChild>
        <Button label={t('notFound.goHome')} />
      </Link>
    </Screen>
  );
}
