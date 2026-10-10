// All tunable matching knobs live here so they are easy to explain and change.
module.exports = {
  WEIGHTS: {
    skills: 0.55,       // can they actually do the job?
    experience: 0.20,   // are they senior enough?
    availability: 0.15, // can they start soon?
    culture: 0.10,      // soft signal, deliberately small
  },
  AVAILABILITY_SCORE: {
    'Immediate': 1.0,
    '2 weeks': 0.6,
    'Not looking': 0.2, // penalised, but not excluded - recruiters may still persuade them
  },
};
