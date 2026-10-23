export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
import type { Precipitation } from './town-weather';
export type TreeVariant = 'fresh-green' | 'lush-green' | 'golden' | 'frosted';

export type SeasonProfile = {
  id: Season;
  label: string;
  shortLabel: string;
  glyph: 'flower' | 'sun' | 'leaf' | 'snow';
  description: string;
  groundCover: 'flowers' | 'grass' | 'fallen-leaves' | 'snow';
  treeVariant: TreeVariant;
  waterVariant: 'open' | 'reflective' | 'frozen';
  precipitation: Precipitation;
  palette: {
    ground: string[];
    road: string[];
    water: string[];
    shore: string;
    tree: string[];
    treeShade: string[];
    flower: string[];
    leaves: string[];
    snow: string;
  };
  lighting: {
    sun: string;
    sky: string;
    clear: string;
  };
};

export const SEASON_ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter'];

export const SEASON_PROFILES: Record<Season, SeasonProfile> = {
  spring: {
    id: 'spring', label: '春', shortLabel: 'SPRING', glyph: 'flower', description: '花朵刚刚铺满小镇边缘',
    groundCover: 'flowers', treeVariant: 'fresh-green', waterVariant: 'open', precipitation: 'rain',
    palette: {
      ground: ['#6f914b', '#82a457', '#98ad63', '#588044'], road: ['#d5c9ae', '#c4b999', '#b8b28f'],
      water: ['#58b7c3', '#3d9eaf', '#83d0d1'], shore: '#d7bd83', tree: ['#7ca34d', '#91b65b', '#a4c86a'],
      treeShade: ['#4e7e40', '#649146'], flower: ['#ee7b86', '#f2c84b', '#b78add', '#f5f0d5'],
      leaves: ['#8faf5a'], snow: '#f5f8ee',
    },
    lighting: { sun: '#fff1d6', sky: '#e8f3e8', clear: '#ffffff' },
  },
  summer: {
    id: 'summer', label: '夏', shortLabel: 'SUMMER', glyph: 'sun', description: '当前的小镇，树影和水面都在发亮',
    groundCover: 'grass', treeVariant: 'lush-green', waterVariant: 'reflective', precipitation: 'rain',
    palette: {
      ground: ['#547a3c', '#8da352', '#739546'], road: ['#d5cbb5', '#bcb4a0', '#c9ad78'],
      water: ['#75c5cd', '#399baf', '#287b90'], shore: '#c9ad78', tree: ['#739546', '#efba36'],
      treeShade: ['#31583d', '#cc5940'], flower: ['#cc5940', '#efba36', '#3f7887'],
      leaves: ['#739546'], snow: '#f5f8ee',
    },
    lighting: { sun: '#fff0d2', sky: '#dce7ed', clear: '#ffffff' },
  },
  autumn: {
    id: 'autumn', label: '秋', shortLabel: 'AUTUMN', glyph: 'leaf', description: '树冠染上金色，风把落叶带到路边',
    groundCover: 'fallen-leaves', treeVariant: 'golden', waterVariant: 'open', precipitation: 'rain',
    palette: {
      ground: ['#768649', '#8d9149', '#a2a05a', '#617c43'], road: ['#d4c5a6', '#c0ae8b', '#ad9d79'],
      water: ['#4d9eaa', '#318797', '#6bb8b9'], shore: '#c6a76d', tree: ['#d39a3c', '#bf6a35', '#e0b34b'],
      treeShade: ['#9a4f2c', '#a86f2e'], flower: ['#db7438', '#e7ad36', '#a95a3e'],
      leaves: ['#d89432', '#bd5d32', '#e0b249', '#a94d2d'], snow: '#f5f8ee',
    },
    lighting: { sun: '#f7d5a0', sky: '#e5ded0', clear: '#ffffff' },
  },
  winter: {
    id: 'winter', label: '冬', shortLabel: 'WINTER', glyph: 'snow', description: '雪落在屋顶与树梢，河面结成一层薄冰',
    groundCover: 'snow', treeVariant: 'frosted', waterVariant: 'frozen', precipitation: 'snow',
    palette: {
      ground: ['#dce8e7', '#eaf1ee', '#c8d9d8', '#f1f5f0'], road: ['#d8ddd9', '#c5d0cf', '#b6c5c7'],
      water: ['#91cedd', '#a6dce5', '#bce7ea'], shore: '#dbe4dd', tree: ['#778b83', '#9bad9f'],
      treeShade: ['#536c67', '#6f837a'], flower: ['#f4f8f4'], leaves: ['#dce8e7'], snow: '#fbffff',
    },
    lighting: { sun: '#e7f3ff', sky: '#d9e6ef', clear: '#ffffff' },
  },
};

export const getSeasonForDate = (date = new Date()): Season => {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
};

