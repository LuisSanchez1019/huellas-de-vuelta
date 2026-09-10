-- Los helpers internos NO deben ser invocables desde el API REST: solo los
-- llaman otras funciones SECURITY DEFINER (que corren como owner y pueden
-- ejecutarlos igual). Sin este REVOKE, un usuario autenticado podria llamar
-- _expire_stale_posters('<org ajena>') y forzar el vencimiento anticipado del
-- poster vigente de otra organizacion.
revoke execute on function public._expire_stale_posters(uuid) from authenticated, anon, public;
revoke execute on function public._poster_caller_org() from authenticated, anon, public;
