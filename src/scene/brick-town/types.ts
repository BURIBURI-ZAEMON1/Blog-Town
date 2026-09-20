import type { TownLayout } from '../../data/town-layout';
import type { ArticleSection } from '../../lib/markdown';
export type TownPost = {
  id: string;
  townId: string;
  title: string;
  category: string;
  tags: string[];
  series?: string;
  seriesIndex?: number;
  description: string;
  date: string;
  updatedAt?: string;
  readingTime: number;
  wordCount: number;
  cover?: string;
  coverAlt?: string;
  sections: ArticleSection[];
  searchText: string;
};

export type SceneAnchor = { x: number; y: number };

export type TownSceneProps = {
  posts: TownPost[];
  layout?: TownLayout;
  activePostId?: string;
  hoveredPostId?: string;
  query: string;
  category?: string;
  tag?: string;
  categoryPreview?: boolean;
  tagPreview?: boolean;
  colorMode: 'day' | 'night';
  reducedMotion: boolean;
  onHoverPost: (id?: string, anchor?: SceneAnchor) => void;
  onResolvePostAnchor: (id: string, anchor: SceneAnchor) => void;
  onSelectPost: (id: string) => void;
};

