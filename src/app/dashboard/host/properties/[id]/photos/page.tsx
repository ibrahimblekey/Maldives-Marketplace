import Link from "next/link";
import { MAX_PHOTOS, MIN_PHOTOS } from "@/lib/validation/property";
import { ConfirmButton } from "../../../../_components/confirm-button";
import { keepPhotoAction, movePhotoAction, removePhotoAction } from "../../actions";
import { loadHostProperty } from "../load";
import { PhotoUploader } from "./photo-uploader";
import styles from "../../../../ui.module.css";

export default async function PhotosStepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { property, editable, isLive } = await loadHostProperty(id);
  const images = property.images;
  const kept = images.filter((i) => i.status !== "PENDING_REMOVE").length;
  const coverId = images.find((i) => i.status !== "PENDING_ADD" || !isLive)?.id;

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Photos ({kept})</h2>
        <span className={kept >= MIN_PHOTOS ? styles.success : styles.muted}>
          {kept >= MIN_PHOTOS ? `✓ At least ${MIN_PHOTOS} photos` : `At least ${MIN_PHOTOS} needed: add ${MIN_PHOTOS - kept} more`}
        </span>
      </div>
      <p className={styles.sectionHint}>
        Bright, sharp photos of rooms, bathrooms, the view and the island get the most bookings. The first photo is the
        cover photo travelers see in search.
        {isLive &&
          " New and removed photos are checked by our team before travelers see the change. Changing the order takes effect immediately."}
      </p>

      {editable && <PhotoUploader propertyId={property.id} remainingSlots={MAX_PHOTOS - kept} />}

      {images.length === 0 ? (
        <p className={styles.empty}>No photos yet.</p>
      ) : (
        <div className={styles.photoGrid}>
          {images.map((image, index) => {
            const cardClass =
              image.status === "PENDING_ADD"
                ? styles.photoCardPending
                : image.status === "PENDING_REMOVE"
                  ? styles.photoCardRemoving
                  : styles.photoCard;
            return (
              <div key={image.id} className={cardClass}>
                {/* eslint-disable-next-line @next/next/no-img-element -- plain <img>: host-uploaded photos, no optimisation needed in the dashboard */}
                <img className={styles.photo} src={image.url} alt={`Photo ${index + 1}`} />
                <div className={styles.photoMeta}>
                  <span>
                    {image.id === coverId && <span className={styles.badgeAPPROVED}>Cover photo</span>}{" "}
                    {image.status === "PENDING_ADD" && <span className={styles.badgeChanges}>New, waiting for review</span>}
                    {image.status === "PENDING_REMOVE" && (
                      <span className={styles.badgeREJECTED}>Will be removed after review</span>
                    )}
                  </span>
                  {editable && (
                    <span className={styles.rowActions}>
                      {index > 0 && (
                        <ConfirmButton action={movePhotoAction.bind(null, property.id, image.id, "up")} label="← Earlier" />
                      )}
                      {index < images.length - 1 && (
                        <ConfirmButton action={movePhotoAction.bind(null, property.id, image.id, "down")} label="Later →" />
                      )}
                      {image.id !== coverId && image.status !== "PENDING_REMOVE" && (
                        <ConfirmButton action={movePhotoAction.bind(null, property.id, image.id, "cover")} label="Make cover" />
                      )}
                      {image.status === "PENDING_REMOVE" ? (
                        <ConfirmButton action={keepPhotoAction.bind(null, property.id, image.id)} label="Keep photo" />
                      ) : (
                        <ConfirmButton
                          action={removePhotoAction.bind(null, property.id, image.id)}
                          label="Remove"
                          variant="linkDanger"
                          confirm="Remove this photo?"
                        />
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ marginTop: 20 }}>
        <Link className={styles.buttonSecondary} href={`/dashboard/host/properties/${property.id}/review`}>
          Next: {isLive ? "Overview" : "Review & submit"} →
        </Link>
      </p>
    </section>
  );
}
