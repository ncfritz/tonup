import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { latestUnfinished } from '@/services/db/sessionsRepo';
import { Button, PlaceholderScreen } from '@/ui';

export default function Play() {
  const { t } = useTranslation();
  const { t: tg } = useTranslation('game');
  const [resumable, setResumable] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      setResumable(latestUnfinished('game'));
    }, []),
  );
  return (
    <PlaceholderScreen
      overline={t('wordmark')}
      title={t('screens.play')}
      milestone="M4"
      spec="docs/design/screens.md → Play (home)"
    >
      <Button
        label={tg('home.newGame')}
        onPress={() => router.push('/new-game')}
        testID="new-game"
      />
      {resumable ? (
        <Button
          kind="secondary"
          label={tg('home.resume')}
          onPress={() =>
            router.push({ pathname: '/game/[sessionId]', params: { sessionId: resumable } })
          }
          testID="resume-game"
        />
      ) : null}
    </PlaceholderScreen>
  );
}
