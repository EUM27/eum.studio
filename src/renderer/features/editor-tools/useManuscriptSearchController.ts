import { useCallback, useRef, useState } from "react";

import type { ManuscriptDocumentSource } from "../../../application/editor/manuscript-document-profile";
import {
  searchManuscriptsForWork,
  type ManuscriptSearchResult,
} from "../../../application/editor/search-manuscripts";

type ManuscriptSearchState = Readonly<{
  sequence: number;
  result: ManuscriptSearchResult;
}>;

export function useManuscriptSearchController(input: Readonly<{
  activeDocument: ManuscriptDocumentSource | null;
  documents: readonly ManuscriptDocumentSource[];
  readManuscript: (document: ManuscriptDocumentSource) => string;
  ready: boolean;
}>) {
  const searchRef = useRef<ManuscriptSearchState | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<ManuscriptSearchState | null>(null);

  const executeSearch = useCallback(() => {
    if (!input.ready || input.activeDocument === null || query.length === 0) {
      return;
    }
    const result = searchManuscriptsForWork({
      workId: input.activeDocument.workId,
      documents: input.documents,
      query,
      readManuscript: input.readManuscript,
    });
    const nextSearch = {
      sequence: (searchRef.current?.sequence ?? 0) + 1,
      result,
    };
    searchRef.current = nextSearch;
    setSearch(nextSearch);
  }, [input, query]);

  const changeQuery = useCallback((value: string) => {
    setQuery(value);
  }, []);
  const clearSearch = useCallback(() => {
    setQuery("");
    searchRef.current = null;
    setSearch(null);
  }, []);
  const invalidateSearchResult = useCallback(() => {
    if (searchRef.current === null) return;
    searchRef.current = null;
    setSearch(null);
  }, []);

  return {
    query,
    search,
    executeSearch,
    changeQuery,
    clearSearch,
    invalidateSearchResult,
  };
}
