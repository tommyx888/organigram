/**
 * Typy pre verejný náhľad organigramu (zdieľateľný odkaz pre ľudí mimo organizácie).
 * Payload obsahuje iba aktívnych SAL (salaried) zamestnancov a bezpečné polia.
 */

export type PublicOrgPerson = {
  /** Interné id na stavbu stromu (os_c). Nezobrazuje sa v UI. */
  id: string;
  name: string;
  position: string;
  /** Číslo strediska (napr. "70"). */
  department: string;
  /** Názov strediska (napr. "HR & HSE"). */
  departmentName: string | null;
  /** Id nadriadeného (iba ak je tiež v SAL sete), inak null. */
  managerId: string | null;
  photoUrl: string | null;
  /** Voľná pozícia (vacancy) – zobrazuje sa ako otvorená pozícia, nie osoba. */
  isVacancy?: boolean;
};

export type PublicOrgPayload = {
  companyName: string;
  generatedAt: string;
  people: PublicOrgPerson[];
};
