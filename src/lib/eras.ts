/**
 * The twelve era snapshots locked by Phase 0 spec §6.
 *
 * Lives here rather than in src/schemas/ so the map island can import it
 * without dragging Zod into the browser bundle. The schema re-exports it, so
 * there is still one list.
 */
export const ERA_SNAPSHOTS = [
  -500, 1, 300, 600, 750, 1000, 1200, 1500, 1700, 1850, 1950, 2020,
] as const;
