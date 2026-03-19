export function calculateScore(answers, questions) {
  let total = 0;
  const sectionScores = { VARC: 0, DILR: 0, QA: 0 };
  const sectionStats = {
    VARC: { correct: 0, wrong: 0, unattempted: 0 },
    DILR: { correct: 0, wrong: 0, unattempted: 0 },
    QA: { correct: 0, wrong: 0, unattempted: 0 },
  };

  questions.forEach((q) => {
    const ans = answers[q.id];
    const section = q.section;
    const isTITA = q.question_type === 'TITA';

    if (!ans || !ans.selected || ans.selected === '') {
      sectionStats[section].unattempted += 1;
      return;
    }

    const isCorrect =
      ans.selected.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();

    if (isCorrect) {
      sectionScores[section] += 3;
      total += 3;
      sectionStats[section].correct += 1;
    } else {
      const penalty = isTITA ? 0 : -1;
      sectionScores[section] += penalty;
      total += penalty;
      sectionStats[section].wrong += 1;
    }
  });

  const allStats = {
    correct: Object.values(sectionStats).reduce((s, v) => s + v.correct, 0),
    wrong: Object.values(sectionStats).reduce((s, v) => s + v.wrong, 0),
    unattempted: Object.values(sectionStats).reduce((s, v) => s + v.unattempted, 0),
  };

  return {
    total,
    varc: sectionScores.VARC,
    dilr: sectionScores.DILR,
    qa: sectionScores.QA,
    varcStats: sectionStats.VARC,
    dilrStats: sectionStats.DILR,
    qaStats: sectionStats.QA,
    ...allStats,
  };
}
