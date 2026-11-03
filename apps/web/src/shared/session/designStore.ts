import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface SavedDesign {
  readonly designId: string;
  readonly editToken: string;
  readonly name: string;
}

interface DesignState {
  readonly designs: readonly SavedDesign[];
  readonly remember: (design: SavedDesign) => void;
  readonly forget: (designId: string) => void;
}

/**
 * The host's game designs, kept in localStorage: there are no accounts, so the edit
 * token stored here is what proves ownership. Most recent first.
 */
export const useDesignStore = create<DesignState>()(
  persist(
    (set) => ({
      designs: [],
      remember: (design) =>
        set((state) => ({
          designs: [design, ...state.designs.filter((d) => d.designId !== design.designId)],
        })),
      forget: (designId) =>
        set((state) => ({ designs: state.designs.filter((d) => d.designId !== designId) })),
    }),
    { name: 'ubt-designs', storage: createJSONStorage(() => localStorage) },
  ),
);
