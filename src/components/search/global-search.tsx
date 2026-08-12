'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MessageCircle } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import type { SearchResult } from '@/lib/db/search';
import { searchClientesLight } from '@/lib/db/search';

export default function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Search when debounced value changes — legitimate async data-fetching pattern
  useEffect(() => {
    if (debouncedQuery.trim().length < 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    searchClientesLight(debouncedQuery)
      .then((data) => {
        setResults(data);
        setOpen(true);
      })
      .catch(() => {
        setResults([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [debouncedQuery]);

  // Outside click → close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Keyboard: Escape → close
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
      if (e.key === 'Enter' && results.length > 0) {
        router.push(`/clientes/${results[0].id}`);
        setOpen(false);
        setQuery('');
      }
    },
    [results, router]
  );

  const selectResult = useCallback(
    (id: string) => {
      router.push(`/clientes/${id}`);
      setOpen(false);
      setQuery('');
    },
    [router]
  );

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          placeholder="Buscar cliente..."
          className="w-full rounded-md border border-zinc-300 bg-white py-1.5 pl-8 pr-4 text-sm shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
            ...
          </span>
        )}
      </div>

      {open && (
        <ul className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-zinc-400">Sin resultados</li>
          ) : (
            results.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => selectResult(r.id)}
                  className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-zinc-400">{r.codigo}</span>
                      <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {r.nombre}
                      </span>
                    </div>
                    {r.negocio && (
                      <p className="truncate text-xs text-zinc-500">{r.negocio}</p>
                    )}
                  </div>
                  {r.telefono_1 && (
                    <a
                      href={`https://wa.me/${r.telefono_1.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 shrink-0 rounded p-1 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
                      title="Abrir WhatsApp"
                    >
                      <MessageCircle size={16} />
                    </a>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
