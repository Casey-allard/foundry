// Upstream's app search dialog is replaced whole at build by the shell's one search,
// hologram.screens/SearchDialog.tsx (hologram.screens.mjs SCREENS), so its body is not kept here; it is
// upstream's src/components/AppSearchDialog.tsx at the commit VENDORED.md names. The path and its typed export
// stay, so imports resolve and the typecheck's upstream baseline is upstream's own.
import type { AppSearchResult } from "@/lib/schemas";
export function AppSearchDialog(_: { open: boolean; onOpenChange: (open: boolean) => void; onSelectApp: (appId: number) => void; allApps: AppSearchResult[]; disableShortcut?: boolean }) { return null; }
