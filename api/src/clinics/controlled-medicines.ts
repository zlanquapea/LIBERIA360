/**
 * Controlled medicines can't be prescribed in the app: they need a paper
 * prescription under Liberia's controlled-substance rules. Matched on the
 * medicine name, ignoring case and punctuation. Kept deliberately broad:
 * a false positive costs a doctor a paper script, a miss costs much more.
 */
const CONTROLLED = [
  "alprazolam",
  "amphetamine",
  "buprenorphine",
  "bromazepam",
  "chlordiazepoxide",
  "clonazepam",
  "codeine",
  "diazepam",
  "dihydrocodeine",
  "fentanyl",
  "hydrocodone",
  "hydromorphone",
  "ketamine",
  "lorazepam",
  "methadone",
  "methylphenidate",
  "midazolam",
  "morphine",
  "nitrazepam",
  "oxycodone",
  "pentazocine",
  "pethidine",
  "meperidine",
  "phenobarbital",
  "tapentadol",
  "temazepam",
  "tramadol",
  "zolpidem",
];

export function controlledMedicine(name: string): string | null {
  const plain = name.toLowerCase().replace(/[^a-z]+/g, " ");
  return CONTROLLED.find((drug) => plain.includes(drug)) ?? null;
}
