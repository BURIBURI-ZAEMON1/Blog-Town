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


export type TownSceneProps = {
  posts: TownPostSummary[];
  layout?: TownLayout;
  activePostId?: string;
  hoveredPostId?: string;
  hoveredFeatureId?: string;
  /** Friend link id currently focused in the outlying hamlet. */
  hoveredFriendId?: string;
  /** Friend link id selected from the neighbour list. */
  selectedFriendId?: string;
  /** Friend link id whose hut the camera should travel to. */
  focusedFriendId?: string;
  /** Diary entry id whose notice board is hovered. */
  hoveredDiaryId?: string;
  /** Diary entry id whose notice board the camera should travel to. */
  focusedDiaryId?: string;
  /** Bumped whenever the reading card flips, even to an already-focused note. */
  diaryFocusRevision?: number;
  /** Which diary layout the scene should render. */
  diaryMode?: 'district' | 'single';
  newPostIds?: readonly string[];
  guidePostId?: string;
  query: string;
  category?: string;
  tag?: string;
  categoryPreview?: boolean;
  tagPreview?: boolean;
  colorMode: 'day' | 'night';
  season: Season;
  reducedMotion: boolean;
  onHoverPost: (id?: string, anchor?: SceneAnchor) => void;
  onHoverFeature: (id?: string, anchor?: SceneAnchor) => void;
  onHoverFriend: (id?: string, anchor?: SceneAnchor) => void;
  onHoverDiary: (id?: string, anchor?: SceneAnchor) => void;
  onResolvePostAnchor: (id: string, anchor: SceneAnchor) => void;
  onResolveFeatureAnchor: (id: string, anchor: SceneAnchor) => void;
  onResolveFriendAnchor: (id: string, anchor: SceneAnchor) => void;
  onResolveDiaryAnchor: (id: string, anchor: SceneAnchor) => void;
  onSelectPost: (id: string, pointerType?: string) => void;
  onOpenFeature: (id: string) => void;
  onSelectFriend: (id: string) => void;
  onSelectDiary: (id: string) => void;
  onTownExplored?: () => void;
};

