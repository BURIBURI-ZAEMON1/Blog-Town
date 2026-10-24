import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import type { Camera } from '@babylonjs/core/Cameras/camera.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { PostNoticeFrame } from '../../data/town-post-notices';
import type { buildHouse } from './buildings';
import { FLOOR_HEIGHT, GROUND_Y } from './buildings';

const NO_IDS: readonly string[] = [];

export function createPostNoticeProjector(scene: Scene, camera: Camera, houses: ReturnType<typeof buildHouse>[]) {
  const points = new Map<string, Vector3>();
  for (const house of houses) house.ids.forEach((id, floor) => {
    // Standalone articles point at the roof; series articles point at their own floor.
    const y = house.ids.length === 1 ? GROUND_Y + house.roofY : GROUND_Y + (floor + 0.6) * FLOOR_HEIGHT;
    points.set(id, new Vector3(house.plot.x, y, house.plot.z));
  });
  const lastTransform = Matrix.Zero();
  let lastIds: readonly string[] | undefined, lastGuideId: string | undefined, lastWidth = -1, lastHeight = -1;
  return {
    /** Call after scene.render(), when Babylon has updated the camera transform. */
    project(ids: readonly string[] = NO_IDS, guidePostId: string | undefined, width: number, height: number): PostNoticeFrame | undefined {
      const transform = scene.getTransformMatrix();
      if (ids === lastIds && guidePostId === lastGuideId && width === lastWidth && height === lastHeight && ((!ids.length && !guidePostId) || transform.equals(lastTransform))) return;
      lastIds = ids; lastGuideId = guidePostId; lastWidth = width; lastHeight = height; lastTransform.copyFrom(transform);
      const viewport = camera.viewport.toGlobal(width, height);
      const anchors: PostNoticeFrame['anchors'] = [];
      const noticeIds = guidePostId ? [guidePostId, ...ids.filter((id) => id !== guidePostId)] : ids;
      for (const postId of noticeIds) {
        const point = points.get(postId);
        if (!point) continue;
        const p = Vector3.Project(point, Matrix.IdentityReadOnly, transform, viewport);
        if (p.z >= 0 && p.z <= 1 && p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height) {
          anchors.push({ postId, kind: postId === guidePostId ? 'guide' : 'new', x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 });
        }
      }
      return { width, height, anchors };
    },
  };
}
