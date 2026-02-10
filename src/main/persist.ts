// src/main/persist.ts
import { FileSink } from './sinks/fileSink';

const FILE_BASE = 'C:\\Users\\fijim\\OneDrive\\Documentos\\SummonYourWillSaves';

export const persist = new FileSink(FILE_BASE);

// APIs de alto nivel:
export async function saveHeroes(heroes: any[]) {
  await persist.write('heroes', heroes);
}

export async function savePets(pets: any[]) {
  await persist.write('pets', pets);
}

export async function saveFamiliars(familiars: any[]) {
  await persist.write('familiars', familiars);
}

export async function savePartner(partner: any) {
  await persist.write('partner', partner);
}

export async function saveVillageChief(vc: any) {
  await persist.write('villagechief', vc);
}
