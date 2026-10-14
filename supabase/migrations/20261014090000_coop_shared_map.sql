-- 🗺️ обща карта при партньорите: участък/линия, построени от единия, са готови и при другия (клиентът ги показва и ползва).
-- Затова общият обект е „завършен“, щом го е построил поне единият — бонусът и дневният доход се дават и на двамата.
create or replace function coop.joint_done(j coop.joints, p coop.pairs) returns boolean language sql stable as $$
  select case j.kind when 'hw' then coop.has_hw(p.a, j.ref) or coop.has_hw(p.b, j.ref) else coop.has_rail(p.a, j.ref) or coop.has_rail(p.b, j.ref) end
$$;
