// Metadata index for all available PYP papers (no questions - just metadata)
// Used by Home page to render the selection UI

const PYP_INDEX = [
  { id: 'cat-2025-slot1', year: 2025, slot: 1, title: 'CAT 2025 Slot I',   totalQuestions: 68,  hasSolutions: true },
  { id: 'cat-2025-slot2', year: 2025, slot: 2, title: 'CAT 2025 Slot II',  totalQuestions: 68,  hasSolutions: true },
  { id: 'cat-2025-slot3', year: 2025, slot: 3, title: 'CAT 2025 Slot III', totalQuestions: 68,  hasSolutions: true },
  { id: 'cat-2024-slot1', year: 2024, slot: 1, title: 'CAT 2024 Slot I',   totalQuestions: 68,  hasSolutions: true },
  { id: 'cat-2024-slot2', year: 2024, slot: 2, title: 'CAT 2024 Slot II',  totalQuestions: 68,  hasSolutions: true },
  { id: 'cat-2024-slot3', year: 2024, slot: 3, title: 'CAT 2024 Slot III', totalQuestions: 68,  hasSolutions: true },
  { id: 'cat-2023-slot1', year: 2023, slot: 1, title: 'CAT 2023 Slot I',   totalQuestions: 66,  hasSolutions: true },
  { id: 'cat-2023-slot2', year: 2023, slot: 2, title: 'CAT 2023 Slot II',  totalQuestions: 66,  hasSolutions: true },
  { id: 'cat-2023-slot3', year: 2023, slot: 3, title: 'CAT 2023 Slot III', totalQuestions: 66,  hasSolutions: true },
  { id: 'cat-2022-slot1', year: 2022, slot: 1, title: 'CAT 2022 Slot I',   totalQuestions: 66,  hasSolutions: true },
  { id: 'cat-2022-slot2', year: 2022, slot: 2, title: 'CAT 2022 Slot II',  totalQuestions: 66,  hasSolutions: true },
  { id: 'cat-2022-slot3', year: 2022, slot: 3, title: 'CAT 2022 Slot III', totalQuestions: 66,  hasSolutions: true },
  { id: 'cat-2021-slot1', year: 2021, slot: 1, title: 'CAT 2021 Slot I',   totalQuestions: 66,  hasSolutions: true },
  { id: 'cat-2021-slot2', year: 2021, slot: 2, title: 'CAT 2021 Slot II',  totalQuestions: 66,  hasSolutions: true },
  { id: 'cat-2021-slot3', year: 2021, slot: 3, title: 'CAT 2021 Slot III', totalQuestions: 66,  hasSolutions: true },
  { id: 'cat-2020-slot1', year: 2020, slot: 1, title: 'CAT 2020 Slot I',   totalQuestions: 76,  hasSolutions: true },
  { id: 'cat-2020-slot2', year: 2020, slot: 2, title: 'CAT 2020 Slot II',  totalQuestions: 76,  hasSolutions: true },
  { id: 'cat-2020-slot3', year: 2020, slot: 3, title: 'CAT 2020 Slot III', totalQuestions: 76,  hasSolutions: true },
  { id: 'cat-2019-slot1', year: 2019, slot: 1, title: 'CAT 2019 Slot I',   totalQuestions: 100, hasSolutions: true },
  { id: 'cat-2019-slot2', year: 2019, slot: 2, title: 'CAT 2019 Slot II',  totalQuestions: 100, hasSolutions: true },
  { id: 'cat-2018-slot1', year: 2018, slot: 1, title: 'CAT 2018 Slot I',   totalQuestions: 100, hasSolutions: true },
  { id: 'cat-2018-slot2', year: 2018, slot: 2, title: 'CAT 2018 Slot II',  totalQuestions: 100, hasSolutions: true },
  { id: 'cat-2017-slot1', year: 2017, slot: 1, title: 'CAT 2017 Slot I',   totalQuestions: 100, hasSolutions: true },
  { id: 'cat-2017-slot2', year: 2017, slot: 2, title: 'CAT 2017 Slot II',  totalQuestions: 100, hasSolutions: true },
]

export const YEARS = [...new Set(PYP_INDEX.map(p => p.year))].sort((a, b) => b - a)

export function getPapersForYear(year) {
  return PYP_INDEX.filter(p => p.year === year).sort((a, b) => a.slot - b.slot)
}

export function getPaperById(id) {
  return PYP_INDEX.find(p => p.id === id) || null
}

export default PYP_INDEX
