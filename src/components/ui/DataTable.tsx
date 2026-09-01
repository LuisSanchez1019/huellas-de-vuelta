"use client";

import { type ReactNode, useMemo, useState } from "react";
import { SearchIcon } from "@/components/icons/Icon";
import styles from "./dataTable.module.css";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

export interface DataTableFilter<T> {
  id: string;
  label: string;
  test: (row: T) => boolean;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Texto por fila contra el que se busca (si se define, muestra el buscador). */
  searchAccessor?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: DataTableFilter<T>[];
  emptyMessage?: ReactNode;
}

export default function DataTable<T>({
  columns,
  rows,
  getRowId,
  searchAccessor,
  searchPlaceholder = "Buscar…",
  filters,
  emptyMessage = "No hay registros.",
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery =
        !searchAccessor || normalized.length === 0 || searchAccessor(row).toLowerCase().includes(normalized);
      const filter = filters?.find((candidate) => candidate.id === activeFilter);
      const matchesFilter = !filter || filter.test(row);
      return matchesQuery && matchesFilter;
    });
  }, [rows, query, searchAccessor, filters, activeFilter]);

  const showToolbar = Boolean(searchAccessor) || (filters && filters.length > 0);

  return (
    <div>
      {showToolbar && (
        <div className={styles.toolbar}>
          {searchAccessor && (
            <input
              className={styles.search}
              type="search"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label={searchPlaceholder}
            />
          )}
          {filters && filters.length > 0 && (
            <div className={styles.filters} role="tablist" aria-label="Filtros">
              <button
                type="button"
                className={activeFilter === "all" ? styles.filterTabActive : styles.filterTab}
                onClick={() => setActiveFilter("all")}
              >
                Todos ({rows.length})
              </button>
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={activeFilter === filter.id ? styles.filterTabActive : styles.filterTab}
                  onClick={() => setActiveFilter(filter.id)}
                >
                  {filter.label} ({rows.filter(filter.test).length})
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={styles.tableWrap}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <SearchIcon size={22} className={styles.emptyIcon} />
            <p style={{ marginTop: ".6rem" }}>{emptyMessage}</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key}>{column.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={getRowId(row)}>
                  {columns.map((column) => (
                    <td key={column.key}>{column.render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
