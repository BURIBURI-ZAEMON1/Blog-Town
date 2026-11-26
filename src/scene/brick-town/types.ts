import type { TownLayout } from '../../data/town-layout';
import type { ArticleSection } from '../../lib/markdown';
import type { Season } from '../../data/town-seasons';

export type TownPostSummary = {
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
};

export type TownPostContent = {
  id: string;
  sections: ArticleSection[];
};

export type SearchEntry = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  series?: string;
  description: string;
  searchText: string;
};

export type TownPost = TownPostSummary & {
  sections: ArticleSection[];
  searchText: string;
};

export type SceneAnchor = { x: number; y: number };
export type TownCameraPose = { x: number; y: number; z: number; zoom: number };
export type TownTarget = { kind: 'post' | 'place'; id: string };

export type TownSceneProps = {
  posts: TownPostSummary[];
  layout?: TownLayout;
  initialCamera?: TownCameraPose;
  target?: TownTarget;
  matchingPostIds?: readonly string[];
  newPostIds?: readonly string[];
  guidePostId?: string;
  colorMode: 'day' | 'night';
  season: Season;
  reducedMotion: boolean;
  onHoverTarget: (target?: TownTarget, anchor?: SceneAnchor) => void;
  onResolveTargetAnchor: (target: TownTarget, anchor: SceneAnchor) => void;
  onSelectTarget: (target: TownTarget, pointerType?: string) => void;
  onTownExplored?: () => void;
};

