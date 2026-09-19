import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';

export function useCharacterTypes() {
  const { data = [] } = useQuery({
    queryKey: ['characterTypes'],
    queryFn: async () => { const res = await appClient.functions.invoke('manageCharacterType', { action: 'list' }); return res.data.items; },
    staleTime: 30000,
  });
  return data.map(ct => ct.name);
}