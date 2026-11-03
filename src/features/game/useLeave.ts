import { router, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { removeSession } from '../history/history';

import { useGame } from './store';

/**
 * Leaving a game or drill before it's over (docs/design/screens.md → Scoring): with nothing
 * thrown it simply goes, leaving no trace in History; otherwise you choose to keep it for later
 * (it's resumable from Play) or discard it, which deletes it and its darts.
 */
export function useLeave(kind: 'game' | 'drill', to: Href) {
  const { t } = useTranslation('game');
  // Bots wait while the choice is up.
  const [asking, setAsking] = useState(false);

  const discard = useCallback(() => {
    const game = useGame.getState().game;
    useGame.getState().close();
    if (game) removeSession(game.session.id);
    router.navigate(to);
  }, [to]);

  const leave = useCallback(() => {
    const game = useGame.getState().game;
    if (!game || game.def.result(game.state) !== null) {
      router.navigate(to);
      return;
    }
    if (game.darts.length === 0) {
      discard();
      return;
    }
    setAsking(true);
    Alert.alert(t(`leave.${kind}Title`), t('leave.body'), [
      { text: t('leave.keep'), onPress: () => (setAsking(false), router.navigate(to)) },
      {
        text: t('leave.discard'),
        style: 'destructive',
        onPress: () => (setAsking(false), discard()),
      },
      { text: t('leave.cancel'), style: 'cancel', onPress: () => setAsking(false) },
    ]);
  }, [discard, kind, t, to]);

  return { leave, asking };
}
