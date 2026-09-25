"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { deletePet, fetchPets } from "@/lib/supabase/pets";
import PetPhoto from "@/components/ui/PetPhoto";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { ownerTagErrorMessage, setPetTagState, type OwnerTagAction } from "@/lib/supabase/qrOwner";
import { fetchActiveReportsByPet } from "@/lib/supabase/reports";
import { fetchMyPetsForPlate, ORDER_STATUS_LABEL, type PetForPlate } from "@/lib/supabase/plateOrders";
import type { Pet } from "@/lib/supabase/types";
import type { PetReport } from "@/lib/pets/reports";
import { ageUnitLabels, catColorLabels, sexLabels, speciesLabels, statusLabels } from "@/lib/pets/labels";
import { HUMAN_AGE_NOTE, formatAge, formatBirthDate, todayLocal } from "@/lib/pets/age";
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
import DeletePetDialog, { type DeleteBusy } from "@/components/mascotas/DeletePetDialog";
import { downloadPetInfoPdf } from "@/lib/pets/petInfoExport";
import { vetErrorMessage } from "@/lib/vet/errors";
import EditPetModal from "@/components/mascotas/EditPetModal";
import { ListSkeletonBody } from "@/components/loading/SkeletonVariants";
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

function MyPetsListContent({ basePath, showPlateOrdering }: { basePath: string; showPlateOrdering: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createdName = searchParams.get("created");
  const photoFailed = searchParams.get("photo") === "failed";

  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [pets, setPets] = useState<Pet[]>([]);
  const [reports, setReports] = useState<Record<string, PetReport>>({});
  const [plateInfo, setPlateInfo] = useState<Record<string, PetForPlate>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [deletingPet, setDeletingPet] = useState<Pet | null>(null);
  const [deleteBusy, setDeleteBusy] = useState<DeleteBusy>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [tagAction, setTagAction] = useState<{ pet: Pet; action: OwnerTagAction } | null>(null);
  const [tagBusy, setTagBusy] = useState(false);

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

  function closeDelete() {
    setDeletingPet(null);
    setDeleteError(null);
  }

  /**
   * Eliminación definitiva. Con `withPdf`, primero se genera y descarga el PDF; solo
   * si eso salió bien se elimina. Si el PDF falla NO se elimina nada (el usuario
   * puede reintentar o elegir "Eliminar sin descargar"). El PDF nunca se guarda.
   */
  async function runDelete(withPdf: boolean) {
    if (!deletingPet || deleteBusy) return;
    const pet = deletingPet;
    const supabase = createSupabaseBrowserClient();
    setDeleteError(null);
    if (withPdf) {
      setDeleteBusy("download");
      try {
        await downloadPetInfoPdf(supabase, pet.id);
      } catch (caughtError) {
        setDeleteError(
          `No se pudo generar el PDF, así que la mascota NO se eliminó. ${vetErrorMessage(caughtError)} Puedes reintentar o elegir «Eliminar sin descargar».`,
        );
        setDeleteBusy(null);
        return;
      }
    }
    setDeleteBusy("delete");
    try {
      await deletePet(supabase, pet.id, pet.photo_path);
      setToast({
        variant: "success",
        message: `«${pet.name}» se eliminó definitivamente.${withPdf ? " El PDF se descargó en tu dispositivo." : ""}`,
      });
      closeDelete();
      await loadPets();
    } catch (caughtError) {
      setDeleteError(caughtError instanceof Error ? caughtError.message : "No fue posible eliminar la mascota.");
    } finally {
      setDeleteBusy(null);
    }
  }

  async function confirmTagAction() {
    if (!tagAction || tagBusy) return;
    const { pet, action } = tagAction;
    setTagBusy(true);
    try {
      await setPetTagState(createSupabaseBrowserClient(), pet.id, action);
      setToast({
        variant: "success",
        message:
          action === "suspend"
            ? `La placa de «${pet.name}» quedó suspendida: su QR ya no muestra el perfil.`
            : `La placa de «${pet.name}» está activa de nuevo.`,
      });
      setTagAction(null);
      await loadPets();
    } catch (caughtError) {
      setToast({ variant: "error", message: ownerTagErrorMessage(caughtError) });
      setTagAction(null);
    } finally {
      setTagBusy(false);
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
            <Link className={styles.newLink} href={`${basePath}/mascotas/nueva`}>+ Registrar mascota</Link>
          </p>
        ) : (
          <ul className={styles.grid}>
            {pets.map((pet) => {
              const report = reports[pet.id];
              const colors = pet.species === "cat" ? catColorsText(pet) : "";
              return (
                <li key={pet.id} className={styles.card}>
                  <PetPhoto
                    path={pet.photo_path}
                    alt={`Foto de ${pet.name}`}
                    className={styles.photo}
                    fallback={<span className={styles.photoPlaceholder} aria-hidden="true"><PawIcon size={34} /></span>}
                  />

                  <div className={styles.main}>
                    <div className={styles.head}>
                      <PawIcon size={17} className={styles.headIcon} />
                      <span className={styles.petName}>{pet.name}</span>
                    </div>

                    <div className={styles.info}>
                      <span className={styles.infoRow}>
                        <PawIcon size={14} /><span>{speciesText(pet)}</span>
                      </span>
                      {pet.birth_date && (
                        <span className={styles.infoRow}>
                          <ClockIcon size={15} />
                          <span>Fecha de nacimiento: {formatBirthDate(pet.birth_date)}</span>
                        </span>
                      )}
                      {pet.birth_date && formatAge(pet.birth_date, todayLocal()) && (
                        <span className={styles.infoRow}>
                          <ClockIcon size={15} />
                          <span>Edad: {formatAge(pet.birth_date, todayLocal())}</span>
                        </span>
                      )}
                      {!pet.birth_date && pet.age_value != null && pet.age_unit && (
                        <span className={styles.infoRow}>
                          <ClockIcon size={15} />
                          <span>Edad: {pet.age_value} {ageUnitLabels[pet.age_unit].toLowerCase()}</span>
                        </span>
                      )}
                      {(pet.birth_date || (pet.age_value != null && pet.age_unit)) && (
                        <p className={styles.ageNote}>{HUMAN_AGE_NOTE}</p>
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
                            {info.plateStatus === "suspended" && <span className={styles.plateHint}>Suspendida</span>}
                            {info.plateStatus === "active" && (
                              <button
                                type="button"
                                className={styles.plateCopy}
                                onClick={() => setTagAction({ pet, action: "suspend" })}
                              >
                                Suspender
                              </button>
                            )}
                            {info.plateStatus === "suspended" && (
                              <button
                                type="button"
                                className={styles.plateCopy}
                                onClick={() => setTagAction({ pet, action: "resume" })}
                              >
                                Reactivar
                              </button>
                            )}
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
                        {showPlateOrdering && plateInfo[pet.id]?.eligible && (
                          <Link
                            className={styles.actionEdit}
                            href={`${basePath}/mascotas/solicitar-placa?pet=${pet.id}`}
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

      {session && isLoading && <ListSkeletonBody />}

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
        open={Boolean(tagAction)}
        title={tagAction?.action === "suspend" ? "Suspender placa" : "Reactivar placa"}
        message={
          tagAction?.action === "suspend"
            ? `Mientras esté suspendida, escanear el QR de «${tagAction.pet.name}» no mostrará su perfil. Puedes reactivarla cuando quieras o reemplazarla escaneando el QR de una placa nueva.`
            : `El QR de «${tagAction?.pet.name ?? ""}» volverá a mostrar su perfil público.`
        }
        confirmLabel={tagBusy ? "Guardando…" : tagAction?.action === "suspend" ? "Sí, suspender" : "Sí, reactivar"}
        cancelLabel="Cancelar"
        tone={tagAction?.action === "suspend" ? "danger" : undefined}
        onConfirm={confirmTagAction}
        onCancel={() => (tagBusy ? undefined : setTagAction(null))}
      />

      <DeletePetDialog
        open={Boolean(deletingPet)}
        petName={deletingPet?.name ?? ""}
        notes={
          deletingPet
            ? [
                ...(reports[deletingPet.id] ? ["También se eliminará su reporte de mascota perdida activo."] : []),
                ...(plateInfo[deletingPet.id]?.plateCode
                  ? [`Su placa ${plateInfo[deletingPet.id].plateCode} quedará anulada y ya no podrá volver a usarse.`]
                  : []),
              ]
            : []
        }
        busy={deleteBusy}
        error={deleteError}
        onDownloadAndDelete={() => runDelete(true)}
        onDeleteOnly={() => runDelete(false)}
        onCancel={closeDelete}
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
          onClose={() => router.replace(`${basePath}/mascotas`)}
          duration={7000}
        />
      ) : null}
    </div>
  );
}

/** Listado de "mis mascotas" reutilizado por el panel de usuario y el de aliado. */
export default function MyPetsList({
  basePath = "/dashboard",
  showPlateOrdering = true,
}: {
  basePath?: string;
  /** El aliado registra mascotas como un usuario normal, pero todavía no pide placas. */
  showPlateOrdering?: boolean;
}) {
  return (
    <Suspense fallback={null}>
      <MyPetsListContent basePath={basePath} showPlateOrdering={showPlateOrdering} />
    </Suspense>
  );
}
