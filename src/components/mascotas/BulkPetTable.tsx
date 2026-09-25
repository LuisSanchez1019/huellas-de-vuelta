"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PawIcon } from "@/components/icons/Icon";
import DataTable, { type DataTableColumn, type DataTableFilter } from "@/components/ui/DataTable";
import Toast, { type ToastState } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import BulkPetFormModal from "./BulkPetFormModal";
import type { PreparedPhoto } from "./PetPhotoInput";
import { speciesLabels, sexLabels } from "@/lib/pets/labels";
import { bulkPetRepository, uploadOrgPetPhoto } from "@/lib/pets/bulkPetRepository";
import { bulkStatusLabels, type BulkPet, type BulkPetInput, type OrgKind, type OrgScope } from "@/lib/pets/bulkPets";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { forgetPetPhoto, getPetPhotoUrl } from "@/lib/supabase/petPhotos";
import { removePetPhoto } from "@/lib/supabase/pets";
import PetPhoto from "@/components/ui/PetPhoto";
import { getSupabaseUserId } from "@/lib/auth/session";
import { TableSkeletonBody } from "@/components/loading/SkeletonVariants";
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
  const [createOpen, setCreateOpen] = useState(false);
  const [deletePet, setDeletePet] = useState<BulkPet | null>(null);

  const scopeKey = `${scope.kind}:${scope.id}`;

  const reload = useCallback(() => {
    return Promise.resolve().then(async () => {
      setIsLoading(true);
      try {
        const list = await bulkPetRepository.list(scope);
        setPets(list);
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

  // Vista previa de la foto en el editor: se firma al abrirlo (nunca una URL guardada).
  const [editPreview, setEditPreview] = useState<{ id: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!editPet?.photoPath) return;
    let alive = true;
    const id = editPet.id;
    getPetPhotoUrl(editPet.photoPath).then((url) => {
      if (alive) setEditPreview({ id, url });
    });
    return () => {
      alive = false;
    };
  }, [editPet]);
  const editPreviewUrl = editPet
    ? editPet.photoPath
      ? editPreview?.id === editPet.id
        ? editPreview.url
        : null
      : editPet.photoUrl
    : null;

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

  async function handleSave(id: string, patch: Partial<BulkPetInput>, photo: PreparedPhoto | null) {
    let nextPatch = patch;
    if (photo && (await getSupabaseUserId())) {
      const supabase = createSupabaseBrowserClient();
      const previousPath = pets.find((pet) => pet.id === id)?.photoPath ?? null;
      const path = await uploadOrgPetPhoto(supabase, scope.id, id, photo.blob, photo.contentType);
      nextPatch = { ...patch, photoPath: path };
      await bulkPetRepository.update(scope, id, nextPatch);
      // Foto nueva = ruta nueva: se borra la anterior (mejor esfuerzo) y se olvida su firma.
      if (previousPath && previousPath !== path) {
        forgetPetPhoto(previousPath);
        void removePetPhoto(supabase, previousPath);
      }
      await reload();
      setToast({ variant: "success", message: "Mascota actualizada." });
      return;
    }
    await bulkPetRepository.update(scope, id, nextPatch);
    await reload();
    setToast({ variant: "success", message: "Mascota actualizada." });
  }

  async function handleCreate(input: BulkPetInput, photo: PreparedPhoto | null) {
    const [created] = await bulkPetRepository.createMany(scope, [input]);
    if (created && photo && (await getSupabaseUserId())) {
      const supabase = createSupabaseBrowserClient();
      const path = await uploadOrgPetPhoto(supabase, scope.id, created.id, photo.blob, photo.contentType);
      await bulkPetRepository.update(scope, created.id, { photoPath: path });
    }
    await reload();
    setToast({ variant: "success", message: `${input.name} se agregó a la lista.` });
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
        render: (pet) => {
          const placeholder = <span className={styles.thumbPlaceholder} aria-hidden="true"><PawIcon size={18} /></span>;
          return (
            <div className={styles.photoCell}>
              {pet.photoPath || pet.photoUrl ? (
                <PetPhoto path={pet.photoPath} url={pet.photoUrl} alt={pet.name} className={styles.thumb} fallback={placeholder} />
              ) : (
                <>
                  {placeholder}
                  <span className={styles.noPhotoLabel}>Sin foto</span>
                </>
              )}
            </div>
          );
        },
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
          <button
            type="button"
            className={pet.photoPath || pet.photoUrl ? styles.action : styles.actionOn}
            onClick={() => setEditPet(pet)}
          >
            {pet.photoPath || pet.photoUrl ? "Cambiar foto" : "Agregar foto"}
          </button>
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

  return (
    <>
      <div className={controls.buttonRow} style={{ marginBottom: "1.25rem" }}>
        <button type="button" className={controls.button} onClick={() => setCreateOpen(true)}>
          Agregar mascota
        </button>
      </div>

      {isLoading ? (
        <TableSkeletonBody />
      ) : pets.length === 0 ? (
        <p className={controls.empty}>
          Todavía no hay mascotas. Usa “Agregar mascota” para registrarlas una por una, o “Cargar
          mascotas” para importarlas desde Excel.
        </p>
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
      <BulkPetFormModal
        open={Boolean(editPet)}
        mode="edit"
        pet={editPet}
        photoPreviewUrl={editPreviewUrl}
        onClose={() => setEditPet(null)}
        onSave={handleSave}
      />
      <BulkPetFormModal
        open={createOpen}
        mode="create"
        pet={null}
        onClose={() => setCreateOpen(false)}
        onSave={handleSave}
        onCreate={handleCreate}
      />

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
