import { AXES, TOTAL_QUESTIONS } from './questions';

/**
 * Calculate total score, max score, percentage, and level
 * from the answers for a given assessment.
 */
export function calculateScores(answers) {
  const totalScore = answers.reduce((sum, a) => sum + a.score, 0);
  const maxScore = TOTAL_QUESTIONS * 2;
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  let level;
  if (percentage >= 80) {
    level = 'high';
  } else if (percentage >= 60) {
    level = 'good';
  } else if (percentage >= 40) {
    level = 'medium';
  } else {
    level = 'low';
  }

  return { totalScore, maxScore, percentage, level };
}

/**
 * Calculate per-axis scores from the answers array.
 * Returns an array of { axisId, axisName, score, maxScore, percentage }
 */
export function calculateAxisScores(answers) {
  return AXES.map(axis => {
    const axisAnswers = answers.filter(a => a.axis_id === axis.id);
    const score = axisAnswers.reduce((sum, a) => sum + a.score, 0);
    const maxScore = axis.questions.length * 2;
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    return {
      axisId: axis.id,
      axisName: axis.name,
      score,
      maxScore,
      percentage
    };
  });
}

export { AXES, TOTAL_QUESTIONS };
