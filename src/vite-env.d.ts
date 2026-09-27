/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TMDB_READ_TOKEN?: string;
  readonly VITE_DATA_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
