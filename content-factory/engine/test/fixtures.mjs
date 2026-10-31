export const research = {
  topic: 'Tools',
  researchedAt: '2026-10-31',
  items: [
    {
      name: 'Lucide',
      purpose: 'Icons',
      website: 'https://lucide.dev',
      github: 'https://github.com/lucide-icons/lucide',
      install: [{ cmd: 'npm install lucide-react', source: 'https://github.com/lucide-icons/lucide' }],
      sources: ['https://github.com/lucide-icons/lucide'],
    },
  ],
  sources: [{ title: 'Lucide', url: 'https://github.com/lucide-icons/lucide' }],
};

export const script = {
  title: 'Tools',
  language: 'ru',
  platform: 'shorts',
  targetDurationSec: 6,
  scenes: [
    { type: 'hook', narration: 'Это лучший набор иконок.', visual: { headline: 'Лучшие *иконки*' } },
    { type: 'item', narration: 'Lucide. Тысячи иконок.', visual: { index: 1, name: 'Lucide', tagline: 'Иконки', website: 'https://lucide.dev', command: 'npm install lucide-react' } },
    { type: 'outro', narration: 'Подписывайся.', visual: { headline: 'Подпишись', cta: 'Подписаться' } },
  ],
};

export const publication = {
  title: 'Иконки <для> & разработчиков',
  shortDescription: 'Коротко',
  longDescription: 'Подробно',
  keyPoints: ['Пункт'],
  hashtags: ['#icons', '#dev'],
  keywords: ['icons'],
  cta: 'Подписывайтесь',
  links: [{ name: 'Lucide', website: 'https://lucide.dev', github: 'https://github.com/lucide-icons/lucide', install: ['npm install lucide-react'] }],
  sources: [{ title: 'Lucide', url: 'https://github.com/lucide-icons/lucide' }],
};

export const clone = (x) => JSON.parse(JSON.stringify(x));
