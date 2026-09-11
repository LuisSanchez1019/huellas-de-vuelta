import ProfileForm from "@/components/dashboard/ProfileForm";
import controls from "@/components/ui/controls.module.css";

export default function Page() {
  return (
    <div>
      <div className={controls.pageHead}>
        <h1 className={controls.pageTitle}>Mi perfil</h1>
        <p className={controls.pageSubtitle}>Tu nombre y teléfonos de contacto. Solo tú puedes verlos y cambiarlos.</p>
      </div>
      <ProfileForm />
    </div>
  );
}
