import { useState, useEffect, useCallback } from 'react';
import { appClient } from '@/api/appClient';

export function useTokenBalance(userEmail) {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    return appClient.functions.invoke('getUserBalance', {})
      .then((res) => { if (res?.data) setBalance(res.data.balance); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (userEmail) refresh();
  }, [userEmail, refresh]);

  return { balance, loading, refresh };
}