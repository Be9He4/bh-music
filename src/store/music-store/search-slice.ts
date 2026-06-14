import type { StateCreator } from "zustand";
import type { MusicState } from "./types";
import type { MusicTrack, SearchIntent } from "@/types/music";

export interface SearchSlice {
  searchQuery: string;
  searchIntent: SearchIntent | null;
  searchResults: MusicTrack[];
  searchLoading: boolean;
  searchHasMore: boolean;
  searchPage: number;
  setSearchQuery: (query: string) => void;
  setSearchIntent: (intent: SearchIntent | null) => void;
  setSearchResults: (results: MusicTrack[]) => void;
  setSearchLoading: (loading: boolean) => void;
  setSearchHasMore: (hasMore: boolean) => void;
  setSearchPage: (page: number) => void;
  resetSearch: () => void;
}

export const createSearchSlice: StateCreator<
  MusicState,
  [],
  [],
  SearchSlice
> = (set) => ({
  searchQuery: "",
  searchIntent: null,
  searchResults: [],
  searchLoading: false,
  searchHasMore: false,
  searchPage: 0,
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSearchIntent: (searchIntent) => set({ searchIntent }),
  setSearchResults: (searchResults) => set({ searchResults }),
  setSearchLoading: (searchLoading) => set({ searchLoading }),
  setSearchHasMore: (searchHasMore) => set({ searchHasMore }),
  setSearchPage: (searchPage) => set({ searchPage }),
  resetSearch: () =>
    set({
      searchQuery: "",
      searchIntent: null,
      searchResults: [],
      searchLoading: false,
      searchHasMore: false,
      searchPage: 0,
    }),
});
