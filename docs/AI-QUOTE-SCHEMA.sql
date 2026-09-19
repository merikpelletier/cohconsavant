
alter table public.ai_model_cost_rates
  add column if not exists quote_enabled boolean not null default false,
  add column if not exists max_runtime_seconds integer,
  add column if not exists output_unit_price_usd numeric,
  add column if not exists quote_variants jsonb not null default '[]'::jsonb;
alter table public.ai_model_cost_rates drop constraint if exists ai_model_cost_rates_billing_type_check;
alter table public.ai_model_cost_rates add constraint ai_model_cost_rates_billing_type_check
  check (billing_type in ('per_prediction','per_second','per_1k_input_tokens','per_1k_output_tokens','per_1k_characters','per_output_second','per_1k_tokens'));
create table public.ai_quotes (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  expires_at timestamptz not null,
  user_id text not null,
  user_email text not null,
  function_name text not null,
  tool_id text not null,
  payload_hash text not null,
  token_price numeric not null check (token_price > 0 and token_price = trunc(token_price)),
  starting_tokens numeric not null,
  estimated_cost_usd numeric not null check (estimated_cost_usd > 0),
  token_value_cad numeric not null check (token_value_cad > 0),
  usd_to_cad_rate numeric not null check (usd_to_cad_rate > 0),
  fx_date text,
  fx_source text,
  plan jsonb not null,
  status text not null default 'quoted' check (status in ('quoted','running','succeeded','failed')),
  charged_tokens numeric not null default 0,
  balance_after numeric,
  result jsonb,
  started_at timestamptz,
  completed_at timestamptz
);
create index ai_quotes_user_created_idx on public.ai_quotes (user_id, created_date desc);
create index ai_quotes_running_idx on public.ai_quotes (started_at) where status='running';
alter table public.ai_quotes enable row level security;
revoke all on public.ai_quotes from public, anon, authenticated;
grant select, insert, update on public.ai_quotes to service_role;
alter table public.ai_usage_events add column if not exists operation_id uuid references public.ai_quotes(id);
create index if not exists ai_usage_events_operation_idx on public.ai_usage_events(operation_id);

create function public.reserve_ai_quote(p_quote_id uuid,p_user_id text,p_hash text,p_admin boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare q public.ai_quotes%rowtype; b public.user_token_balances%rowtype; after_balance numeric; account_count integer;
begin
 select * into q from public.ai_quotes where id=p_quote_id for update;
 if not found or q.user_id<>p_user_id or q.payload_hash<>p_hash then return jsonb_build_object('ok',false,'code',409,'error','Devis invalide.'); end if;
 if q.status='succeeded' then return jsonb_build_object('ok',true,'replay',true,'result',q.result); end if;
 if q.status<>'quoted' then return jsonb_build_object('ok',false,'code',409,'error','Ce devis a déjà été utilisé. Consultez son résultat avant toute nouvelle demande.'); end if;
 if q.expires_at <= now() then return jsonb_build_object('ok',false,'code',409,'error','Le devis a expiré. Demandez un nouveau prix.'); end if;
 if not p_admin then
   select count(*) into account_count from public.user_token_balances where user_email=q.user_email;
   if account_count<>1 then return jsonb_build_object('ok',false,'code',402,'error','Solde absent ou ambigu. Contactez le soutien.'); end if;
   select * into b from public.user_token_balances where user_email=q.user_email for update;
   if b.balance < q.token_price then return jsonb_build_object('ok',false,'code',402,'error','Solde de jetons insuffisant.'); end if;
   after_balance := b.balance-q.token_price;
   update public.user_token_balances set balance=after_balance,last_updated=now(),updated_date=now() where id=b.id;
   insert into public.token_transactions(user_email,transaction_type,token_amount,balance_after,related_entity,created_at,created_by_id)
   values(q.user_email,'usage',-q.token_price,after_balance,'ai_quote:'||q.id,now(),q.user_id);
 else
   select balance into after_balance from public.user_token_balances where user_email=q.user_email limit 1;
 end if;
 update public.ai_quotes set status='running',started_at=now(),updated_date=now(),
 charged_tokens=case when p_admin then 0 else token_price end,balance_after=coalesce(after_balance,0) where id=q.id;
 return jsonb_build_object('ok',true,'replay',false,'balance_after',coalesce(after_balance,0));
end $$;
revoke all on function public.reserve_ai_quote(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.reserve_ai_quote(uuid,text,text,boolean) to service_role;

create function public.finish_ai_quote(p_quote_id uuid,p_user_id text,p_success boolean,p_result jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare q public.ai_quotes%rowtype; b public.user_token_balances%rowtype; after_balance numeric;
begin
 select * into q from public.ai_quotes where id=p_quote_id for update;
 if not found or q.user_id<>p_user_id then raise exception 'Devis introuvable'; end if;
 if q.status in ('succeeded','failed') then return jsonb_build_object('ok',true,'status',q.status); end if;
 if q.status<>'running' then raise exception 'Devis non réservé'; end if;
 after_balance:=q.balance_after;
 if not p_success and q.charged_tokens>0 then
   select * into strict b from public.user_token_balances where user_email=q.user_email for update;
   after_balance:=b.balance+q.charged_tokens;
   update public.user_token_balances set balance=after_balance,last_updated=now(),updated_date=now() where id=b.id;
   insert into public.token_transactions(user_email,transaction_type,token_amount,balance_after,related_entity,created_at,created_by_id)
   values(q.user_email,'refund',q.charged_tokens,after_balance,'ai_quote_refund:'||q.id,now(),q.user_id);
 end if;
 update public.ai_quotes set status=case when p_success then 'succeeded' else 'failed' end,result=p_result,
 balance_after=after_balance,completed_at=now(),updated_date=now() where id=q.id;
 return jsonb_build_object('ok',true,'balance_after',after_balance);
end $$;
revoke all on function public.finish_ai_quote(uuid,text,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.finish_ai_quote(uuid,text,boolean,jsonb) to service_role;
update public.ai_model_cost_rates set billing_type='per_1k_characters',quote_enabled=true
where model_key='elevenlabs/v2-multilingual' and unit_price_usd=0.10;

