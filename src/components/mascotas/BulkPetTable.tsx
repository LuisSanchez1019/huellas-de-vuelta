"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PawIcon } from "@/components/icons/Icon";
import DataTable, { type DataTableColumn, type DataTableFilter } from "@/components/ui/DataTable";
import Toast, { type ToastState } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import BulkPetFormModal from "./BulkPetFormModal";
import { speciesLabels, sexLabels } from "@/lib/pets/labels";
import { bulkPetRepository } from "@/lib/pets/bulkPetRepository";
import { bulkStatusLabels, type BulkPet, type BulkPetInput, type OrgKind, type OrgScope } from "@/lib/pets/bulkPets";
import controls from "@/components/ui/controls.module.css";
import styles from "./bulkPetTable.module.css";

const STATUS_BADGE: Record<BulkPet["status"], string> = {
  available: styles.badgeAvailable,
  in_treatment: styles.badgeTreatment,
  reserved: styles.badgeReserved,
  adopted: styles.badgeAdopted,
};

export default function BulkPetTable({ scope, role }: { scope: OrgScope; role: OrgKind }) {
  const [pets, setPets] = useState<BulkPet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewPet, setViewPet] = useState<BulkPet | null>(null);
  const [editPet, setEditPet] = useState<BulkPet | null>(null);
  const [deletePet, setDeletePet] = useState<BulkPet | null>(null);

  const scopeKey = `${scope.kind}:${scope.id}`;

  const reload = useCallback(() => {
    return Promise.resolve().then(async () => {
      setIsLoading(true);
      try {
        setPets(await bulkPetRepository.list(scope));
      } catch {
        setToast({ variant: "error", message: "No fue posible cargar las mascotas." });
      } finally {
        setIsLoading(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function toggleFlag(pet: BulkPet, flag: "needsHome" | "needsSponsor") {
    setBusyId(pet.id);
    try {
      await bulkPetRepository.setFlags(scope, pet.id, { [flag]: !pet[flag] });
      await reload();
      setToast({
        variant: "success",
        message:
          flag === "needsHome"
            ? !pet.needsHome
              ? `${pet.name} ahora aparece como disponible para adopción.`
              : `${pet.name} ya no aparece en búsqueda de hogar.`
            : !pet.needsSponsor
              ? `${pet.name} ahora acepta padrino monetario.`
              : `${pet.name} ya no busca padrino.`,
      });
    } catch {
      setToast({ variant: "error", message: "No fue posible actualizar la mascota." });
    } finally {
      setBusyId(null);
    }
  }

  async function handleSave(id: string, patch: Partial<BulkPetInput>) {
    await bulkPetRepository.update(scope, id, patch);
    await reload();
    setToast({ variant: "success", message: "Mascota actualizada." });
  }

  async function confirmDelete() {
    if (!deletePet) return;
    setBusyId(deletePet.id);
    try {
      await bulkPetRepository.remove(scope, deletePet.id);
      await reload();
      setToast({ variant: "success", message: `${deletePet.name} se eliminó de la lista.` });
    } catch {
      setToast({ variant: "error", message: "No fue posible eliminar la mascota." });
    } finally {
      setBusyId(null);
      setDeletePet(null);
    }
  }

  const columns = useMemo<DataTableColumn<BulkPet>[]>(() => {
    const base: DataTableColumn<BulkPet>[] = [
      {
        key: "photo",
        header: "Foto",
        render: (pet) =>
          pet.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL provista por la organización
            <img src={pet.photoUrl} alt={pet.name} className={styles.thumb} />
          ) : (
            <span className={styles.thumbPlaceholder} aria-hidden="true"><PawIcon size={18} /></span>
          ),
      },
      { key: "name", header: "Nombre", render: (pet) => <strong>{pet.name}</strong> },
      {
        key: "species",
        header: "Especie",
        render: (pet) => (pet.species === "other" ? pet.speciesOther || "Otro" : speciesLabels[pet.species]),
      },
      { key: "breed", header: "Raza", render: (pet) => pet.breed || "—" },
      { key: "age", header: "Edad", render: (pet) => pet.age || "—" },
      { key: "sex", header: "Sexo", render: (pet) => sexLabels[pet.sex] },
      {
        key: "status",
        header: "Estado",
        render: (pet) => (
          <span className={styles.badgeWrap}>
            <span className={`${styles.badge} ${STATUS_BADGE[pet.status]}`}>{bulkStatusLabels[pet.status]}</span>
            {pet.needsHome && <span className={`${styles.badge} ${styles.badgeHome}`}>Busca hogar</span>}
            {pet.needsSponsor && <span className={`${styles.badge} ${styles.badgeSponsor}`}>Busca padrino</span>}
          </span>
        ),
      },
    ];
    if (role === "fundacion") {
      base.push({ key: "org", header: "Fundación", render: (pet) => pet.orgName });
    }
    base.push({ key: "intake", header: "Fecha de ingreso", render: (pet) => pet.intakeDate });
    base.push({
      key: "actions",
      header: "Opciones",
      render: (pet) => (
        <div className={styles.actions}>
          <button type="button" className={styles.action} onClick={() => setViewPet(pet)}>Ver</button>
          <button type="button" className={styles.action} onClick={() => setEditPet(pet)}>Editar</button>
          <button type="button" className={styles.actionDanger} onClick={() => setDeletePet(pet)}>Eliminar</button>
          {role === "fundacion" && (
            <>
              <button
                type="button"
                className={pet.needsHome ? styles.actionOn : styles.action}
                disabled={busyId === pet.id}
                onClick={() => toggleFlag(pet, "needsHome")}
              >
                {pet.needsHome ? "En búsqueda de hogar" : "Buscar casa"}
              </button>
              <button
                type="button"
                className={pet.needsSponsor ? styles.actionOn : styles.action}
                disabled={busyId === pet.id}
                onClick={() => toggleFlag(pet, "needsSponsor")}
              >
                {pet.needsSponsor ? "Con búsqueda de padrino" : "Buscar padrino monetario"}
              </button>
            </>
          )}
        </div>
      ),
    });
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, busyId]);

  const filters = useMemo<DataTableFilter<BulkPet>[] | undefined>(() => {
    if (role !== "fundacion") return undefined;
    return [
      { id: "home", label: "Buscan hogar", test: (pet) => pet.needsHome },
      { id: "sponsor", label: "Buscan padrino", test: (pet) => pet.needsSponsor },
    ];
  }, [role]);

  if (isLoading) return <p className={controls.loading}>Cargando mascotas…</p>;

  return (
    <>
      {pets.length === 0 ? (
        <p className={controls.empty}>Todavía no hay mascotas cargadas. Usa “Cargar mascotas” para importarlas desde Excel.</p>
      ) : (
        <DataTable
          columns={columns}
          rows={pets}
          getRowId={(pet) => pet.id}
          searchAccessor={(pet) => `${pet.name} ${pet.breed ?? ""}`}
          searchPlaceholder="Buscar por nombre o raza…"
          filters={filters}
          emptyMessage="No hay mascotas con ese criterio."
        />
      )}

      <BulkPetFormModal open={Boolean(viewPet)} mode="view" pet={viewPet} onClose={() => setViewPet(null)} onSave={handleSave} />
      <BulkPetFormModal open={Boolean(editPet)} mode="edit" pet={editPet} onClose={() => setEditPet(null)} onSave={handleSave} />

      <ConfirmDialog
        open={Boolean(deletePet)}
        title="Eliminar mascota"
        message={deletePet ? `Se eliminará "${deletePet.name}" de la lista. Esta acción no se puede deshacer.` : ""}
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeletePet(null)}
      />

      {toast && <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />}
    </>
  );
}
