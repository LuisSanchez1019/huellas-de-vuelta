// Datos de prueba para la landing pública.
// Estructura pensada para reemplazarse luego por datos reales de Supabase
// (pets, organizations, storage) sin cambiar la forma de los componentes.

export type MockPetStatus = "lost" | "found";

export interface MockPet {
  id: string;
  name: string;
  species: string;
  breed: string;
  location: string;
  reportedAgo: string;
  status: MockPetStatus;
  colorFrom: string;
  colorTo: string;
}

export const mockPets: MockPet[] = [
  { id: "luna", name: "Luna", species: "Perro", breed: "Labrador", location: "Bucaramanga", reportedAgo: "Hace 2 días", status: "lost", colorFrom: "#17223f", colorTo: "#1f6fb2" },
  { id: "milo", name: "Milo", species: "Gato", breed: "Mestizo", location: "Girón", reportedAgo: "Hoy", status: "found", colorFrom: "#0f8c82", colorTo: "#2fbf7c" },
  { id: "rocky", name: "Rocky", species: "Perro", breed: "Mestizo", location: "Floridablanca", reportedAgo: "Hace 1 día", status: "lost", colorFrom: "#1f6fb2", colorTo: "#14a89d" },
  { id: "nina", name: "Nina", species: "Gato", breed: "Siamés", location: "Piedecuesta", reportedAgo: "Hace 3 días", status: "found", colorFrom: "#2fbf7c", colorTo: "#0f8c82" },
  { id: "toby", name: "Toby", species: "Perro", breed: "Criollo", location: "Bucaramanga", reportedAgo: "Hace 5 horas", status: "lost", colorFrom: "#17223f", colorTo: "#14a89d" },
];

export interface MockPartner {
  id: string;
  name: string;
  kind: string;
}

export const mockFoundations: MockPartner[] = [
  { id: "amigos-fieles", name: "Fundación Amigos Fieles", kind: "Fundación" },
  { id: "huellas-de-amor", name: "Huellas de Amor", kind: "Fundación" },
  { id: "patitas-felices", name: "Patitas Felices", kind: "Refugio" },
  { id: "refugio-san-roque", name: "Refugio San Roque", kind: "Refugio" },
];

export interface MockVeterinary {
  id: string;
  name: string;
  city: string;
  description: string;
}

export const mockVeterinaries: MockVeterinary[] = [
  { id: "vetcare", name: "VetCare", city: "Bucaramanga", description: "Atención general y urgencias." },
  { id: "san-rafael", name: "San Rafael Veterinaria", city: "Bucaramanga", description: "Medicina interna y cirugía." },
  { id: "petsalud", name: "PetSalud Clínico Veterinaria", city: "Floridablanca", description: "Vacunación y control." },
  { id: "animal-medical", name: "Animal Medical Center", city: "Girón", description: "Diagnóstico por imágenes." },
];

export interface MockAdoption {
  id: string;
  name: string;
  species: string;
  age: string;
  location: string;
  colorFrom: string;
  colorTo: string;
}

export const mockAdoptions: MockAdoption[] = [
  { id: "coco", name: "Coco", species: "Perro", age: "2 años", location: "Bucaramanga", colorFrom: "#0f8c82", colorTo: "#2fbf7c" },
  { id: "maya", name: "Maya", species: "Gata", age: "1 año", location: "Girón", colorFrom: "#1f6fb2", colorTo: "#14a89d" },
  { id: "simon", name: "Simón", species: "Perro", age: "4 años", location: "Piedecuesta", colorFrom: "#17223f", colorTo: "#1f6fb2" },
  { id: "bella", name: "Bella", species: "Gata", age: "8 meses", location: "Floridablanca", colorFrom: "#2fbf7c", colorTo: "#0f8c82" },
];

export interface MockStat {
  id: string;
  value: string;
  label: string;
}

export const mockStats: MockStat[] = [
  { id: "helped", value: "4.321", label: "Mascotas ayudadas" },
  { id: "reunited", value: "2.876", label: "Reencuentros felices" },
  { id: "adopted", value: "1.943", label: "Adopciones responsables" },
  { id: "cities", value: "18", label: "Ciudades activas" },
];
