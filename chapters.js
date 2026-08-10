export const TITLES = [
  'Ghar Ki Chhaya',
  'Raat Ka Pashchima',
  'Khamoshi Ka Saaya',
  'Aakasmik Mulaqat',
  'Van Ka Rahasya',
  'Jagrit Astitva',
  'Gehraaiyon Ki Pukar',
  'Prakaash Ke Antargat'
];

export const buildChapters = () =>
  TITLES.map((title, index) => ({
    num: `Ch. ${index + 1}`,
    title,
    date: `${index + 1} Jan`
  }));
