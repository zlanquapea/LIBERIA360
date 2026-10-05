/**
 * Danger signs that mean "go to emergency care now", not an online
 * consultation. The patient answers these before booking; any one stops
 * the booking. Kept in sync with web/src/lib/consultations.ts.
 */
export const RED_FLAGS: Record<string, string> = {
  chest_pain: "Chest pain or pressure",
  breathing: "Struggling to breathe",
  bleeding: "Heavy bleeding that won't stop",
  unconscious: "Fainted, very drowsy or confused",
  seizure: "Fits or seizures",
  stroke: "Face drooping, a weak arm or slurred speech",
  pregnancy: "Pregnant with bleeding, severe belly pain or fits",
  baby_fever: "A baby under 2 months with a fever",
  stiff_neck: "High fever with a stiff neck or a rash that doesn't fade",
  self_harm: "Thoughts of harming yourself",
  injury: "A serious injury, burn, snake bite or poisoning",
};

export const EMERGENCY_MESSAGE =
  "This needs emergency care, not an online consultation. Go to the nearest hospital emergency room now, or call your local emergency number.";
