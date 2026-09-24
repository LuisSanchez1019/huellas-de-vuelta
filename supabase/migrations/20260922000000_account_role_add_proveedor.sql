-- Agrega el valor 'proveedor' al enum account_role. Debe aplicarse en su
-- propia transacción: Postgres no permite usar un valor de enum recién
-- agregado en la misma transacción que lo agrega.
alter type public.account_role add value if not exists 'proveedor';
