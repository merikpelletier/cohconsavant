import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';

export default function AIStartingPrice({ toolId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['aiStartingPrice', toolId],
    queryFn: () => appClient.entities.ToolPricing.filter({ tool_id: toolId, is_active: true }),
    staleTime: 60000,
  });
  const cost = Number(data?.[0]?.token_cost);
  return <span>{isLoading ? 'Calcul du prix de départ…' : cost > 0 ? 'À partir de ' + cost + ' jetons · prix final à confirmer' : 'Tarification à configurer'}</span>;
}
