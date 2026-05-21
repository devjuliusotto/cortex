import { createAppDataJsonAdapter } from "@/lib/storage/appDataJsonAdapter";
import type { CortexPersistedState } from "@/stores/cortexStore";

export const CORTEX_STORAGE_KEY =
  import.meta.env.VITE_CORTEX_STORAGE_KEY ?? "cortex:v0.1:workspace-state";

export const cortexStorage = createAppDataJsonAdapter<CortexPersistedState>(
  CORTEX_STORAGE_KEY,
);
