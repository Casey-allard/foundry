// hologram-forge (ours, not upstream's; see VENDORED.md): the shell's one search, in place of
// src/components/AppSearchDialog.tsx (hologram.screens.mjs). A centred palette, as the kit's command dialog
// draws it. The apps and chats are already in memory, so it filters as you type, with no debounce and no
// round trip. From the home input it picks an app; from the sidebar it also finds chats and starts an app.
import { useEffect, useState } from "react";
import { CirclePlus, LayoutGrid, MessageSquare } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useChats } from "@/hooks/useChats";
import type { AppSearchResult } from "@/lib/schemas";

const TABS = ["All", "Apps", "Chats"] as const;
const RECENT = 6;

export function AppSearchDialog({ open, onOpenChange, onSelectApp, allApps, disableShortcut, onSelectChat, onNewApp }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectApp: (appId: number) => void;
  allApps: AppSearchResult[];
  disableShortcut?: boolean;
  onSelectChat?: (chatId: number, appId: number) => void;
  onNewApp?: () => void;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [query, setQuery] = useState("");
  const { chats } = useChats(null);
  useEffect(() => {
    if (disableShortcut) return;
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onOpenChange(!open); }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange, disableShortcut]);
  // Opening starts clean: an empty query shows the recent ones.
  useEffect(() => { if (open) { setQuery(""); setTab("All"); } }, [open]);
  const searching = query.trim() !== "";
  const names = new Map(allApps.map((a) => [a.id, a.name]));
  const apps = tab === "Chats" ? [] : searching ? allApps : allApps.slice(0, RECENT);
  const recent = [...chats].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const found = !onSelectChat || tab === "Apps" ? [] : searching ? recent : recent.slice(0, RECENT);
  const then = (act: () => void) => () => { onOpenChange(false); act(); };
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search" description="Find an app or a chat" className="sm:max-w-xl" data-testid="app-search-dialog">
      <CommandInput placeholder={onSelectChat ? "Search apps and chats" : "Search apps"} value={query} onValueChange={setQuery} data-testid="app-search-input" />
      {onSelectChat && (
        <div className="flex gap-1 border-b px-3 py-2" role="tablist" aria-label="Search in">
          {TABS.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground aria-selected:bg-accent aria-selected:text-foreground">
              {t}
            </button>
          ))}
        </div>
      )}
      {/* A fixed height, so the box never jumps while the results change under the cursor. */}
      <CommandList className="h-[min(55vh,24rem)] max-h-none" data-testid="app-search-list">
        <CommandEmpty>No results</CommandEmpty>
        {apps.length > 0 && (
          <CommandGroup heading={searching ? "Apps" : "Recent apps"}>
            {apps.map((app) => (
              <CommandItem key={`a${app.id}`} value={`${app.name} #a${app.id}`} onSelect={then(() => onSelectApp(app.id))} data-testid={`app-search-item-${app.id}`}>
                <LayoutGrid />
                <span className="truncate">{app.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {found.length > 0 && (
          <CommandGroup heading={searching ? "Chats" : "Recent chats"}>
            {found.map((chat) => (
              <CommandItem key={`c${chat.id}`} value={`${chat.title || "New chat"} ${names.get(chat.appId) ?? ""} #c${chat.id}`} onSelect={then(() => onSelectChat?.(chat.id, chat.appId))}>
                <MessageSquare />
                <span className="truncate">{chat.title || "New chat"}</span>
                {names.get(chat.appId) !== chat.title && <span className="ml-auto truncate text-xs text-muted-foreground">{names.get(chat.appId)}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {onNewApp && tab === "All" && (
          <CommandGroup heading="Actions">
            <CommandItem value="New app #new" onSelect={then(onNewApp)}>
              <CirclePlus />
              <span>New app</span>
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
