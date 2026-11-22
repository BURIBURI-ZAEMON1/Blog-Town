export type AboutSection = {
  id: string;
  title: string;
  paragraphs: string[];
  link?: { label: string; href: string };
};

// Fill in your About page here; shared author details live in site.ts.
export const aboutContent = {
  introduction: '',
  sections: [
    { id: 'me', title: '', paragraphs: [] },
    { id: 'town', title: '', paragraphs: [] },
    { id: 'framework', title: '', paragraphs: [] },
    { id: 'writing', title: '', paragraphs: [] },
  ] satisfies AboutSection[],
};
