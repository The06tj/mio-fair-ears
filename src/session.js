export function shuffledOrder(random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) {
  return random() < 0.5 ? [0, 1] : [1, 0];
}
export function summarizeVotes(votes) {
  return votes.reduce((summary, vote) => {
    if (vote.choice === null) summary.ties++;
    else summary.files[vote.order[vote.choice]]++;
    return summary;
  }, { files: [0, 0], ties: 0 });
}
export function makeReport({ tracks, plan, votes, rounds, loop, notes, volume, createdAt = new Date().toISOString() }) {
  return {
    application: 'Mio Fair Ears', version: '0.1.0', schemaVersion: 1, createdAt,
    testType: 'randomized two-file preference listening (not ABX)',
    plannedRounds: rounds, completedRounds: votes.length,
    files: tracks.map((track, i) => ({ id: i + 1, name: track.name, decodedDurationSeconds: track.analysis.duration, decodedSampleRate: track.analysis.sampleRate, channels: track.analysis.channels, sharedLufs: plan.lufs[i], adjustmentDb: plan.adjustments[i], samplePeakDbfs: track.analysis.peak > 0 ? 20 * Math.log10(track.analysis.peak) : null })),
    playback: { sharedDurationSeconds: plan.duration, matched: plan.matched, targetLufs: plan.matched ? plan.target : null, commonHeadroomDb: plan.headroom, masterVolume: volume, loop },
    results: summarizeVotes(votes), rounds: votes, notes,
    interpretation: 'These votes describe one listening session. They do not establish audibility, statistical significance, or objective sound quality.',
  };
}
