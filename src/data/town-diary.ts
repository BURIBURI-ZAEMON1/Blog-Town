export type DiaryMood = '平静' | '开心' | '疲惫' | '期待' | '感慨';

export interface DiaryEntry {
  id: string;
  /** ISO date, used for ordering and grouping by month. */
  date: string;
  content: string;
  images?: { src: string; alt: string; width: number; height: number }[];
  location?: string;
  mood?: DiaryMood;
}

/**
 * Short notes, kept deliberately separate from articles: they never become
 * town buildings, never enter the article archive, and never appear in RSS.
 * Replace these examples with your own notes, or empty the array to hide the
 * diary district. At least one entry is needed to show notice boards in town.
 */
export const diaryEntries: DiaryEntry[] = [
  {
    id: 'note-1',
    date: '2026-01-05',
    content: '在小镇东边的公告栏贴下第一张便签。',
    location: '小镇东街',
    mood: '平静',
  },
  {
    id: 'note-2',
    date: '2026-02-14',
    content: '春天来了，路边的树换了新叶。',
    location: '公告栏',
    mood: '开心',
  },
  {
    id: 'note-3',
    date: '2026-03-02',
    content: '整理了一下旧照片，时间过得真快。',
    mood: '感慨',
  },
  {
    id: 'note-4',
    date: '2026-04-01',
    content: '给公告栏刷了新漆，希望路过的人都能读到。',
    mood: '期待',
  },
];

export const sortedDiaryEntries = () =>
  [...diaryEntries].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

export const groupDiaryByMonth = (entries: DiaryEntry[]) => {
  const groups: { key: string; label: string; entries: DiaryEntry[] }[] = [];
  for (const entry of entries) {
    const date = new Date(entry.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
    const last = groups.at(-1);
    if (last?.key === key) last.entries.push(entry);
    else groups.push({ key, label, entries: [entry] });
  }
  return groups;
};
