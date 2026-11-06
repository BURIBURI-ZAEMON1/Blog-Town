// Optional Giscus comments. Fill in your own public repository identifiers,
// then uncomment `enabled: true` below. No GitHub token belongs in this file.
type CommentConfig = {
  enabled?: boolean;
  host: string;
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
  language: string;
  themes: Record<'day' | 'night', string>;
};

export const commentConfig: CommentConfig = {
  // enabled: true,
  host: 'https://giscus.app',
  repo: '', // Your GitHub owner/repository.
  repoId: '', // data-repo-id from the Giscus configuration page.
  category: '', // The Discussion category name you selected.
  categoryId: '', // data-category-id from the same configuration.
  language: 'zh-CN',
  themes: { day: 'noborder_light', night: 'transparent_dark' },
};
