"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { deletePet, fetchPets, getPetPhotoSignedUrl } from "@/lib/supabase/pets";
import { fetchActiveReportsByPet } from "@/lib/supabase/reports";
import { fetchMyPetsForPlate, ORDER_STATUS_LABEL, type PetForPlate } from "@/lib/supabase/plateOrders";
import type { Pet } from "@/lib/supabase/types";
import type { PetReport } from "@/lib/pets/reports";
import { ageUnitLabels, catColorLabels, sexLabels, speciesLabels, statusLabels } from "@/lib/pets/labels";
import {
  ClockIcon,
  GenderIcon,
  HeartIcon,
  HomeIcon,
  PawIcon,
  PinIcon,
  TagIcon,
} from "@/components/icons/Icon";
import Toast, { type ToastState } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EditPetModal from "@/components/mascotas/EditPetModal";
import styles from "@/components/mascotas/petsList.module.css";
import headStyles from "@/components/mascotas/registerPet.module.css";

const badgeClassByStatus: Record<Pet["status"], string> = {
  at_home: styles.badgeAtHome,
  lost: styles.badgeLost,
  found: styles.badgeFound,
  for_adoption: styles.badgeForAdoption,
};

function StatusIcon({ status }: { status: Pet["status"] }) {
  if (status === "for_adoption") return <HeartIcon size={13} />;
  if (status === "at_home") return <HomeIcon size={13} />;
  return <PinIcon size={13} />;
}

function speciesText(pet: Pet): string {
  return pet.species === "other" ? pet.species_other || "Otro" : speciesLabels[pet.species];
}

function catColorsText(pet: Pet): string {
  return [pet.color_primary, pet.color_secondary, pet.color_tertiary]
    .filter((value): value is string => Boolean(value))
    .map((value) => catColorLabels[value] ?? value)
    .join(", ");
}

function MascotasPanelContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createdName = searchParams.get("created");
  const photoFailed = searchParams.get("photo") === "failed";

  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [pets, setPets] = useState<Pet[]>([]);
  const [reports, setReports] = useState<Record<string, PetReport>>({});
  const [plateInfo, setPlateInfo] = useState<Record<string, PetForPlate>>({});
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [deletingPet, setDeletingPet] = useState<Pet | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
  }, []);

  const loadPets = useCallback(() => {
    return Promise.resolve().then(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const supabase = createSupabaseBrowserClient();
        const [petList, reportMap, plateList] = await Promise.all([
          fetchPets(supabase, { includeArchived: false }),
          fetchActiveReportsByPet(supabase),
          fetchMyPetsForPlate(supabase).catch(() => [] as PetForPlate[]),
        ]);
        setPets(petList);
        setReports(reportMap);
        setPlateInfo(Object.fromEntries(plateList.map((entry) => [entry.petId, entry])));

        const entries = await Promise.all(
          petList
            .filter((pet) => pet.photo_path)
            .map(async (pet) => [pet.id, await getPetPhotoSignedUrl(supabase, pet.photo_path as string)] as const),
        );
        setPhotoUrls(Object.fromEntries(entries.filter((entry): entry is [string, string] => entry[1] !== null)));
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "No fue posible cargar las mascotas.");
      } finally {
        setIsLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (checking) return;
    if (!session) {
      Promise.resolve().then(() => setIsLoading(false));
      return;
    }
    loadPets();
  }, [checking, session, loadPets]);

  async function confirmDelete() {
    if (!deletingPet) return;
    setIsDeleting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await deletePet(supabase, deletingPet.id);
      setToast({ variant: "success", message: `«${deletingPet.name}» se eliminó.` });
      setDeletingPet(null);
      await loadPets();
    } catch (caughtError) {
      setToast({
        variant: "error",
        message: caughtError instanceof Error ? caughtError.message : "No fue posible eliminar la mascota.",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  async function copyPlate(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setToast({ variant: "success", message: "Copiado" });
    } catch {
      setToast({ variant: "error", message: "No fue posible copiar." });
    }
  }

  const hasPets = pets.length > 0;

  return (
    <div>
      <div className={headStyles.pageHead}>
        <h1 className={headStyles.pageTitle}>Mis mascotas</h1>
        <p className={headStyles.pageSubtitle}>Las mascotas que tienes registradas a tu cuidado.</p>
      </div>

      {!checking && !session && (
        <p className={styles.empty}>Inicia sesión con una cuenta real para ver y registrar tus mascotas.</p>
      )}

      {session && !isLoading && (
        pets.length === 0 ? (
          <p className={styles.empty}>
            Todavía no has registrado ninguna mascota.
            <br />
            <Link className={styles.newLink} href="/dashboard/mascotas/nueva">+ Registrar mascota</Link>
          </p>
        ) : (
          <ul className={styles.grid}>
            {pets.map((pet) => {
              const report = reports[pet.id];
              const colors = pet.species === "cat" ? catColorsText(pet) : "";
              return (
                <li key={pet.id} className={styles.card}>
                  {photoUrls[pet.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase Storage
                    <img src={photoUrls[pet.id]} alt={`Foto de ${pet.name}`} className={styles.photo} />
                  ) : (
                    <span className={styles.photoPlaceholder} aria-hidden="true"><PawIcon size={34} /></span>
                  )}

                  <div className={styles.main}>
                    <div className={styles.head}>
                      <PawIcon size={17} className={styles.headIcon} />
                      <span className={styles.petName}>{pet.name}</span>
                    </div>

                    <div className={styles.info}>
                      <span className={styles.infoRow}>
                        <PawIcon size={14} /><span>{speciesText(pet)}</span>
                      </span>
                      {pet.age_value != null && pet.age_unit && (
                        <span className={styles.infoRow}>
                          <ClockIcon size={15} />
                          <span>{pet.age_value} {ageUnitLabels[pet.age_unit].toLowerCase()}</span>
                        </span>
                      )}
                      {pet.sex && (
                        <span className={styles.infoRow}>
                          <GenderIcon size={15} /><span>{sexLabels[pet.sex]}</span>
                        </span>
                      )}
                      {pet.species === "dog" && pet.breed && (
                        <span className={styles.infoRow}>
                          <TagIcon size={15} /><span>{pet.breed}</span>
                        </span>
                      )}
                      {colors && (
                        <span className={styles.infoRow}>
                          <TagIcon size={15} /><span>{colors}</span>
                        </span>
                      )}
                      {pet.status === "lost" && report && (
                        <span className={styles.infoRow}>
                          <PinIcon size={15} /><span>{report.city} · {report.neighborhood}</span>
                        </span>
                      )}
                    </div>

                    {(() => {
                      const info = plateInfo[pet.id];
                      if (info?.plateCode) {
                        return (
                          <div className={styles.plateRow}>
                            <span className={styles.plateLabel}>Placa</span>
                            <span className={styles.plateCode}>{info.plateCode}</span>
                            <button
                              type="button"
                              className={styles.plateCopy}
                              onClick={() => copyPlate(info.plateCode as string)}
                            >
                              Copiar
                            </button>
                          </div>
                        );
                      }
                      if (info?.activeOrderRef) {
                        return (
                          <div className={styles.plateRow}>
                            <span className={styles.plateLabel}>Solicitud de placa</span>
                            <span className={styles.plateCode}>{info.activeOrderRef}</span>
                            <span className={styles.plateHint}>
                              {info.activeOrderStatus ? ORDER_STATUS_LABEL[info.activeOrderStatus] : ""}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    <div className={styles.footer}>
                      <span className={`${styles.statusBadge} ${badgeClassByStatus[pet.status]}`}>
                        <StatusIcon status={pet.status} />
                        {statusLabels[pet.status]}
                      </span>
                      <div className={styles.actions}>
                        {plateInfo[pet.id]?.eligible && (
                          <Link
                            className={styles.actionEdit}
                            href={`/dashboard/mascotas/solicitar-placa?pet=${pet.id}`}
                          >
                            Solicitar placa
                          </Link>
                        )}
                        <button type="button" className={styles.actionEdit} onClick={() => setEditingPet(pet)}>
                          Editar
                        </button>
                        <button type="button" className={styles.actionDelete} onClick={() => setDeletingPet(pet)}>
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}

      {session && isLoading && <p className={styles.loading}>Cargando mascotas…</p>}

      {editingPet && (
        <EditPetModal
          pet={editingPet}
          activeReport={reports[editingPet.id] ?? null}
          onClose={() => setEditingPet(null)}
          onSaved={(name) => {
            setEditingPet(null);
            setToast({ variant: "success", message: `Los cambios de «${name}» se guardaron.` });
            loadPets();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deletingPet)}
        title="Eliminar mascota"
        message={
          deletingPet
            ? `Se eliminará «${deletingPet.name}» de forma permanente.` +
              (reports[deletingPet.id] ? " También se eliminará su reporte de mascota perdida activo." : "")
            : ""
        }
        confirmLabel={isDeleting ? "Eliminando…" : "Sí, eliminar"}
        cancelLabel="Cancelar"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingPet(null)}
      />

      {error ? (
        <Toast variant="error" message={error} onClose={() => setError(null)} />
      ) : toast ? (
        <Toast variant={toast.variant} message={toast.message} onClose={() => setToast(null)} />
      ) : createdName && hasPets ? (
        <Toast
          variant="success"
          message={
            `«${createdName}» se registró correctamente.` +
            (photoFailed ? " La foto no pudo subirse; puedes añadirla más tarde." : "")
          }
          onClose={() => router.replace("/dashboard/mascotas")}
          duration={7000}
        />
      ) : null}
    </div>
  );
}

export default function MascotasPanelPage() {
  return (
    <Suspense fallback={null}>
      <MascotasPanelContent />
    </Suspense>
  );
}
