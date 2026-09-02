import type { BulkPet, OrgKind } from "./bulkPets";

// Semillas locales. Se usan como estado inicial hasta que la organización
// cargue o edite sus propias mascotas (a partir de ahí manda localStorage).

function seed(orgKind: OrgKind, orgId: string, orgName: string, rows: Array<Partial<BulkPet> & Pick<BulkPet, "name" | "species" | "sex" | "status" | "intakeDate">>): BulkPet[] {
  return rows.map((row, index) => ({
    id: `${orgKind}-seed-${index + 1}`,
    speciesOther: null,
    breed: null,
    age: null,
    photoUrl: null,
    photoPath: null,
    needsHome: false,
    needsSponsor: false,
    createdAt: `${row.intakeDate}T09:00:00.000Z`,
    orgKind,
    orgId,
    orgName,
    ...row,
  }));
}

export function seedBulkPets(orgKind: OrgKind, orgId: string, orgName: string): BulkPet[] {
  if (orgKind === "fundacion") {
    return seed("fundacion", orgId, orgName, [
      { name: "Canela", species: "dog", breed: "Criolla", age: "3 años", sex: "female", status: "available", intakeDate: "2026-07-18", needsHome: true },
      { name: "Pancho", species: "dog", breed: "Beagle", age: "1 año", sex: "male", status: "available", intakeDate: "2026-08-02", needsHome: true, needsSponsor: true },
      { name: "Nube", species: "cat", breed: "Mestiza", age: "8 meses", sex: "female", status: "in_treatment", intakeDate: "2026-08-20", needsSponsor: true },
      { name: "Rocco", species: "dog", breed: "Pitbull", age: "5 años", sex: "male", status: "reserved", intakeDate: "2026-06-30" },
      { name: "Lola", species: "cat", breed: "Siamesa", age: "2 años", sex: "female", status: "adopted", intakeDate: "2026-05-11" },
    ]);
  }
  return seed("veterinaria", orgId, orgName, [
    { name: "Max", species: "dog", breed: "Golden Retriever", age: "4 años", sex: "male", status: "in_treatment", intakeDate: "2026-08-25" },
    { name: "Michi", species: "cat", breed: "Angora", age: "6 años", sex: "female", status: "available", intakeDate: "2026-08-10" },
    { name: "Tommy", species: "dog", breed: "Schnauzer", age: "2 años", sex: "male", status: "available", intakeDate: "2026-07-29" },
    { name: "Kira", species: "dog", breed: "Husky", age: "3 años", sex: "female", status: "reserved", intakeDate: "2026-08-15" },
  ]);
}
