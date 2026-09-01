"use client";

import { useEffect, useState } from "react";
import AdminStatCard from "@/components/admin/AdminStatCard";
import { PawIcon, ActivityIcon, UserIcon } from "@/components/icons/Icon";
import { bulkPetRepository } from "@/lib/pets/bulkPetRepository";
import type { BulkPet, OrgKind, OrgScope } from "@/lib/pets/bulkPets";
import controls from "@/components/ui/controls.module.css";

export default function OrgDashboardStats({ scope, role }: { scope: OrgScope; role: OrgKind }) {
  const [pets, setPets] = useState<BulkPet[] | null>(null);

  useEffect(() => {
    let active = true;
    bulkPetRepository.list(scope).then((list) => {
      if (active) setPets(list);
    });
    return () => {
      active = false;
    };
  }, [scope]);

  if (!pets) return <p className={controls.loading}>Cargando resumen…</p>;

  const total = pets.length;
  const available = pets.filter((pet) => pet.status === "available").length;
  const needsHome = pets.filter((pet) => pet.needsHome).length;
  const needsSponsor = pets.filter((pet) => pet.needsSponsor).length;

  return (
    <div className={controls.statGrid}>
      <AdminStatCard icon={<PawIcon size={22} />} label="Mascotas registradas" value={total} />
      <AdminStatCard icon={<ActivityIcon size={22} />} label="Disponibles" value={available} />
      {role === "fundacion" ? (
        <>
          <AdminStatCard icon={<UserIcon size={22} />} label="Buscando hogar" value={needsHome} />
          <AdminStatCard icon={<UserIcon size={22} />} label="Buscando padrino" value={needsSponsor} />
        </>
      ) : (
        <AdminStatCard
          icon={<ActivityIcon size={22} />}
          label="En tratamiento"
          value={pets.filter((pet) => pet.status === "in_treatment").length}
        />
      )}
    </div>
  );
}
